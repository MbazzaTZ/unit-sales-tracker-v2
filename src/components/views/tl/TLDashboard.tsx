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
  Loader2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TLDashboardProps {
  onNavigate: (tab: string) => void;
}

interface TLDashboardMetrics {
  monthlyTarget: number;
  achieved: number;
  teams: number;
  dsrs: number;
  stockInHand: number;
  unpaidStock: number;
}

export function TLDashboard({ onNavigate }: TLDashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tlNotFound, setTlNotFound] = useState(false);
  const [metrics, setMetrics] = useState<TLDashboardMetrics>({
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
    if (!user) return;

    try {
      setLoading(true);
      setTlNotFound(false);

      // 1️⃣ Get TL record (linking auth user → team_leaders)
      const { data: tlData, error: tlError } = await supabase
        .from('team_leaders')
        .select('id, monthly_target, region_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tlError) {
        console.error('Error fetching TL record:', tlError);
        setTlNotFound(true);
        return;
      }

      if (!tlData) {
        // No TL record for this user
        setTlNotFound(true);
        return;
      }

      // 2️⃣ Count teams under this TL
      const { count: teamCount, error: teamError } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id);

      if (teamError) {
        console.error('Error counting teams:', teamError);
      }

      // 3️⃣ Count DSRs under this TL
      const { count: dsrCount, error: dsrCountError } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id);

      if (dsrCountError) {
        console.error('Error counting DSRs:', dsrCountError);
      }

      // 4️⃣ All sales for this TL (through tl_id in sales table)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('payment_status')
        .eq('tl_id', tlData.id);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
      }

      // 5️⃣ Get DSR ids under this TL (for stock lookup)
      const { data: dsrIds, error: dsrIdsError } = await supabase
        .from('dsrs')
        .select('id')
        .eq('tl_id', tlData.id);

      if (dsrIdsError) {
        console.error('Error fetching DSR IDs:', dsrIdsError);
      }

      let stockInHand = 0;
      let unpaidStock = 0;

      if (dsrIds && dsrIds.length > 0) {
        const dsrIdsList = dsrIds.map((d) => d.id);

        // 6️⃣ Stock in hand for these DSRs
        const { data: stockData, error: stockError } = await supabase
          .from('stock')
          .select('status')
          .in('assigned_to_dsr', dsrIdsList);

        if (stockError) {
          console.error('Error fetching stock:', stockError);
        }

        stockInHand =
          stockData?.filter(
            (s) => s.status === 'assigned-dsr' || s.status === 'assigned-team'
          ).length || 0;

        // 7️⃣ Unpaid sales (stock "out" but not yet paid)
        const { data: unpaidSalesData, error: unpaidSalesError } = await supabase
          .from('sales')
          .select('id')
          .eq('tl_id', tlData.id)
          .eq('payment_status', 'unpaid');

        if (unpaidSalesError) {
          console.error('Error fetching unpaid sales:', unpaidSalesError);
        }

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
      setTlNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const progressPercent =
    metrics.monthlyTarget > 0
      ? Math.round((metrics.achieved / metrics.monthlyTarget) * 100)
      : 0;

  const currentMonthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tlNotFound) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No TL Record Found</h2>
          <p className="text-muted-foreground mb-4">
            Your account does not have a Team Leader profile yet. Please contact the
            system administrator to configure your TL access.
          </p>
        </div>
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
              <h2 className="text-lg font-semibold text-foreground">
                Monthly Target Progress
              </h2>
              <p className="text-sm text-muted-foreground">{currentMonthLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground">{progressPercent}%</p>
            <p className="text-sm text-muted-foreground">
              {metrics.achieved.toLocaleString()} /{' '}
              {metrics.monthlyTarget.toLocaleString()} units
            </p>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          Track how your teams are performing against this month&apos;s sales target.
        </p>
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
          variant="default"
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
