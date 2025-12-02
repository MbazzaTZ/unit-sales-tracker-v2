import { dsrLeaderboard } from '@/data/mockData';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Medal } from 'lucide-react';

export function DSRLeaderboard() {
  return (
    <div className="glass rounded-xl border border-border/50 animate-fade-in overflow-hidden">
      <div className="p-5 border-b border-border/50 flex items-center gap-2">
        <Medal className="h-5 w-5 text-warning" />
        <div>
          <h3 className="font-semibold text-foreground">DSR Leaderboard</h3>
          <p className="text-sm text-muted-foreground">Top performers by sales</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground w-16">Rank</TableHead>
              <TableHead className="text-muted-foreground">DSR</TableHead>
              <TableHead className="text-muted-foreground">Team</TableHead>
              <TableHead className="text-muted-foreground text-right">Sales</TableHead>
              <TableHead className="text-muted-foreground text-right">Paid</TableHead>
              <TableHead className="text-muted-foreground text-right">Unpaid</TableHead>
              <TableHead className="text-muted-foreground text-center">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dsrLeaderboard.map((dsr) => (
              <TableRow key={dsr.id} className="border-border/50 hover:bg-secondary/30">
                <TableCell>
                  <span className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                    dsr.rank === 1 && 'bg-warning text-warning-foreground',
                    dsr.rank === 2 && 'bg-muted-foreground/50 text-foreground',
                    dsr.rank === 3 && 'bg-warning/40 text-foreground',
                    dsr.rank && dsr.rank > 3 && 'bg-secondary text-muted-foreground',
                  )}>
                    {dsr.rank}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-foreground">{dsr.name}</TableCell>
                <TableCell className="text-muted-foreground">{dsr.teamName}</TableCell>
                <TableCell className="text-right font-semibold text-foreground">{dsr.totalSales}</TableCell>
                <TableCell className="text-right text-success">{dsr.paidSales}</TableCell>
                <TableCell className="text-right text-destructive">{dsr.unpaidSales}</TableCell>
                <TableCell className="text-center">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    dsr.riskStatus === 'low' && 'bg-success/10 text-success',
                    dsr.riskStatus === 'medium' && 'bg-warning/10 text-warning',
                    dsr.riskStatus === 'high' && 'bg-destructive/10 text-destructive',
                  )}>
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      dsr.riskStatus === 'low' && 'bg-success',
                      dsr.riskStatus === 'medium' && 'bg-warning',
                      dsr.riskStatus === 'high' && 'bg-destructive',
                    )} />
                    {dsr.riskStatus.charAt(0).toUpperCase() + dsr.riskStatus.slice(1)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
