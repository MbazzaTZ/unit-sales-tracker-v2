import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package, 
  Upload, 
  Plus, 
  FileSpreadsheet,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const STOCK_TYPES = ['DSTV HD', 'DSTV SD', 'DSTV Explora', 'DSTV Streama', 'GOtv'];

const statusConfig: Record<string, { label: string; className: string }> = {
  'unassigned': { label: 'Unassigned', className: 'bg-muted text-muted-foreground' },
  'assigned-tl': { label: 'Assigned to TL', className: 'bg-info/10 text-info' },
  'assigned-team': { label: 'Assigned to Team', className: 'bg-warning/10 text-warning' },
  'assigned-dsr': { label: 'Assigned to DSR', className: 'bg-primary/10 text-primary' },
  'sold-paid': { label: 'Sold (Paid)', className: 'bg-success/10 text-success' },
  'sold-unpaid': { label: 'Sold (Unpaid)', className: 'bg-destructive/10 text-destructive' },
};

export function AdminStockManagement() {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [manualStockId, setManualStockId] = useState('');
  const [manualType, setManualType] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [csvData, setCsvData] = useState<{ stock_id: string; type: string }[]>([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stock
  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          *,
          batch:stock_batches(batch_number)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['stock_batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_batches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Create batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (batchNum: string) => {
      const { data, error } = await supabase
        .from('stock_batches')
        .insert({ batch_number: batchNum })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_batches'] });
    }
  });

  // Add single stock mutation
  const addStockMutation = useMutation({
    mutationFn: async ({ stockId, type, batchId }: { stockId: string; type: string; batchId?: string }) => {
      const { error } = await supabase
        .from('stock')
        .insert({ stock_id: stockId, type, batch_id: batchId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'Stock added successfully' });
      setManualStockId('');
      setManualType('');
      setIsManualOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding stock', description: error.message, variant: 'destructive' });
    }
  });

  // Bulk add stock mutation
  const bulkAddStockMutation = useMutation({
    mutationFn: async ({ items, batchId }: { items: { stock_id: string; type: string }[]; batchId: string }) => {
      const stockItems = items.map(item => ({
        stock_id: item.stock_id,
        type: item.type,
        batch_id: batchId
      }));
      
      const { error } = await supabase.from('stock').insert(stockItems);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'Stock uploaded successfully', description: `${csvData.length} items added` });
      setCsvData([]);
      setBatchNumber('');
      setIsBatchOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error uploading stock', description: error.message, variant: 'destructive' });
    }
  });

  const handleManualSubmit = async () => {
    if (!manualStockId || !manualType) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    
    addStockMutation.mutate({ stockId: manualStockId, type: manualType });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingCsv(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        const stockIdIndex = headers.findIndex(h => h.includes('stock') || h.includes('id'));
        const typeIndex = headers.findIndex(h => h.includes('type'));
        
        if (stockIdIndex === -1 || typeIndex === -1) {
          toast({ 
            title: 'Invalid CSV format', 
            description: 'CSV must have columns for stock_id and type',
            variant: 'destructive' 
          });
          return;
        }
        
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          return {
            stock_id: values[stockIdIndex],
            type: values[typeIndex]
          };
        }).filter(item => item.stock_id && item.type);
        
        setCsvData(data);
        toast({ title: `${data.length} items parsed from CSV` });
      } catch {
        toast({ title: 'Error parsing CSV', variant: 'destructive' });
      } finally {
        setIsProcessingCsv(false);
      }
    };
    
    reader.readAsText(file);
  };

  const handleBatchUpload = async () => {
    if (!batchNumber || csvData.length === 0) {
      toast({ title: 'Please provide batch number and upload CSV', variant: 'destructive' });
      return;
    }
    
    try {
      const batch = await createBatchMutation.mutateAsync(batchNumber);
      await bulkAddStockMutation.mutateAsync({ items: csvData, batchId: batch.id });
    } catch (error) {
      console.error('Batch upload error:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Management</h1>
          <p className="text-muted-foreground">Upload and manage stock inventory</p>
        </div>
        
        <div className="flex gap-3">
          {/* Manual Entry Dialog */}
          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Single
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border/50">
              <DialogHeader>
                <DialogTitle>Add Single Stock Item</DialogTitle>
                <DialogDescription>Enter stock details manually</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Stock ID</Label>
                  <Input
                    placeholder="e.g., STK-1001"
                    value={manualStockId}
                    onChange={(e) => setManualStockId(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={manualType} onValueChange={setManualType}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleManualSubmit}
                  disabled={addStockMutation.isPending}
                >
                  {addStockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Stock
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Batch Upload Dialog */}
          <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border/50 max-w-2xl">
              <DialogHeader>
                <DialogTitle>Batch Stock Upload</DialogTitle>
                <DialogDescription>Upload multiple stock items via CSV file</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input
                    placeholder="e.g., B-2024-12"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>CSV File</Label>
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isProcessingCsv ? (
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                    ) : csvData.length > 0 ? (
                      <div className="space-y-2">
                        <Check className="h-8 w-8 mx-auto text-success" />
                        <p className="text-foreground font-medium">{csvData.length} items ready</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">Click to upload CSV</p>
                        <p className="text-xs text-muted-foreground">Columns: stock_id, type</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>

                {csvData.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Stock ID</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 5).map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{item.stock_id}</TableCell>
                            <TableCell className="text-xs">{item.type}</TableCell>
                          </TableRow>
                        ))}
                        {csvData.length > 5 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-xs text-center text-muted-foreground">
                              ...and {csvData.length - 5} more
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={handleBatchUpload}
                  disabled={bulkAddStockMutation.isPending || csvData.length === 0}
                >
                  {bulkAddStockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Upload {csvData.length} Items
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Total Stock</p>
          <p className="text-2xl font-bold text-foreground">{stock.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Unassigned</p>
          <p className="text-2xl font-bold text-info">{stock.filter(s => s.status === 'unassigned').length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Assigned</p>
          <p className="text-2xl font-bold text-warning">
            {stock.filter(s => s.status?.startsWith('assigned')).length}
          </p>
        </div>
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Sold</p>
          <p className="text-2xl font-bold text-success">
            {stock.filter(s => s.status?.startsWith('sold')).length}
          </p>
        </div>
      </div>

      {/* Stock Table */}
      <div className="glass rounded-xl border border-border/50">
        <div className="p-5 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">All Stock</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : stock.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No stock items yet</p>
            <p className="text-sm text-muted-foreground">Add stock manually or upload a CSV</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Stock ID</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Batch</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((item) => (
                <TableRow key={item.id} className="border-border/50 hover:bg-secondary/30">
                  <TableCell className="font-mono font-medium text-foreground">{item.stock_id}</TableCell>
                  <TableCell className="text-foreground">{item.type}</TableCell>
                  <TableCell className="text-muted-foreground">{item.batch?.batch_number || '-'}</TableCell>
                  <TableCell>
                    <Badge className={cn('font-medium', statusConfig[item.status || 'unassigned']?.className)}>
                      {statusConfig[item.status || 'unassigned']?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
