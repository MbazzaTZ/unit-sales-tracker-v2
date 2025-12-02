import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, DollarSign, Users, Package, TrendingUp } from 'lucide-react';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { MetricCard } from '@/components/dashboard/MetricCard';

interface DashboardMetrics {
  totalSales: number;
  totalRevenue: number;
  activeDSRs: number;
  stockInHand: number;
  monthlySales: number;
  monthlyRevenue: number;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    totalRevenue: 0,
    activeDSRs: 0,
    stockInHand: 0,
    monthlySales: 0,
    monthlyRevenue: 0
  });
  const [weeklyData, setWeeklyData] = useState<{ day: string; sales: number }[]>([]);

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

      const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + calculateRevenue(sale.sale_type), 0);

      // Get active DSRs count
      const { count: dsrCount } = await supabase
        .from('dsrs')
        .select('*', { count: 'only' });

      // Get stock in hand
      const { data: stock } = await supabase
        .from('stock')
        .select('quantity')
        .eq('status', 'stock-in-hand');

      const stockInHand = stock?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

      // Calculate weekly sales for chart
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date;
      });

      const weeklyData = last7Days.map(date => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = sales?.filter(sale => {
          const saleDate = new Date(sale.created_at!);
          return saleDate >= dayStart && saleDate <= dayEnd;
        }).length || 0;

        return {
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: daySales
        };
      });

      setMetrics({
        totalSales: sales?.length || 0,
        totalRevenue,
        activeDSRs: dsrCount || 0,
        stockInHand,
        monthlySales: monthlySales.length,
        monthlyRevenue
      });

      setWeeklyData(weeklyData);
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Sales"
          value={metrics.totalSales.toString()}
          icon={TrendingUp}
          trend="All time sales count"
        />
        <MetricCard
          title="Total Revenue"
          value={`TZS ${metrics.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend="All time revenue"
        />
        <MetricCard
          title="Active DSRs"
          value={metrics.activeDSRs.toString()}
          icon={Users}
          trend="Field sales representatives"
        />
        <MetricCard
          title="Stock In Hand"
          value={metrics.stockInHand.toString()}
          icon={Package}
          trend="Available inventory"
        />
      </div>

      {/* Monthly Performance */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.monthlySales}</div>
            <p className="text-sm text-muted-foreground">Sales this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">TZS {metrics.monthlyRevenue.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Revenue this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={weeklyData} />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardContent className="pt-6">
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold">Stock Management</h3>
              <p className="text-sm text-muted-foreground">View inventory status</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold">Sales Teams</h3>
              <p className="text-sm text-muted-foreground">View team performance</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
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
