import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TopTeams } from '@/components/dashboard/TopTeams';
import { DSRLeaderboard } from '@/components/dashboard/DSRLeaderboard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { Button } from '@/components/ui/button';
import { 
  Target, 
  TrendingUp, 
  Users, 
  UserCheck, 
  Package, 
  AlertCircle,
  Plus,
  ShoppingCart,
  CheckSquare,
  Loader2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TLDashboardProps {
  onNavigate: (tab: string) => void;
}

export function TLDashboard({ onNavigate }: TLDashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    monthlyTarget: 0,
    achieved: 0,
    teams: 0,
    dsrs: 0,
    stockInHand: 0,
    unpaidStock: 0,
  });

  useEffect(() => {
    if (user) {
      fetchTLData();
    }
  }, [user]);

  async function fetchTLData() {
    try {
      setLoading(true);

      // Get TL record with monthly target
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, monthly_target, region_id')
        .eq('user_id', user?.id)
        .single();

      if (!tlData) {
        setLoading(false);
        return;
      }

      // Count teams under this TL
      const { count: teamCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id);

      // Count DSRs under this TL
      const { count: dsrCount } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id);

      // Get sales data for this TL
      const { data: salesData } = await supabase
        .from('sales')
        .select('payment_status')
        .eq('tl_id', tlData.id);

      // Get stock data for this TL's DSRs
      const { data: dsrIds } = await supabase
        .from('dsrs')
        .select('id')
        .eq('tl_id', tlData.id);

      let stockInHand = 0;
      let unpaidStock = 0;

      if (dsrIds && dsrIds.length > 0) {
        const dsrIdsList = dsrIds.map(d => d.id);

        const { data: stockData } = await supabase
          .from('stock')
          .select('status')
          .in('assigned_to_dsr', dsrIdsList);

        stockInHand = stockData?.filter(s => 
          s.status === 'assigned-dsr' || s.status === 'assigned-team'
        ).length || 0;

        const { data: unpaidSalesData } = await supabase
          .from('sales')
          .select('id')
          .eq('tl_id', tlData.id)
          .eq('payment_status', 'unpaid');

        unpaidStock = unpaidSalesData?.length || 0;
      }

      const totalSales = salesData?.length || 0;
      const monthlyTarget = tlData.monthly_target || 100;

      setMetrics({
        monthlyTarget,
        achieved: totalSales,
        teams: teamCount || 0,
        dsrs: dsrCount || 0,
        stockInHand,
        unpaidStock,
      });

    } catch (error) {
      console.error('Error fetching TL data:', error);
    } finally {
      setLoading(false);
    }
  }

  const progressPercent = metrics.monthlyTarget > 0 
    ? Math.round((metrics.achieved / metrics.monthlyTarget) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">TL Dashboard</h1>
          <p className="text-muted-foreground">Manage your teams and track performance</p>
        </div>
      </div>

      {/* Target Progress Card */}
      <div className="glass rounded-xl p-6 border border-primary/30 metric-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Monthly Target Progress</h2>
              <p className="text-sm text-muted-foreground">December 2025</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground">{progressPercent}%</p>
            <p className="text-sm text-muted-foreground">
              {metrics.achieved.toLocaleString()} / {metrics.monthlyTarget.toLocaleString()} units
            </p>
          </div>
        </div>
        <Progress value={progressPercent} className="h-3" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Teams" 
          value={metrics.teams} 
          icon={Users}
          variant="info"
        />
        <MetricCard 
          title="DSRs" 
          value={metrics.dsrs} 
          icon={UserCheck}
          variant="success"
        />
        <MetricCard 
          title="Stock In Hand" 
          value={metrics.stockInHand} 
          icon={Package}
        />
        <MetricCard 
          title="Unpaid Stock" 
          value={metrics.unpaidStock} 
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            onClick={() => onNavigate('teams')}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50"
          >
            <Plus className="h-5 w-5 text-primary" />
            <span>Create Team</span>
          </Button>
          <Button 
            onClick={() => onNavigate('dsrs')}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-success/10 hover:border-success/50"
          >
            <UserCheck className="h-5 w-5 text-success" />
            <span>Add DSR</span>
          </Button>
          <Button 
            onClick={() => onNavigate('stock')}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-info/10 hover:border-info/50"
          >
            <Package className="h-5 w-5 text-info" />
            <span>Assign Stock</span>
          </Button>
          <Button 
            onClick={() => onNavigate('verification')}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-warning/10 hover:border-warning/50"
          >
            <CheckSquare className="h-5 w-5 text-warning" />
            <span>Verify Sales</span>
          </Button>
        </div>
      </div>

      {/* Charts */}
      <SalesChart />

      {/* Teams & DSR Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopTeams />
        <DSRLeaderboard />
      </div>
    </div>
  );
}
