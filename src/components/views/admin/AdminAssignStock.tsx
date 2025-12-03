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
  const [selectedZone, setSelectedZone] = useState('all');

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // -------------------------------
  // FETCH UNASSIGNED STOCK
  // -------------------------------
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
    },
  });

  // -------------------------------
  // FETCH TLs (Now with territory + zone)
  // -------------------------------
  const { data: teamLeaders = [] } = useQuery({
    queryKey: ['tls_for_assign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_leaders')
        .select(`
          id,
          user_id,
          territory_name,
          zone_name
        `);

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
    },
  });

  // -------------------------------
  // FETCH ZONES
  // -------------------------------
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // -------------------------------
  // ASSIGN STOCK MUTATION
  // -------------------------------
  const assignMutation = useMutation({
    mutationFn: async () => {
      const tl = teamLeaders.find(t => t.id === selectedTL);

      const updateData = {
        status: 'assigned-tl',
        assigned_to_tl: selectedTL,
        assigned_by: user?.id,
        territory_name: tl?.territory_name || null,
        zone_name: tl?.zone_name || null,
        date_assigned: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('stock')
        .update(updateData)
        .in('id', selectedStock);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned_stock'] });
      toast({
        title: 'Stock Assigned Successfully',
        description: `${selectedStock.length} items have been assigned.`,
      });
      setSelectedStock([]);
      setSelectedTL('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Assigning Stock',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------
  // SELECT HELPERS
  // -------------------------------
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

  // -------------------------------
  // FILTER TLs BY ZONE
  // -------------------------------
  const filteredTLs = selectedZone !== 'all'
    ? teamLeaders.filter(tl => tl.zone_name === selectedZone)
    : teamLeaders;

  // -------------------------------
  // UI RENDER
  // -------------------------------
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assign Stock</h1>
        <p className="text-muted-foreground">Assign unassigned stock to Team Leaders</p>
      </div>

      {/* FILTER CONTROLS */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex flex-wrap gap-4 items-end">

          {/* Zone Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium block mb-2">Filter by Zone</label>
            <Select
              value={selectedZone}
              onValueChange={(v) => {
                setSelectedZone(v);
                setSelectedTL('');
              }}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z.id} value={z.name}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* TL Selection */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium block mb-2">Assign to TL</label>
            <Select value={selectedTL} onValueChange={setSelectedTL}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Select Team Leader" />
              </SelectTrigger>
              <SelectContent>
                {filteredTLs.map(tl => (
                  <SelectItem key={tl.id} value={tl.id}>
                    {tl.profile?.full_name} — {tl.territory_name} ({tl.zone_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assign Button */}
          <Button
            disabled={selectedStock.length === 0 || !selectedTL || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
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

      {/* STOCK TABLE */}
      <div className="glass rounded-xl border border-border/50">
        <div className="p-5 border-b border-border/50 flex justify-between items-center">
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
            <p>No unassigned stock available</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedStock.length === stock.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Stock ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {stock.map(item => (
                <TableRow
                  key={item.id}
                  className={`cursor-pointer border-border/50 ${
                    selectedStock.includes(item.id) ? 'bg-primary/10' : 'hover:bg-secondary/30'
                  }`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedStock.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{item.stock_id}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.batch?.batch_number || '-'}</TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
