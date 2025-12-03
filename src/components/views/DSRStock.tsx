import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Package, 
  Check, 
  X, 
  ShoppingCart,
  Filter,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StockItem {
  id: string;
  stock_id: string;
  type: string;
  batch: string;
  status: string;
  date: string;
  assignedBy?: string;
  smartcardNumber?: string;
  quantity: number;
}

interface DSRStockProps {
  onNavigate?: (tab: string) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  'unassigned': { label: 'Unassigned', className: 'bg-gray-500/10 text-gray-500' },
  'assigned-tl': { label: 'Assigned to TL', className: 'bg-blue-500/10 text-blue-500' },
  'assigned-team': { label: 'Assigned to Team', className: 'bg-indigo-500/10 text-indigo-500' },
  'assigned-dsr': { label: 'In Hand', className: 'bg-info/10 text-info' },
  'sold-paid': { label: 'Sold (Paid)', className: 'bg-success/10 text-success' },
  'sold-unpaid': { label: 'Sold (Unpaid)', className: 'bg-destructive/10 text-destructive' },
};

type FilterType = 'all' | 'in-hand' | 'paid' | 'unpaid' | 'new';

export function DSRStock({ onNavigate }: DSRStockProps = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dsrId, setDsrId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [newStockAssigned, setNewStockAssigned] = useState<StockItem[]>([]);
  const [myStock, setMyStock] = useState<StockItem[]>([]);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (user) {
      fetchStockData();
    }
  }, [user]);

  async function fetchStockData() {
    if (!user) return;

    try {
      setLoading(true);

      // Get DSR record
      const { data: dsrData, error: dsrError } = await supabase
        .from('dsrs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dsrError) throw dsrError;
      
      if (!dsrData) {
        console.log('No DSR record found for user');
        setLoading(false);
        return;
      }
      
      setDsrId(dsrData.id);

      // Fetch stock assigned to this DSR
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          type,
          status,
          created_at,
          date_assigned,
          assigned_by,
          batch_id,
          stock_batches (
            batch_number
          )
        `)
        .eq('assigned_to_dsr', dsrData.id)
        .order('created_at', { ascending: false });

      if (stockError) throw stockError;

      // Get unique assigned_by user IDs
      const assignedByIds = [...new Set(stockData?.map(s => s.assigned_by).filter(Boolean))];
      let assignedByNames: Record<string, string> = {};
      
      if (assignedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', assignedByIds);
        
        assignedByNames = Object.fromEntries(
          profiles?.map(p => [p.id, p.full_name]) || []
        );
      }

      // Transform data
      const transformedStock: StockItem[] = (stockData || []).map((item: any) => ({
        id: item.id,
        stock_id: item.stock_id || item.id,
        type: item.type || 'Unknown',
        batch: item.stock_batches?.batch_number || 'N/A',
        smartcardNumber: 'N/A',
        status: item.status,
        date: item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : new Date(item.created_at).toLocaleDateString(),
        quantity: 1,
        assignedBy: assignedByNames[item.assigned_by] || 'Admin',
      }));

      // All assigned-dsr stock is available for sale (no separate new/accepted states)
      setNewStockAssigned([]);
      setMyStock(transformedStock);

    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }

  const filteredStock = myStock.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'in-hand') return item.status === 'assigned-dsr';
    if (filter === 'paid') return item.status === 'sold-paid';
    if (filter === 'unpaid') return item.status === 'sold-unpaid';
    if (filter === 'new') return false; // No separate new status
    return true;
  });

  const handleAcceptStock = async (item: StockItem) => {
    // No longer needed - stock is automatically available
    toast.info('Stock is already available for sale');
  };

  const handleRejectStock = (item: StockItem) => {
    setSelectedStock(item);
    setIsRejectDialogOpen(true);
  };

  const confirmRejectStock = async () => {
    if (!selectedStock) return;
    
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      // Update stock status back to assigned-tl with rejection note
      const { error } = await supabase
        .from('stock')
        .update({ 
          status: 'assigned-tl',
          notes: `Rejected by DSR: ${rejectReason}`
        })
        .eq('id', selectedStock.stock_id);

      if (error) throw error;

      // Remove from new stock
      setNewStockAssigned(newStockAssigned.filter(stock => stock.id !== selectedStock.id));
      toast.success(`Stock rejected. Reason sent to TL.`);
      
    } catch (error: any) {
      console.error('Error rejecting stock:', error);
      toast.error(error.message || 'Failed to reject stock');
    } finally {
      // Reset and close
      setIsRejectDialogOpen(false);
      setSelectedStock(null);
      setRejectReason('');
    }
  };

  const handleSellStock = (item: StockItem) => {
    if (onNavigate) {
      // Navigate to add sale page with pre-filled stock info
      toast.info(`Opening sale form for ${item.smartcardNumber}`);
      onNavigate('add-sale');
    } else {
      toast.info(`Sell stock ${item.id} - ${item.smartcardNumber}`);
    }
  };

  const getStockCount = () => {
    const inHand = myStock.filter(s => s.status === 'assigned-dsr').length;
    const soldPaid = myStock.filter(s => s.status === 'sold-paid').length;
    const soldUnpaid = myStock.filter(s => s.status === 'sold-unpaid').length;
    return { inHand, soldPaid, soldUnpaid, total: inHand + soldPaid + soldUnpaid };
  };

  const stockCount = getStockCount();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onNavigate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Stock</h1>
            <p className="text-muted-foreground">Manage your assigned stock items</p>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{stockCount.inHand}</p>
            <p className="text-muted-foreground">In Hand</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{stockCount.soldPaid}</p>
            <p className="text-muted-foreground">Sold (Paid)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-danger">{stockCount.soldUnpaid}</p>
            <p className="text-muted-foreground">Unpaid</p>
          </div>
        </div>
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
                      {item.type} • {item.smartcardNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Batch: {item.batch} • Assigned by: {item.assignedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    className="bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleAcceptStock(item)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => handleRejectStock(item)}
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
                {f === 'all' ? 'All' : f === 'in-hand' ? 'In Hand' : f === 'paid' ? 'Paid' : 'Unpaid'}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Smartcard</TableHead>
              <TableHead className="text-muted-foreground">Batch</TableHead>
              <TableHead className="text-muted-foreground">Quantity</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No stock items found
                </TableCell>
              </TableRow>
            ) : (
              filteredStock.map((item) => (
                <TableRow key={item.id} className="border-border/50 hover:bg-secondary/30">
                  <TableCell className="text-foreground font-medium">{item.type}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{item.smartcardNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{item.batch}</TableCell>
                  <TableCell className="text-foreground font-medium">{item.quantity}</TableCell>
                  <TableCell>
                    <Badge className={cn('font-medium', statusConfig[item.status].className)}>
                      {statusConfig[item.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.date}</TableCell>
                  <TableCell className="text-right">
                    {item.status === 'in-hand' && (
                      <Button 
                        size="sm" 
                        className="bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => handleSellStock(item)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Sell
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject Stock Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Stock Assignment</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this stock assignment. This will be sent to your Team Leader.
            </DialogDescription>
          </DialogHeader>
          
          {selectedStock && (
            <div className="space-y-4">
              <div className="p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <p className="font-medium text-foreground">Stock Details</p>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium">ID:</span> {selectedStock.id}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Type:</span> {selectedStock.type}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Smartcard:</span> {selectedStock.smartcardNumber}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Batch:</span> {selectedStock.batch}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="rejectReason">Reason for Rejection *</Label>
                <Textarea
                  id="rejectReason"
                  placeholder="E.g., Already have similar stock, Prefer different type, etc."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setSelectedStock(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejectStock}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
