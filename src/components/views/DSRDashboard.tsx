import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { 
  Package, 
  CheckCircle, 
  AlertCircle, 
  ShoppingCart, 
  Calendar,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Tooltip 
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DSRDashboardProps {
  onNavigate: (tab: string) => void;
}

interface DashboardMetrics {
  stockInHand: number;
  paidSales: number;
  unpaidSales: number;
  todaySales: number;
  monthlySales: number;
  totalRevenue: number;
}

interface WeeklyDataPoint {
  day: string;
  sales: number;
}

export function DSRDashboard({ onNavigate }: DSRDashboardProps) {
  const { user, profile } = useAuth();
  const [dsrId, setDsrId] = useState<string | null>(null);
  const [dsrName, setDsrName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    stockInHand: 0,
    paidSales: 0,
    unpaidSales: 0,
    todaySales: 0,
    monthlySales: 0,
    totalRevenue: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);

  useEffect(() => {
    if (user) {
      fetchDSRData();
    }
  }, [user]);

  async function fetchDSRData() {
    if (!user) return;

    try {
      setLoading(true);

      // Get DSR record
      const { data: dsrData, error: dsrError } = await supabase
        .from('dsrs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dsrError) throw dsrError;
      
      if (!dsrData) {
        console.log('No DSR record found for user');
        setLoading(false);
        return;
      }

      setDsrId(dsrData.id);
      setDsrName(profile?.full_name || 'DSR');

      // Fetch stock in hand
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select('quantity')
        .eq('assigned_to_dsr', dsrData.id)
        .in('status', ['assigned-dsr', 'in-hand']);

      const stockInHand = stockData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('dsr_id', dsrData.id);

      if (salesError) throw salesError;

      // Calculate metrics
      const paidSales = salesData?.filter(s => s.payment_status === 'paid').length || 0;
      const unpaidSales = salesData?.filter(s => s.payment_status === 'unpaid').length || 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySales = salesData?.filter(s => new Date(s.sale_date) >= today).length || 0;

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlySales = salesData?.filter(s => new Date(s.sale_date) >= monthStart).length || 0;

      const totalRevenue = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

      setMetrics({
        stockInHand,
        paidSales,
        unpaidSales,
        todaySales,
        monthlySales,
        totalRevenue,
      });

      // Calculate weekly data
      const weeklyChart = await calculateWeeklySales(salesData || []);
      setWeeklyData(weeklyChart);

    } catch (error) {
      console.error('Error fetching DSR data:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateWeeklySales(salesData: any[]): WeeklyDataPoint[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days: WeeklyDataPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const salesCount = salesData.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= date && saleDate < nextDate;
      }).length;

      last7Days.push({
        day: days[date.getDay()],
        sales: salesCount,
      });
    }

    return last7Days;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dsrId) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No DSR Record Found</h2>
          <p className="text-muted-foreground mb-4">
            Your account doesn't have a DSR record yet. Please contact your Team Leader or Administrator to set up your DSR profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {dsrName}</h1>
        <p className="text-muted-foreground">Here's your performance overview</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard 
          title="Stock In Hand" 
          value={metrics.stockInHand} 
          icon={Package}
          variant="info"
        />
        <MetricCard 
          title="Paid Stock" 
          value={metrics.paidSales} 
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard 
          title="Unpaid Stock" 
          value={metrics.unpaidSales} 
          icon={AlertCircle}
          variant="danger"
        />
        <MetricCard 
          title="Today's Sales" 
          value={metrics.todaySales} 
          icon={ShoppingCart}
        />
        <MetricCard 
          title="Monthly Sales" 
          value={metrics.monthlySales} 
          icon={Calendar}
        />
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            onClick={() => onNavigate('stock')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
            variant="outline"
          >
            <Package className="h-6 w-6" />
            <span>My Stock</span>
          </Button>
          <Button 
            onClick={() => onNavigate('add-sale')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-success/10 hover:bg-success/20 text-success border border-success/30"
            variant="outline"
          >
            <ShoppingCart className="h-6 w-6" />
            <span>Add Sale</span>
          </Button>
          <Button 
            onClick={() => onNavigate('my-sales')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-info/10 hover:bg-info/20 text-info border border-info/30"
            variant="outline"
          >
            <TrendingUp className="h-6 w-6" />
            <span>My Sales</span>
          </Button>
          <Button 
            onClick={() => onNavigate('commission')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30"
            variant="outline"
          >
            <Calendar className="h-6 w-6" />
            <span>Commission</span>
          </Button>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold text-foreground mb-4">Last 7 Days Sales</h2>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                stroke="hsl(215, 20%, 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(215, 20%, 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 8%)',
                  border: '1px solid hsl(217, 33%, 17%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 40%, 98%)'
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
