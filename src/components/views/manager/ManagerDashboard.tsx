import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, DollarSign, Users, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';

interface DashboardMetrics {
  totalSales: number;
  activeDSRs: number;
  stockInHand: number;
  monthlySales: number;
  monthlyTarget: number;
  salesGap: number;
  unpaidStock: number;
  paidStock: number;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    activeDSRs: 0,
    stockInHand: 0,
    monthlySales: 0,
    monthlyTarget: 500,
    salesGap: 0,
    unpaidStock: 0,
    paidStock: 0
  });
  const [monthToDateData, setMonthToDateData] = useState<{ date: string; actual: number; target: number; gap: number }[]>([]);
  const [unpaidStockData, setUnpaidStockData] = useState<{ name: string; paid: number; unpaid: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get all sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*');

      if (salesError) throw salesError;

      // Calculate revenue based on stock type
      const calculateRevenue = (saleType: string) => {
        switch (saleType) {
          case 'FS': return 65000;
          case 'DO': return 25000;
          default: return 27500; // DVS
        }
      };

      const totalRevenue = sales?.reduce((sum, sale) => sum + calculateRevenue(sale.sale_type), 0) || 0;

      // Get monthly sales (current month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlySales = sales?.filter(sale => 
        new Date(sale.created_at!) >= startOfMonth
      ) || [];

      // Get active DSRs count
      const { count: dsrCount, error: dsrError } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true });

      if (dsrError) throw dsrError;

      // Get stock in hand (each stock item is 1 unit)
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('id')
        .eq('status', 'assigned-dsr');

      if (stockError) throw stockError;

      const stockInHand = stock?.length || 0;

      // Calculate month-to-date trend with target vs actual
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const currentDay = today.getDate();
      const monthlyTarget = 500; // Can be made configurable per manager
      const dailyTarget = monthlyTarget / daysInMonth;

      const monthToDateTrend: { date: string; actual: number; target: number; gap: number }[] = [];
      let cumulativeActual = 0;

      for (let day = 1; day <= currentDay; day++) {
        const dayDate = new Date(today.getFullYear(), today.getMonth(), day);
        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = monthlySales.filter(sale => {
          const saleDate = new Date(sale.created_at!);
          return saleDate >= dayStart && saleDate <= dayEnd;
        }).length;

        cumulativeActual += daySales;
        const cumulativeTarget = Math.round(dailyTarget * day);
        const gap = cumulativeActual - cumulativeTarget;

        monthToDateTrend.push({
          date: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          actual: cumulativeActual,
          target: cumulativeTarget,
          gap: gap
        });
      }

      const salesGap = monthlySales.length - Math.round(dailyTarget * currentDay);

      // Get stock payment status
      const { data: allStock, error: allStockError } = await supabase
        .from('stock')
        .select('status');

      if (allStockError) throw allStockError;

      const paidStock = allStock?.filter(s => s.status === 'sold-paid').length || 0;
      const unpaidStock = allStock?.filter(s => s.status === 'sold-unpaid').length || 0;

      // Prepare unpaid stock chart data
      const unpaidChartData = [
        {
          name: 'Paid Stock',
          paid: paidStock,
          unpaid: 0
        },
        {
          name: 'Unpaid Stock',
          paid: 0,
          unpaid: unpaidStock
        }
      ];

      setMetrics({
        totalSales: sales?.length || 0,
        activeDSRs: dsrCount || 0,
        stockInHand,
        monthlySales: monthlySales.length,
        monthlyTarget,
        salesGap,
        unpaidStock,
        paidStock
      });

      setMonthToDateData(monthToDateTrend);
      setUnpaidStockData(unpaidChartData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">Overview of sales performance and operations</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Sales"
          value={metrics.totalSales.toString()}
          icon={TrendingUp}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Active DSRs"
          value={metrics.activeDSRs.toString()}
          icon={Users}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Stock In Hand"
          value={metrics.stockInHand.toString()}
          icon={Package}
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      {/* Monthly Performance Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.monthlyTarget}</div>
            <p className="text-sm text-muted-foreground">Sales target for this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actual Sales (MTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.monthlySales}</div>
            <p className="text-sm text-muted-foreground">Month-to-date sales</p>
          </CardContent>
        </Card>

        <Card className={metrics.salesGap >= 0 ? 'border-green-500' : 'border-red-500'}>
          <CardHeader>
            <CardTitle>Gap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${metrics.salesGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.salesGap >= 0 ? '+' : ''}{metrics.salesGap}
            </div>
            <p className="text-sm text-muted-foreground">
              {metrics.salesGap >= 0 ? 'Ahead of target' : 'Behind target'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sales vs Target Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales vs Target (Visual)</CardTitle>
            <p className="text-sm text-muted-foreground">Month-to-date performance comparison</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthToDateData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(215, 20%, 55%)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(215, 20%, 55%)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 8%)',
                    border: '1px solid hsl(217, 33%, 17%)',
                    borderRadius: '8px',
                    color: 'hsl(210, 40%, 98%)'
                  }}
                />
                <Legend />
                <Bar dataKey="target" fill="hsl(217, 91%, 60%)" name="Target" />
                <Bar dataKey="actual" fill="hsl(142, 76%, 46%)" name="Actual" />
                <Line 
                  type="monotone" 
                  dataKey="gap" 
                  stroke="hsl(24, 95%, 53%)" 
                  name="Gap"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Unpaid Stock Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Stock Payment Status
            </CardTitle>
            <p className="text-sm text-muted-foreground">Paid vs Unpaid stock analysis</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                  <div className="text-sm text-muted-foreground">Paid Stock</div>
                  <div className="text-2xl font-bold text-green-600">{metrics.paidStock}</div>
                </div>
                <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950">
                  <div className="text-sm text-muted-foreground">Unpaid Stock</div>
                  <div className="text-2xl font-bold text-red-600">{metrics.unpaidStock}</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={unpaidStockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(215, 20%, 55%)"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(215, 20%, 55%)"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(222, 47%, 8%)',
                      border: '1px solid hsl(217, 33%, 17%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 40%, 98%)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="paid" fill="hsl(142, 76%, 46%)" name="Paid" />
                  <Bar dataKey="unpaid" fill="hsl(0, 84%, 60%)" name="Unpaid" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target vs Actual Trend (Month to Date) - Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Target vs Actual Sales Trend (Month-to-Date)</CardTitle>
          <p className="text-sm text-muted-foreground">Daily cumulative progress with gap analysis</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm">Target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-sm">Gap</span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <div className="space-y-2">
                {monthToDateData.map((day, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 p-2 border-b">
                    <div className="text-sm font-medium">{day.date}</div>
                    <div className="text-sm text-blue-600 font-semibold">Target: {day.target}</div>
                    <div className="text-sm text-green-600 font-semibold">Actual: {day.actual}</div>
                    <div className={`text-sm font-semibold ${day.gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Gap: {day.gap >= 0 ? '+' : ''}{day.gap}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => navigate('/manager/stock')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold">Stock Management</h3>
              <p className="text-sm text-muted-foreground">View inventory status</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => navigate('/manager/sales-team')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold">Sales Teams</h3>
              <p className="text-sm text-muted-foreground">View team performance</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => navigate('/manager/commissions')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold">Commission Reports</h3>
              <p className="text-sm text-muted-foreground">View DSR commissions</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}