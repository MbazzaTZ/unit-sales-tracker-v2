import { teamLeaders } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function TLPerformanceTable() {
  return (
    <div className="glass rounded-xl border border-border/50 animate-fade-in overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <h3 className="font-semibold text-foreground">TL Performance</h3>
        <p className="text-sm text-muted-foreground">Team Leader rankings by achievement</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground">TL</TableHead>
              <TableHead className="text-muted-foreground">Region</TableHead>
              <TableHead className="text-muted-foreground text-center">Teams</TableHead>
              <TableHead className="text-muted-foreground text-center">DSRs</TableHead>
              <TableHead className="text-muted-foreground text-right">Target</TableHead>
              <TableHead className="text-muted-foreground text-right">Achieved</TableHead>
              <TableHead className="text-muted-foreground">Progress</TableHead>
              <TableHead className="text-muted-foreground text-right">Unpaid</TableHead>
              <TableHead className="text-muted-foreground text-right">Stock</TableHead>
              <TableHead className="text-muted-foreground text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamLeaders.map((tl) => {
              const percent = Math.round((tl.achieved / tl.target) * 100);
              return (
                <TableRow key={tl.id} className="border-border/50 hover:bg-secondary/30">
                  <TableCell className="font-medium text-foreground">{tl.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                      {tl.regionCode}
                    </span>
                    <span className="ml-2">{tl.region}</span>
                  </TableCell>
                  <TableCell className="text-center text-foreground">{tl.teams}</TableCell>
                  <TableCell className="text-center text-foreground">{tl.dsrs}</TableCell>
                  <TableCell className="text-right text-foreground">{tl.target.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-foreground">{tl.achieved.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={percent} className="h-2 w-20" />
                      <span className={cn(
                        'text-xs font-medium',
                        percent >= 80 ? 'text-success' : percent >= 60 ? 'text-warning' : 'text-destructive'
                      )}>
                        {percent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-destructive">{tl.unpaidSales}</TableCell>
                  <TableCell className="text-right text-foreground">{tl.stockInHand}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      tl.performanceStatus === 'good' && 'bg-success/10 text-success',
                      tl.performanceStatus === 'average' && 'bg-warning/10 text-warning',
                      tl.performanceStatus === 'weak' && 'bg-destructive/10 text-destructive',
                    )}>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        tl.performanceStatus === 'good' && 'bg-success',
                        tl.performanceStatus === 'average' && 'bg-warning',
                        tl.performanceStatus === 'weak' && 'bg-destructive',
                      )} />
                      {tl.performanceStatus === 'good' ? 'Good' : tl.performanceStatus === 'average' ? 'Avg' : 'Weak'}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
