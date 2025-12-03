import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { RegionCard } from '@/components/dashboard/RegionCard';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  DollarSign,
  Target,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface RegionData {
  id: string;
  name: string;
  code: string;
  tlCount: number;
  teamCount: number;
  dsrCount: number;
  stockInHand: number;
  paidSales: number;
  unpaidSales: number;
  target: number;
  achieved: number;
}

export function GeneralDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalDSRs: 0,
    stockInHand: 0,
    totalStock: 0,
    targetAchievement: 0
  });
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [teamData, setTeamData] = useState<{ team: string; target: number; achieved: number }[]>([]);
  const [productData, setProductData] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<{ date: string; amount: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Fetch sales data
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('sale_type, payment_status, region_id, created_at');
      
      if (salesError) throw salesError;

      // Fetch DSRs count
      const { count: dsrCount, error: dsrError } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true });
      
      if (dsrError) throw dsrError;

      // Fetch stock data
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('status, type, region_id');
      
      if (stockError) throw stockError;

      // Fetch regions with detailed aggregated data
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select(`
          id,
          name,
          code
        `);
      
      if (regionsError) throw regionsError;

      // Fetch aggregated data for each region
      const regionsWithData = await Promise.all(
        (regionsData || []).map(async (region) => {
          // Count TLs in region
          const { count: tlCount } = await supabase
            .from('team_leaders')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', region.id);

          // Count teams in region
          const { count: teamCount } = await supabase
            .from('teams')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', region.id);

          // Count DSRs in region
          const { count: dsrCount } = await supabase
            .from('dsrs')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', region.id);

          // Get sales data for region
          const { data: regionSales } = await supabase
            .from('sales')
            .select('payment_status')
            .eq('region_id', region.id);

          const paidSales = regionSales?.filter(s => s.payment_status === 'paid').length || 0;
          const unpaidSales = regionSales?.filter(s => s.payment_status === 'unpaid').length || 0;

          // Count stock in region
          const { data: regionStock } = await supabase
            .from('stock')
            .select('status')
            .eq('region_id', region.id);

          const stockInHand = regionStock?.filter(s => 
            s.status === 'assigned-dsr' || s.status === 'assigned-team'
          ).length || 0;

          return {
            id: region.id,
            name: region.name,
            code: region.code,
            tlCount: tlCount || 0,
            teamCount: teamCount || 0,
            dsrCount: dsrCount || 0,
            stockInHand,
            paidSales,
            unpaidSales,
            target: 100, // Can be configured per region
            achieved: paidSales + unpaidSales
          };
        })
      );

      // Fetch teams data - corrected query
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select(`
          name,
          region_id,
          team_leaders(monthly_target)
        `)
        .limit(4);
      
      if (teamsError) throw teamsError;

      // Get sales count for each team
      const teamsWithSales = await Promise.all(
        (teams || []).map(async (team) => {
          const { count: salesCount } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', team.region_id);

          return {
            team: team.name,
            target: team.team_leaders?.[0]?.monthly_target || 100,
            achieved: salesCount || 0
          };
        })
      );

      // Calculate metrics
      const totalSales = sales?.length || 0;
      const doSales = sales?.filter(s => s.sale_type === 'DO').length || 0;
      const fsSales = sales?.filter(s => s.sale_type === 'FS').length || 0;
      const paidSales = sales?.filter(s => s.payment_status === 'paid').length || 0;
      
      // Calculate revenue (DO: 25,000 TZS, FS: 65,000 TZS)
      const totalRevenue = (doSales * 25000) + (fsSales * 65000);
      
      const stockInHand = stock?.filter(s => s.status === 'assigned-dsr' || s.status === 'assigned-team').length || 0;
      const totalStock = stock?.length || 0;
      
      const targetAchievement = totalStock > 0 ? Math.round((totalSales / totalStock) * 100) : 0;

      // Create sales trend data for the last 30 days
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date;
      });

      const trendData = last30Days.map(date => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = sales?.filter(sale => {
          const saleDate = new Date(sale.created_at!);
          return saleDate >= dayStart && saleDate <= dayEnd;
        }) || [];

        const dayRevenue = daySales.reduce((sum, sale) => {
          const revenue = sale.sale_type === 'DO' ? 25000 : 65000;
          return sum + revenue;
        }, 0);

        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: dayRevenue
        };
      });

      setMetrics({
        totalSales,
        totalRevenue,
        totalDSRs: dsrCount || 0,
        stockInHand,
        totalStock,
        targetAchievement
      });

      setRegions(regionsWithData);
      setTeamData(teamsWithSales);
      setSalesTrendData(trendData);

      // Product distribution (DO vs FS)
      setProductData([
        { name: 'DO Sales', value: doSales, fill: 'hsl(217, 91%, 60%)' },
        { name: 'FS Sales', value: fsSales, fill: 'hsl(142, 71%, 45%)' },
        { name: 'Paid', value: paidSales, fill: 'hsl(262, 83%, 58%)' },
        { name: 'Pending', value: totalSales - paidSales, fill: 'hsl(38, 92%, 50%)' }
      ]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">General Overview</h1>
          <p className="text-muted-foreground">Company-wide performance and insights</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Last updated</p>
          <p className="text-sm font-medium text-foreground">
            {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard 
          title="Total Sales" 
          value={metrics.totalSales.toString()} 
          icon={ShoppingCart}
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard 
          title="Revenue" 
          value={`${(metrics.totalRevenue / 1000000).toFixed(1)}M TZS`}
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
        />
        <MetricCard 
          title="Active DSRs" 
          value={metrics.totalDSRs.toString()} 
          icon={Users}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard 
          title="Stock In Hand" 
          value={metrics.stockInHand.toString()} 
          icon={Package}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard 
          title="Target Achievement" 
          value={`${metrics.targetAchievement}%`}
          icon={Target}
          trend={{ value: metrics.targetAchievement, isPositive: metrics.targetAchievement >= 70 }}
        />
        <MetricCard 
          title="Total Stock" 
          value={metrics.totalStock.toString()}
          icon={TrendingUp}
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      {/* Regional Performance */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Regional Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {regions.map((region, index) => (
            <RegionCard 
              key={region.id} 
              region={region} 
              className={`animation-delay-${index * 100}`}
            />
          ))}
        </div>
      </div>

      {/* Sales Trend */}
      <div className="glass rounded-xl p-6 border border-border/50">
        <h2 className="text-lg font-semibold text-foreground mb-4">Sales Trend (Last 30 Days)</h2>
        <SalesChart data={salesTrendData} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance Comparison */}
        <div className="glass rounded-xl p-6 border border-border/50">
          <h2 className="text-lg font-semibold text-foreground mb-4">Team Performance</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamData}>
                <XAxis 
                  dataKey="team" 
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
                <Legend />
                <Bar dataKey="target" fill="hsl(215, 20%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="achieved" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Distribution */}
        <div className="glass rounded-xl p-6 border border-border/50">
          <h2 className="text-lg font-semibold text-foreground mb-4">Sales Distribution</h2>
          <div className="h-[280px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 8%)',
                    border: '1px solid hsl(217, 33%, 17%)',
                    borderRadius: '8px',
                    color: 'hsl(210, 40%, 98%)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Average Sales/DSR</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {metrics.totalDSRs > 0 ? Math.round(metrics.totalSales / metrics.totalDSRs) : 0} units
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Per DSR performance</p>
        </div>

        <div className="glass rounded-xl p-6 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sales Conversion</p>
              <p className="text-2xl font-bold text-foreground mt-1">{metrics.targetAchievement}%</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10">
              <Target className="h-6 w-6 text-success" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Sales vs Stock ratio</p>
        </div>

        <div className="glass rounded-xl p-6 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Regions</p>
              <p className="text-2xl font-bold text-foreground mt-1">{regions.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-info/10">
              <Package className="h-6 w-6 text-info" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Coverage areas</p>
        </div>
      </div>
    </div>
  );
}