import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function AdminAssignStock() {
  const [selectedStock, setSelectedStock] = useState<string[]>([]);
  const [selectedTL, setSelectedTL] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unassigned stock
  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['unassigned_stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select(`*, batch:stock_batches(batch_number)`)
        .eq('status', 'unassigned')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch TLs
  const { data: teamLeaders = [] } = useQuery({
    queryKey: ['team_leaders_for_assign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_leaders')
        .select(`id, user_id, region:regions(id, name, code)`);
      
      if (error) throw error;
      
      const userIds = data.map(tl => tl.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      return data.map(tl => ({
        ...tl,
        profile: profiles?.find(p => p.id === tl.user_id)
      }));
    }
  });

  // Fetch regions
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regions').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Assign stock mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      const tl = teamLeaders.find(t => t.id === selectedTL);
      
      const { error } = await supabase
        .from('stock')
        .update({
          status: 'assigned-tl',
          assigned_to_tl: selectedTL,
          assigned_by: user?.id,
          region_id: tl?.region?.id || (selectedRegion !== 'all' ? selectedRegion : null) || null,
          date_assigned: new Date().toISOString()
        })
        .in('id', selectedStock);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'Stock assigned successfully', description: `${selectedStock.length} items assigned` });
      setSelectedStock([]);
      setSelectedTL('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error assigning stock', description: error.message, variant: 'destructive' });
    }
  });

  const toggleSelect = (id: string) => {
    setSelectedStock(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStock.length === stock.length) {
      setSelectedStock([]);
    } else {
      setSelectedStock(stock.map(s => s.id));
    }
  };

  const filteredTLs = selectedRegion && selectedRegion !== 'all'
    ? teamLeaders.filter(tl => tl.region?.id === selectedRegion)
    : teamLeaders;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assign Stock</h1>
        <p className="text-muted-foreground">Assign unassigned stock to Team Leaders</p>
      </div>

      {/* Assignment Controls */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Filter by Region</label>
            <Select value={selectedRegion} onValueChange={(v) => { setSelectedRegion(v); setSelectedTL(''); }}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Assign to TL</label>
            <Select value={selectedTL} onValueChange={setSelectedTL}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Select TL" />
              </SelectTrigger>
              <SelectContent>
                {filteredTLs.map(tl => (
                  <SelectItem key={tl.id} value={tl.id}>
                    {tl.profile?.full_name} {tl.region && `(${tl.region.code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={() => assignMutation.mutate()}
            disabled={selectedStock.length === 0 || !selectedTL || assignMutation.isPending}
            className="gap-2"
          >
            {assignMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Assign {selectedStock.length > 0 && `(${selectedStock.length})`}
          </Button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="glass rounded-xl border border-border/50">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Unassigned Stock</h2>
          <Badge variant="outline">{stock.length} items</Badge>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : stock.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No unassigned stock</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedStock.length === stock.length && stock.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-muted-foreground">Stock ID</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Batch</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((item) => (
                <TableRow 
                  key={item.id} 
                  className={`border-border/50 cursor-pointer ${selectedStock.includes(item.id) ? 'bg-primary/10' : 'hover:bg-secondary/30'}`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedStock.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium text-foreground">{item.stock_id}</TableCell>
                  <TableCell className="text-foreground">{item.type}</TableCell>
                  <TableCell className="text-muted-foreground">{item.batch?.batch_number || '-'}</TableCell>
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
