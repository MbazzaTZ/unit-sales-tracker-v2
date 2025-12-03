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
  const [serialNumber, setSerialNumber] = useState('');
  const [smartcardNumber, setSmartcardNumber] = useState('');
  const [manualType, setManualType] = useState('');
  const [selectedTL, setSelectedTL] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
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
      // Fetch stock with batch info only
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select('*, batch:stock_batches(batch_number)')
        .order('created_at', { ascending: false });
      
      if (stockError) throw stockError;
      if (!stockData || stockData.length === 0) return [];
      
      // Get unique region IDs
      const regionIds = stockData
        .map(s => s.region_id)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);
      
      // Fetch regions
      let regionMap: Record<string, any> = {};
      if (regionIds.length > 0) {
        const { data: regionsData } = await supabase
          .from('regions')
          .select('id, name, code')
          .in('id', regionIds);
        
        if (regionsData) {
          regionsData.forEach(r => {
            regionMap[r.id] = r;
          });
        }
      }
      
      // Get unique TL IDs
      const tlIds = stockData
        .map(s => s.assigned_to_tl)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);
      
      if (tlIds.length === 0) return stockData;
      
      // Fetch team leaders separately
      const { data: tls, error: tlError } = await supabase
        .from('team_leaders')
        .select('id, user_id')
        .in('id', tlIds);
      
      if (tlError) {
        console.error('Error fetching team leaders:', tlError);
        return stockData;
      }
      
      // Get user IDs for profiles
      const userIds = tls?.map(tl => tl.user_id).filter(Boolean) || [];
      
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        if (!profileError && profileData) {
          profiles = profileData;
        }
      }
      
      // Merge data
      return stockData.map(stock => {
        const result: any = { ...stock };
        
        // Add region info
        if (stock.region_id && regionMap[stock.region_id]) {
          result.region = regionMap[stock.region_id];
        }
        
        // Add TL info
        if (stock.assigned_to_tl) {
          const tl = tls?.find(t => t.id === stock.assigned_to_tl);
          if (tl) {
            const profile = profiles.find(p => p.id === tl.user_id);
            result.assigned_tl = {
              id: tl.id,
              profiles: profile || null
            };
          }
        }
        
        return result;
      });
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
      // First get team leaders
      const { data: tls, error: tlError } = await supabase
        .from('team_leaders')
        .select('id, user_id')
        .order('created_at', { ascending: false });
      
      if (tlError) throw tlError;
      if (!tls || tls.length === 0) return [];
      
      // Then get profiles for those user_ids
      const userIds = tls.map(tl => tl.user_id).filter(Boolean);
      if (userIds.length === 0) return tls;
      
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return tls;
      }
      
      // Merge profiles with team leaders
      return tls.map(tl => ({
        ...tl,
        profiles: profiles?.find(p => p.id === tl.user_id) || null
      }));
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

  // Create or get batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (batchNum: string) => {
      // First check if batch exists
      const { data: existingBatch, error: checkError } = await supabase
        .from('stock_batches')
        .select('*')
        .eq('batch_number', batchNum)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      // If batch exists, return it
      if (existingBatch) {
        console.log(`Batch "${batchNum}" already exists, using existing batch`);
        return existingBatch;
      }
      
      // Otherwise create new batch
      const { data, error } = await supabase
        .from('stock_batches')
        .insert({ batch_number: batchNum })
        .select()
        .single();
      
      if (error) throw error;
      console.log(`Created new batch "${batchNum}"`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_batches'] });
    }
  });

  // Update stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('stock')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'Stock updated successfully' });
      setIsEditOpen(false);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating stock', description: error.message, variant: 'destructive' });
    }
  });

  // Delete stock mutation
  const deleteStockMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('stock')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: `${ids.length} item(s) deleted successfully` });
      setSelectedItems(new Set());
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting stock', description: error.message, variant: 'destructive' });
    }
  });

  // Add single stock mutation
  const addStockMutation = useMutation({
    mutationFn: async (stockData: { 
      stock_id?: string; 
      type: string;
      serial_number?: string;
      smartcard_number?: string;
      assigned_to_tl?: string;
      region_id?: string;
      status?: string;
      assigned_by?: string;
      date_assigned?: string;
      batch_id?: string;
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
      setSerialNumber('');
      setSmartcardNumber('');
      setManualType('');
      setSelectedTL('');
      setSelectedRegion('');
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
        // stock_id will be auto-generated based on type (e.g., FS2025-000001)
        serial_number: item.serial_number,
        smartcard_number: item.smartcard_number && item.smartcard_number.trim() !== '' ? item.smartcard_number : null,
        type: item.type,
        batch_id: batchId,
        region_id: item.region ? regionMap[item.region] : null,
        status: 'unassigned'
      }));
      
      // Debug: Log upload info
      console.log(`Uploading ${stockItems.length} items to batch ${batchId}`);

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
    if (!manualType) {
      toast({ title: 'Please select Stock Type', variant: 'destructive' });
      return;
    }
    
    const stockData: any = {
      type: manualType,
      status: 'unassigned' // Default status
    };
    
    // Add stock_id if provided, otherwise will be auto-generated
    if (manualStockId && manualStockId.trim()) {
      stockData.stock_id = manualStockId;
    }

    // Add optional fields
    if (serialNumber) stockData.serial_number = serialNumber;
    if (smartcardNumber) stockData.smartcard_number = smartcardNumber;
    if (selectedTL && selectedTL !== 'none') {
      stockData.assigned_to_tl = selectedTL;
      stockData.status = 'assigned-tl';
      stockData.assigned_by = currentUser?.id;
      stockData.date_assigned = new Date().toISOString();
    }
    if (selectedRegion && selectedRegion !== 'none') stockData.region_id = selectedRegion;
    
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
          // Log first row to help debug column names
          if (index === 0) {
            console.log('Excel columns found:', Object.keys(row));
          }
          
          const batchNum = row['Batch Number'] || row['Batch ID'] || row['batch_number'] || row['batch_id'] || row['BatchNumber'] || row['Batch'] || '';
          const serialNum = row['Serial Number'] || row['serial_number'] || row['SerialNumber'] || row['SN'] || row['Stock ID'] || row['stock_id'] || row['Serial'] || row['SERIAL NUMBER'] || row['SERIAL_NUMBER'] || '';
          const smartcardNum = row['Smartcard Number'] || row['Smart Card'] || row['smartcard_number'] || row['SmartcardNumber'] || row['SC'] || row['Smartcard'] || row['SMARTCARD NUMBER'] || row['SMARTCARD_NUMBER'] || '';
          const stockType = row['Type'] || row['type'] || row['Stock Type'] || row['stock_type'] || row['TYPE'] || '';
          const region = row['Region'] || row['region'] || row['Territory'] || row['territory'] || row['REGION'] || '';
          
          if (!serialNum || serialNum.toString().trim() === '') {
            console.warn(`Row ${index + 2}: Missing serial number. Available columns:`, Object.keys(row));
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
          
          // Properly handle smartcard number - convert empty strings to empty for display
          const trimmedSmartcard = smartcardNum ? smartcardNum.toString().trim() : '';
          
          return {
            batch_number: batchNum ? batchNum.toString().trim() : '',
            serial_number: serialNum.toString().trim(),
            smartcard_number: trimmedSmartcard,
            type: type,
            region: region ? region.toString().trim() : '',
            territory: region ? region.toString().trim() : ''
          };
        }).filter(item => item !== null) as typeof csvData;
        
        if (parsedData.length === 0) {
          toast({ 
            title: 'No valid data found', 
            description: 'Excel must have: Serial Number (required), Smartcard Number, Type, Batch Number, Region (all optional)',
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
        
        // Debug: Log sample data
        console.log('Sample parsed data (first 3 rows):', parsedData.slice(0, 3));
        
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

  const handleSelectAll = () => {
    if (selectedItems.size === stock.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(stock.map((item: any) => item.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setManualStockId(item.stock_id || '');
    setSerialNumber(item.serial_number || '');
    setSmartcardNumber(item.smartcard_number || '');
    setManualType(item.type || '');
    setSelectedRegion(item.region_id || '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editingItem) return;
    
    const updates: any = {
      type: manualType,
    };
    
    if (manualStockId) updates.stock_id = manualStockId;
    if (serialNumber) updates.serial_number = serialNumber;
    if (smartcardNumber) updates.smartcard_number = smartcardNumber;
    if (selectedRegion && selectedRegion !== 'none') updates.region_id = selectedRegion;
    
    updateStockMutation.mutate({ id: editingItem.id, updates });
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) {
      toast({ title: 'No items selected', variant: 'destructive' });
      return;
    }
    
    if (confirm(`Delete ${selectedItems.size} item(s)?`)) {
      deleteStockMutation.mutate(Array.from(selectedItems));
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

                <div className="space-y-2">
                  <Label>Stock ID (Optional)</Label>
                  <Input
                    placeholder="Leave empty for auto-generation"
                    value={manualStockId}
                    onChange={(e) => setManualStockId(e.target.value)}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">Auto-generated as TYPE+YEAR-NNNNNN (e.g., FS2025-000001) if left empty</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Serial Number</Label>
                    <Input
                      placeholder="e.g., SN-789012"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Smartcard Number</Label>
                    <Input
                      placeholder="e.g., SC-123456"
                      value={smartcardNumber}
                      onChange={(e) => setSmartcardNumber(e.target.value)}
                      className="bg-secondary/50"
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
                        <p className="text-xs text-muted-foreground">Required: Serial Number • Optional: Smartcard Number, Type, Region</p>
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
                          <TableHead className="text-xs">Serial Number</TableHead>
                          <TableHead className="text-xs">Smartcard</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Region</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 5).map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{item.serial_number}</TableCell>
                            <TableCell className="text-xs font-mono">{item.smartcard_number || '-'}</TableCell>
                            <TableCell className="text-xs">{item.type}</TableCell>
                            <TableCell className="text-xs">{item.region || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {csvData.length > 5 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-xs text-center text-muted-foreground">
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">All Stock Items</h2>
              <p className="text-sm text-muted-foreground">Total: {totalStock} items • Selected: {selectedItems.size}</p>
            </div>
            {selectedItems.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={deleteStockMutation.isPending}
              >
                {deleteStockMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Delete Selected
              </Button>
            )}
          </div>
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
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={stock.length > 0 && selectedItems.size === stock.length}
                      onChange={handleSelectAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="text-muted-foreground">Stock ID</TableHead>
                  <TableHead className="text-muted-foreground">Serial Number</TableHead>
                  <TableHead className="text-muted-foreground">Smartcard</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Region</TableHead>
                  <TableHead className="text-muted-foreground">Batch</TableHead>
                  <TableHead className="text-muted-foreground">Assigned To</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Created</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((item: any) => (
                  <TableRow key={item.id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium text-foreground">
                      {item.stock_id || 'N/A'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {item.serial_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {item.smartcard_number || '-'}
                    </TableCell>
                    <TableCell className="text-foreground">
                      <Badge variant="outline">{item.type}</Badge>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {item.region ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.region.name}</span>
                          <span className="text-xs text-muted-foreground">{item.region.code}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Stock Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass border-border/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Stock Item</DialogTitle>
            <DialogDescription>Update stock details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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

            <div className="space-y-2">
              <Label>Stock ID</Label>
              <Input
                placeholder="Stock ID"
                value={manualStockId}
                onChange={(e) => setManualStockId(e.target.value)}
                className="bg-secondary/50"
                disabled
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  placeholder="e.g., SN-789012"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Smartcard Number</Label>
                <Input
                  placeholder="e.g., SC-123456"
                  value={smartcardNumber}
                  onChange={(e) => setSmartcardNumber(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Region</Label>
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

            <Button 
              className="w-full" 
              onClick={handleEditSubmit}
              disabled={updateStockMutation.isPending}
            >
              {updateStockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}