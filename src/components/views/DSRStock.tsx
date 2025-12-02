import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Package, 
  Check, 
  X, 
  ShoppingCart,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockItem {
  id: string;
  type: string;
  batch: string;
  status: 'in-hand' | 'sold-paid' | 'sold-unpaid';
  date: string;
  assignedBy?: string;
}

const newStockAssigned: StockItem[] = [
  { id: 'STK-1245', type: 'DSTV HD', batch: 'B-2024-12', status: 'in-hand', date: '2025-12-02', assignedBy: 'James Mwangi' },
  { id: 'STK-1246', type: 'DSTV HD', batch: 'B-2024-12', status: 'in-hand', date: '2025-12-02', assignedBy: 'James Mwangi' },
];

const myStock: StockItem[] = [
  { id: 'STK-1001', type: 'DSTV HD', batch: 'B-2024-11', status: 'in-hand', date: '2025-11-28' },
  { id: 'STK-1002', type: 'DSTV SD', batch: 'B-2024-11', status: 'in-hand', date: '2025-11-28' },
  { id: 'STK-1003', type: 'DSTV HD', batch: 'B-2024-11', status: 'sold-paid', date: '2025-11-25' },
  { id: 'STK-1004', type: 'DSTV Explora', batch: 'B-2024-10', status: 'sold-paid', date: '2025-11-20' },
  { id: 'STK-1005', type: 'DSTV HD', batch: 'B-2024-10', status: 'sold-unpaid', date: '2025-11-18' },
  { id: 'STK-1006', type: 'DSTV SD', batch: 'B-2024-10', status: 'in-hand', date: '2025-11-15' },
];

const statusConfig = {
  'in-hand': { label: 'In Hand', className: 'bg-info/10 text-info' },
  'sold-paid': { label: 'Sold (Paid)', className: 'bg-success/10 text-success' },
  'sold-unpaid': { label: 'Sold (Unpaid)', className: 'bg-destructive/10 text-destructive' },
};

type FilterType = 'all' | 'in-hand' | 'paid' | 'unpaid';

export function DSRStock() {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredStock = myStock.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'in-hand') return item.status === 'in-hand';
    if (filter === 'paid') return item.status === 'sold-paid';
    if (filter === 'unpaid') return item.status === 'sold-unpaid';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Stock</h1>
        <p className="text-muted-foreground">Manage your assigned stock items</p>
      </div>

      {/* New Stock Assigned Section */}
      {newStockAssigned.length > 0 && (
        <div className="glass rounded-xl p-5 border border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">New Stock Assigned</h2>
            <Badge variant="outline" className="ml-auto border-warning text-warning">
              {newStockAssigned.length} new
            </Badge>
          </div>

          <div className="space-y-3">
            {newStockAssigned.map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.type} • Batch: {item.batch}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assigned by: {item.assignedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Stock Table */}
      <div className="glass rounded-xl border border-border/50">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">My Stock</h2>
          
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {(['all', 'in-hand', 'paid', 'unpaid'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                  filter === f 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'all' ? 'All' : f.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground">Stock ID</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Batch</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStock.map((item) => (
              <TableRow key={item.id} className="border-border/50 hover:bg-secondary/30">
                <TableCell className="font-mono font-medium text-foreground">{item.id}</TableCell>
                <TableCell className="text-foreground">{item.type}</TableCell>
                <TableCell className="text-muted-foreground">{item.batch}</TableCell>
                <TableCell>
                  <Badge className={cn('font-medium', statusConfig[item.status].className)}>
                    {statusConfig[item.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.date}</TableCell>
                <TableCell className="text-right">
                  {item.status === 'in-hand' && (
                    <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground">
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Sell
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
