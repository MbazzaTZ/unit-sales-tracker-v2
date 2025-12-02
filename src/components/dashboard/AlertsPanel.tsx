import { alerts } from '@/data/mockData';
import { AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AlertsPanel() {
  return (
    <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="font-semibold text-foreground">Critical Alerts</h3>
        <span className="ml-auto bg-destructive/10 text-destructive text-xs font-medium px-2 py-0.5 rounded-full">
          {alerts.length} active
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={cn(
              'p-3 rounded-lg border transition-all hover:bg-secondary/50',
              alert.severity === 'critical' 
                ? 'bg-destructive/5 border-destructive/30' 
                : 'bg-warning/5 border-warning/30'
            )}
          >
            <div className="flex items-start gap-3">
              {alert.severity === 'critical' ? (
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded',
                    alert.severity === 'critical' 
                      ? 'bg-destructive/10 text-destructive' 
                      : 'bg-warning/10 text-warning'
                  )}>
                    {alert.type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.dateCreated).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
