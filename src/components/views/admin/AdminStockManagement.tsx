import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
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

const STOCK_TYPES = [
  { value: 'FS', label: 'Full Set (FS)' },
  { value: 'DO', label: 'Decoder Only (DO)' },
  { value: 'DVS', label: 'Digital Virtual Stock (DVS)' }
];

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
  const [smartcardNumber, setSmartcardNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedTL, setSelectedTL] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [territory, setTerritory] = useState('');
  const [subTerritory, setSubTerritory] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [csvData, setCsvData] = useState<{ 
    batch_number: string;
    serial_number: string; 
    smartcard_number: string; 
    type: string;
    region?: string;
    territory?: string;
  }[]>([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [uploadStats, setUploadStats] = useState({ total: 0, success: 0, failed: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  // Fetch stock
  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          *,
          batch:stock_batches!stock_batch_id_fkey (
            batch_number
          ),
          assigned_tl:team_leaders!stock_assigned_to_tl_fkey (
            id,
            profiles!team_leaders_user_id_fkey (
              full_name
            )
          )
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

  // Fetch team leaders
  const { data: teamLeaders = [] } = useQuery({
    queryKey: ['team_leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_leaders')
        .select(`
          id,
          user_id,
          profiles!team_leaders_user_id_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch regions
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('name');
      
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
    mutationFn: async (stockData: { 
      stock_id: string; 
      type: string; 
      smartcard_number?: string;
      serial_number?: string;
      assigned_to_tl?: string;
      region_id?: string;
      territory?: string;
      sub_territory?: string;
      batch_id?: string;
      status?: string;
      assigned_by?: string;
      date_assigned?: string;
    }) => {
      const { error } = await supabase
        .from('stock')
        .insert(stockData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'Stock added successfully' });
      // Reset form
      setManualStockId('');
      setManualType('');
      setSmartcardNumber('');
      setSerialNumber('');
      setSelectedTL('');
      setSelectedRegion('');
      setTerritory('');
      setSubTerritory('');
      setIsManualOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding stock', description: error.message, variant: 'destructive' });
    }
  });

  // Function to reset upload state
  const resetUploadState = () => {
    setCsvData([]);
    setBatchNumber('');
    setIsProcessingCsv(false);
    setIsUploading(false);
    setUploadStats({ total: 0, success: 0, failed: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input
    }
  };

  // Bulk add stock mutation
  const bulkAddStockMutation = useMutation({
    mutationFn: async ({ items, batchId }: { 
      items: { 
        batch_number?: string;
        serial_number: string; 
        smartcard_number?: string; 
        type: string;
        region?: string;
        territory?: string;
      }[]; 
      batchId: string 
    }) => {
      // Find region IDs for regions specified in Excel
      const regionNames = items
        .map(item => item.region)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i); // unique values
      
      const regionMap: Record<string, string> = {};
      if (regionNames.length > 0) {
        const { data: regionsData } = await supabase
          .from('regions')
          .select('id, name')
          .in('name', regionNames);
        
        regionsData?.forEach(r => {
          regionMap[r.name] = r.id;
        });
      }

      const stockItems = items.map(item => ({
        stock_id: item.serial_number, // Use serial number as stock_id
        serial_number: item.serial_number,
        smartcard_number: item.smartcard_number || null,
        type: item.type,
        batch_id: batchId,
        region_id: item.region ? regionMap[item.region] : null,
        territory: item.territory || null,
        status: 'unassigned'
      }));

      const { error } = await supabase
        .from('stock')
        .insert(stockItems);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ 
        title: '✅ Stock uploaded successfully', 
        description: `${variables.items.length} items added to batch ${batchNumber}` 
      });
      resetUploadState();
      setIsBatchOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error uploading stock', description: error.message, variant: 'destructive' });
    }
  });

  const handleManualSubmit = async () => {
    if (!manualStockId || !manualType) {
      toast({ title: 'Please fill required fields (Stock Type and Stock ID)', variant: 'destructive' });
      return;
    }
    
    const stockData: any = {
      stock_id: manualStockId,
      type: manualType,
      status: 'unassigned' // Default status
    };

    // Add optional fields
    if (smartcardNumber) stockData.smartcard_number = smartcardNumber;
    if (serialNumber) stockData.serial_number = serialNumber;
    if (selectedTL && selectedTL !== 'none') {
      stockData.assigned_to_tl = selectedTL;
      stockData.status = 'assigned-tl';
      stockData.assigned_by = currentUser?.id;
      stockData.date_assigned = new Date().toISOString();
    }
    if (selectedRegion && selectedRegion !== 'none') stockData.region_id = selectedRegion;
    if (territory) stockData.territory = territory;
    if (subTerritory) stockData.sub_territory = subTerritory;
    
    addStockMutation.mutate(stockData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous data
    setCsvData([]);
    setIsProcessingCsv(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        if (jsonData.length === 0) {
          toast({ title: 'No data found in file', variant: 'destructive' });
          setIsProcessingCsv(false);
          return;
        }
        
        // Map Excel columns (support multiple naming conventions)
        const parsedData = jsonData.map((row, index) => {
          const batchNum = row['Batch Number'] || row['Batch ID'] || row['batch_number'] || row['batch_id'] || row['BatchNumber'] || '';
          const serialNum = row['Serial Number'] || row['serial_number'] || row['SerialNumber'] || row['SN'] || row['Stock ID'] || row['stock_id'] || '';
          const smartcardNum = row['Smartcard Number'] || row['Smart Card'] || row['smartcard_number'] || row['SmartcardNumber'] || row['SC'] || '';
          const stockType = row['Type'] || row['type'] || row['Stock Type'] || row['stock_type'] || '';
          const region = row['Region'] || row['region'] || row['Territory'] || row['territory'] || '';
          
          if (!serialNum) {
            console.warn(`Row ${index + 2}: Missing serial number`);
            return null;
          }
          
          // Auto-detect type if not provided
          let type = stockType ? stockType.toString().toUpperCase() : '';
          if (!type || !['FS', 'DO', 'DVS'].includes(type)) {
            // Try to guess from serial number
            const sn = serialNum.toString().toUpperCase();
            if (sn.includes('FS')) type = 'FS';
            else if (sn.includes('DO')) type = 'DO';
            else if (sn.includes('DVS')) type = 'DVS';
            else type = 'FS'; // Default
          }
          
          return {
            batch_number: batchNum.toString().trim(),
            serial_number: serialNum.toString().trim(),
            smartcard_number: smartcardNum.toString().trim(),
            type: type,
            region: region.toString().trim(),
            territory: region.toString().trim()
          };
        }).filter(item => item !== null) as typeof csvData;
        
        if (parsedData.length === 0) {
          toast({ 
            title: 'No valid data found', 
            description: 'Excel must have: Serial Number (required), Batch Number, Smartcard Number, Type, Region/Territory',
            variant: 'destructive' 
          });
          setIsProcessingCsv(false);
          return;
        }
        
        // Auto-fill batch number from first row if not set
        if (parsedData[0]?.batch_number && !batchNumber) {
          setBatchNumber(parsedData[0].batch_number);
        }
        
        setCsvData(parsedData);
        toast({ 
          title: `✅ ${parsedData.length} items loaded`,
          description: `From ${file.name}`
        });
      } catch (error) {
        console.error('File parsing error:', error);
        toast({ 
          title: 'Error parsing file', 
          description: 'Please use Excel (.xlsx) or CSV format',
          variant: 'destructive' 
        });
      } finally {
        setIsProcessingCsv(false);
      }
    };
    
    reader.readAsBinaryString(file);
  };

  const handleBatchUpload = async () => {
    if (!batchNumber) {
      toast({ title: 'Please enter a batch number', variant: 'destructive' });
      return;
    }

    try {
      const batch = await createBatchMutation.mutateAsync(batchNumber);
      await bulkAddStockMutation.mutateAsync({ items: csvData, batchId: batch.id });
    } catch (error) {
      // Error handling is done in mutations
    }
  };

  // Calculate stats
  const totalStock = stock.length;
  const unassignedStock = stock.filter(s => s.status === 'unassigned').length;
  const assignedStock = stock.filter(s => s.status?.startsWith('assigned')).length;
  const soldStock = stock.filter(s => s.status?.startsWith('sold')).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="glass rounded-xl p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-7 w-7 text-primary" />
              Admin Stock Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage inventory and stock assignments</p>
          </div>
        </div>

        <div className="flex gap-3">
          {/* Manual Add Dialog */}
          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Manually
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Single Stock Item</DialogTitle>
                <DialogDescription>Enter stock details manually</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Required Fields */}
                <div className="space-y-2">
                  <Label>Stock Type <span className="text-destructive">*</span></Label>
                  <Select value={manualType} onValueChange={setManualType}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select stock type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Smart Card Number</Label>
                    <Input
                      placeholder="e.g., SC-123456"
                      value={smartcardNumber}
                      onChange={(e) => setSmartcardNumber(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Serial Number <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g., SN-789012"
                      value={manualStockId}
                      onChange={(e) => setManualStockId(e.target.value)}
                      className="bg-secondary/50"
                      required
                    />
                  </div>
                </div>

                {/* Assignment Fields */}
                <div className="space-y-2">
                  <Label>Assign TL (Optional)</Label>
                  <Select value={selectedTL} onValueChange={setSelectedTL}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select Team Leader" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Keep Unassigned)</SelectItem>
                      {teamLeaders.map((tl: any) => (
                        <SelectItem key={tl.id} value={tl.id}>
                          {tl.profiles?.full_name || 'Unknown TL'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assign Region (Optional)</Label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {regions.map((region: any) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name} ({region.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Territory (Optional)</Label>
                    <Input
                      placeholder="e.g., North"
                      value={territory}
                      onChange={(e) => setTerritory(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sub Territory (Optional)</Label>
                    <Input
                      placeholder="e.g., Downtown"
                      value={subTerritory}
                      onChange={(e) => setSubTerritory(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
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
          <Dialog open={isBatchOpen} onOpenChange={(open) => {
            setIsBatchOpen(open);
            if (!open) {
              // Reset state when dialog closes
              resetUploadState();
            }
          }}>
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
                  <Label>Batch Number <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., B-2024-12"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>CSV File <span className="text-destructive">*</span></Label>
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isProcessingCsv ? (
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                    ) : csvData.length > 0 ? (
                      <div className="space-y-2">
                        <Check className="h-8 w-8 mx-auto text-success" />
                        <p className="text-foreground font-medium">{csvData.length} items loaded</p>
                        <div className="flex gap-2 justify-center mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => {
                              e.stopPropagation();
                              resetUploadState();
                            }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Upload className="h-3 w-3 mr-1" />
                            Change File
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">Click to upload Excel/CSV</p>
                        <p className="text-xs text-muted-foreground">Columns: Batch Number, Serial Number, Smartcard Number, Type, Region/Territory</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
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
                          <TableHead className="text-xs">Batch #</TableHead>
                          <TableHead className="text-xs">Serial Number</TableHead>
                          <TableHead className="text-xs">Smartcard</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Region</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 5).map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{item.batch_number || '-'}</TableCell>
                            <TableCell className="text-xs font-mono">{item.serial_number}</TableCell>
                            <TableCell className="text-xs font-mono">{item.smartcard_number || '-'}</TableCell>
                            <TableCell className="text-xs">{item.type}</TableCell>
                            <TableCell className="text-xs">{item.region || item.territory || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {csvData.length > 5 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-xs text-center text-muted-foreground">
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
                  disabled={bulkAddStockMutation.isPending || csvData.length === 0 || createBatchMutation.isPending || !batchNumber}
                >
                  {(bulkAddStockMutation.isPending || createBatchMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {csvData.length} Items
                    </>
                  )}
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
          <p className="text-2xl font-bold text-foreground">{totalStock}</p>
          <p className="text-xs text-muted-foreground mt-1">All inventory items</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Unassigned</p>
          <p className="text-2xl font-bold text-info">{unassignedStock}</p>
          <p className="text-xs text-muted-foreground mt-1">Available for assignment</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Assigned</p>
          <p className="text-2xl font-bold text-warning">{assignedStock}</p>
          <p className="text-xs text-muted-foreground mt-1">To TLs/Teams/DSRs</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">Sold</p>
          <p className="text-2xl font-bold text-success">{soldStock}</p>
          <p className="text-xs text-muted-foreground mt-1">Completed transactions</p>
        </div>
      </div>

      {/* Stock Table */}
      <div className="glass rounded-xl border border-border/50">
        <div className="p-5 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">All Stock Items</h2>
          <p className="text-sm text-muted-foreground">Total: {totalStock} items</p>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-2">Loading stock data...</p>
          </div>
        ) : stock.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No stock items yet</p>
            <p className="text-sm text-muted-foreground">Add stock manually or upload a CSV</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Stock ID</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Batch</TableHead>
                  <TableHead className="text-muted-foreground">Assigned To</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((item: any) => (
                  <TableRow key={item.id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="font-mono font-medium text-foreground">
                      {item.stock_id || 'N/A'}
                    </TableCell>
                    <TableCell className="text-foreground">
                      <Badge variant="outline">{item.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.batch?.batch_number || '-'}
                    </TableCell>
                    <TableCell>
                      {item.assigned_tl?.profiles?.full_name ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.assigned_tl.profiles.full_name}</span>
                          <span className="text-xs text-muted-foreground">Team Leader</span>
                        </div>
                      ) : item.assigned_to_tl ? (
                        <span className="text-sm text-muted-foreground">TL: {item.assigned_to_tl.substring(0, 8)}...</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('font-medium', statusConfig[item.status || 'unassigned']?.className)}>
                        {statusConfig[item.status || 'unassigned']?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}