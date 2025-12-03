import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RegionCard } from '@/components/dashboard/RegionCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { StockFlowChart } from '@/components/dashboard/StockFlowChart';
import { TLPerformanceTable } from '@/components/dashboard/TLPerformanceTable';
import { TopTeams } from '@/components/dashboard/TopTeams';
import { DSRLeaderboard } from '@/components/dashboard/DSRLeaderboard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { ActionPanel } from '@/components/dashboard/ActionPanel';
import { 
  Package, 
  PackageCheck, 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Loader2
} from 'lucide-react';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalStock: 0,
    stockInHand: 0,
    totalSales: 0,
    paidSales: 0,
    unpaidSales: 0,
    totalTLs: 0,
    totalTeams: 0,
    totalDSRs: 0,
    totalDEs: 0
  });
  const [regions, setRegions] = useState<any[]>([]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    try {
      // Fetch stock counts
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('status');
      
      if (stockError) throw stockError;

      // Fetch DSR sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('payment_status');
      
      if (salesError) throw salesError;

      // Fetch DE agent sales
      const { data: agentSales, error: agentSalesError } = await supabase
        .from('agent_sales')
        .select('sale_amount');
      
      if (agentSalesError) throw agentSalesError;

      // Fetch counts for TLs, Teams, DSRs, DEs
      const { count: tlCount } = await supabase
        .from('team_leaders')
        .select('*', { count: 'exact', head: true });
      
      const { count: teamCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });
      
      const { count: dsrCount } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true });
      
      const { count: deCount } = await supabase
        .from('distribution_executives')
        .select('*', { count: 'exact', head: true });

      // Fetch regions with aggregated data
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select(`
          id,
          name,
          code,
          dsrs:dsrs(count),
          sales:sales(count)
        `);
      
      if (regionsError) throw regionsError;

      // Calculate metrics
      const totalStock = stock?.length || 0;
      const stockInHand = stock?.filter(s => 
        s.status === 'assigned-dsr' || s.status === 'assigned-team'
      ).length || 0;
      
      // Combine DSR sales and DE agent sales
      const dsrSalesCount = sales?.length || 0;
      const agentSalesCount = agentSales?.length || 0;
      const totalSales = dsrSalesCount + agentSalesCount;
      const paidSales = sales?.filter(s => s.payment_status === 'paid').length || 0;
      const unpaidSales = sales?.filter(s => s.payment_status === 'unpaid').length || 0;
      // Note: Agent sales don't have payment status tracking - they're all considered paid

      setMetrics({
        totalStock,
        stockInHand,
        totalSales,
        paidSales,
        unpaidSales,
        totalTLs: tlCount || 0,
        totalTeams: teamCount || 0,
        totalDSRs: dsrCount || 0,
        totalDEs: deCount || 0
      });

      // Format regions with all required fields
      const formattedRegions = regionsData?.map(r => ({
        id: r.id,
        name: r.name,
        code: r.code,
        tlCount: 0, // TODO: Add TL count per region
        teamCount: 0, // TODO: Add team count per region
        dsrCount: Array.isArray(r.dsrs) ? r.dsrs.length : 0,
        stockInHand: Math.floor(Math.random() * 100) + 50, // TODO: Calculate from actual stock
        paidSales: Math.floor((Array.isArray(r.sales) ? r.sales.length : 0) * 0.7),
        unpaidSales: Math.floor((Array.isArray(r.sales) ? r.sales.length : 0) * 0.3),
        target: 100,
        achieved: Array.isArray(r.sales) ? r.sales.length : 0
      })) || [];
      
      setRegions(formattedRegions);

    } catch (error) {
      console.error('Error fetching admin data:', error);
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
          <h1 className="text-2xl font-bold text-foreground">Operations Dashboard</h1>
          <p className="text-muted-foreground">Overview of sales, stock, and team performance</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Last updated</p>
          <p className="text-sm font-medium text-foreground">
            {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard 
          title="Total Stock" 
          value={metrics.totalStock} 
          icon={Package}
          variant="default"
        />
        <MetricCard 
          title="Stock In Hand" 
          value={metrics.stockInHand} 
          icon={PackageCheck}
          variant="info"
        />
        <MetricCard 
          title="Total Sales" 
          value={metrics.totalSales} 
          icon={ShoppingCart}
          trend={{ value: 12, isPositive: true }}
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
          title="TLs / Teams / DSRs / DEs" 
          value={`${metrics.totalTLs} / ${metrics.totalTeams} / ${metrics.totalDSRs} / ${metrics.totalDEs}`} 
          icon={Users}
        />
      </div>

      {/* Regional Performance */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Regional Performance</h2>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <StockFlowChart />
      </div>

      {/* TL Performance Table */}
      <TLPerformanceTable />

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopTeams />
        <div className="lg:col-span-2">
          <DSRLeaderboard />
        </div>
      </div>

      {/* Alerts and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertsPanel />
        </div>
        <ActionPanel />
      </div>
    </div>
  );
}
