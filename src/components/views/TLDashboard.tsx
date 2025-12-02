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
  CheckSquare
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const tlMetrics = {
  monthlyTarget: 1250,
  achieved: 1120,
  teams: 3,
  dsrs: 21,
  stockInHand: 620,
  unpaidSales: 180,
};

interface TLDashboardProps {
  onNavigate: (tab: string) => void;
}

export function TLDashboard({ onNavigate }: TLDashboardProps) {
  const progressPercent = Math.round((tlMetrics.achieved / tlMetrics.monthlyTarget) * 100);

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
              {tlMetrics.achieved.toLocaleString()} / {tlMetrics.monthlyTarget.toLocaleString()} units
            </p>
          </div>
        </div>
        <Progress value={progressPercent} className="h-3" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Teams" 
          value={tlMetrics.teams} 
          icon={Users}
          variant="info"
        />
        <MetricCard 
          title="DSRs" 
          value={tlMetrics.dsrs} 
          icon={UserCheck}
          variant="success"
        />
        <MetricCard 
          title="Stock In Hand" 
          value={tlMetrics.stockInHand} 
          icon={Package}
        />
        <MetricCard 
          title="Unpaid Sales" 
          value={tlMetrics.unpaidSales} 
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
