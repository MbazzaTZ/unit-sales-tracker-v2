import { Region } from '@/types/tsm';
import { Progress } from '@/components/ui/progress';
import { Users, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegionCardProps {
  region: Region;
  className?: string;
}

export function RegionCard({ region, className }: RegionCardProps) {
  const achievementPercent = Math.round((region.achieved / region.target) * 100);
  const isHighRisk = region.unpaidSales > region.paidSales * 0.15;

  return (
    <div className={cn(
      'glass rounded-xl p-5 border border-border/50 transition-all duration-300 hover:border-primary/30 animate-fade-in',
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{region.name}</h3>
          <span className="text-xs text-muted-foreground font-mono">{region.code}</span>
        </div>
        {isHighRisk && (
          <div className="flex items-center gap-1 text-warning text-xs">
            <AlertTriangle className="h-3 w-3" />
            High Risk
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-secondary/50">
          <p className="text-lg font-bold text-foreground">{region.tlCount}</p>
          <p className="text-xs text-muted-foreground">TLs</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/50">
          <p className="text-lg font-bold text-foreground">{region.teamCount}</p>
          <p className="text-xs text-muted-foreground">Teams</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/50">
          <p className="text-lg font-bold text-foreground">{region.dsrCount}</p>
          <p className="text-xs text-muted-foreground">DSRs</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Package className="h-3 w-3" /> Stock In Hand
          </span>
          <span className="font-medium text-foreground">{region.stockInHand.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Paid Stock</span>
          <span className="font-medium text-success">{region.paidSales.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Unpaid Stock</span>
          <span className="font-medium text-destructive">{region.unpaidSales.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground">Target Progress</span>
          <span className={cn(
            'text-sm font-bold',
            achievementPercent >= 80 ? 'text-success' : achievementPercent >= 60 ? 'text-warning' : 'text-destructive'
          )}>
            {achievementPercent}%
          </span>
        </div>
        <Progress 
          value={achievementPercent} 
          className="h-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{region.achieved.toLocaleString()} achieved</span>
          <span>{region.target.toLocaleString()} target</span>
        </div>
      </div>
    </div>
  );
}
