import { topTeams } from '@/data/mockData';
import { Trophy, Users, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TopTeams() {
  return (
    <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="h-5 w-5 text-warning" />
        <h3 className="font-semibold text-foreground">Top 5 Teams</h3>
      </div>

      <div className="space-y-4">
        {topTeams.map((team, index) => (
          <div 
            key={team.id}
            className={cn(
              'p-4 rounded-lg border border-border/50 transition-all hover:border-primary/30',
              index === 0 && 'bg-warning/5 border-warning/30'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                  index === 0 ? 'bg-warning text-warning-foreground' : 'bg-secondary text-foreground'
                )}>
                  {index + 1}
                </span>
                <div>
                  <h4 className="font-medium text-foreground">{team.name}</h4>
                  <p className="text-xs text-muted-foreground">Captain: {team.captainName}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded">
                {team.region}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{team.totalSales}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-success">{team.paidSales}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{team.unpaidSales}</p>
                <p className="text-xs text-muted-foreground">Unpaid</p>
              </div>
              <div>
                <p className="text-lg font-bold text-info">{team.stockLeft}</p>
                <p className="text-xs text-muted-foreground">Stock</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
