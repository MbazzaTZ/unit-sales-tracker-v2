import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Package, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Stock {
  id: string;
  stock_id: string;
  type: string;
  status: string;
  assigned_to_dsr?: string;
  assigned_to_team?: string;
  assigned_to_tl?: string;
  batch_id?: string;
  created_at: string;
  batch?: {
    batch_number: string;
  };
  dsr?: {
    dsr_number: string;
    profiles?: {
      full_name: string;
    };
  };
  team?: {
    name: string;
  };
}

interface DSR {
  id: string;
  dsr_number: string;
  user_id: string;
  profile?: {
    full_name: string;
    email: string;
  };
}

export function TLStockManagement() {
  const { user } = useAuth();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assigningStock, setAssigningStock] = useState<Stock | null>(null);
  const [assignFormData, setAssignFormData] = useState({
    dsr_id: '',
    quantity: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    try {
      setLoading(true);

      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, region_id')
        .eq('user_id', user?.id)
        .single();

      if (!tlData) {
        console.error('TL record not found');
        return;
      }

      // Fetch teams under this TL
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('tl_id', tlData.id);

      setTeams(teamsData || []);

      // Fetch DSRs under this TL
      const { data: dsrsData } = await supabase
        .from('dsrs')
        .select('*')
        .eq('tl_id', tlData.id);

      // Fetch profiles for DSRs
      if (dsrsData && dsrsData.length > 0) {
        const userIds = dsrsData.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const dsrsWithProfiles = dsrsData.map(dsr => ({
          ...dsr,
          profile: profiles?.find(p => p.id === dsr.user_id)
        }));

        setDsrs(dsrsWithProfiles as any);
      } else {
        setDsrs([]);
      }

      // Fetch stock assigned to this TL or their teams/DSRs
      const { data: stockData, error } = await supabase
        .from('stock')
        .select(`
          *,
          batch:stock_batches(batch_number)
        `)
        .eq('assigned_to_tl', tlData.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stock:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch stock: ' + error.message,
        });
      }

      console.log('Stock fetched for TL:', tlData.id, stockData);
      
      // Manually fetch DSR and team info if needed
      if (stockData && stockData.length > 0) {
        // Get DSR info for assigned stock
        const dsrIds = stockData
          .filter(s => s.assigned_to_dsr)
          .map(s => s.assigned_to_dsr);
        
        if (dsrIds.length > 0) {
          const { data: dsrInfo } = await supabase
            .from('dsrs')
            .select('id, dsr_number, user_id, profiles:user_id(full_name)')
            .in('id', dsrIds);
          
          // Attach DSR info to stock items
          stockData.forEach(stock => {
            if (stock.assigned_to_dsr) {
              stock.dsr = dsrInfo?.find(d => d.id === stock.assigned_to_dsr);
            }
          });
        }
        
        // Get team info for assigned stock
        const teamIds = stockData
          .filter(s => s.assigned_to_team)
          .map(s => s.assigned_to_team);
        
        if (teamIds.length > 0) {
          const { data: teamInfo } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);
          
          // Attach team info to stock items
          stockData.forEach(stock => {
            if (stock.assigned_to_team) {
              stock.team = teamInfo?.find(t => t.id === stock.assigned_to_team);
            }
          });
        }
      }

      setStocks(stockData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load stock data',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAssignClick(stock: Stock) {
    setAssigningStock(stock);
    setAssignFormData({
      dsr_id: '',
      quantity: 1 // Each stock item is 1 unit
    });
    setDialogOpen(true);
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningStock) return;

    if (!assignFormData.dsr_id) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a DSR',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Update stock assignment
      const updateData: any = {
        status: 'assigned-dsr',
        assigned_to_dsr: assignFormData.dsr_id,
        assigned_by: user?.id,
        date_assigned: new Date().toISOString()
      };

      const { error } = await supabase
        .from('stock')
        .update(updateData)
        .eq('id', assigningStock.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Stock assigned successfully',
      });

      setDialogOpen(false);
      setAssigningStock(null);
      fetchData();

    } catch (error: any) {
      console.error('Error assigning stock:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to assign stock',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const availableStock = stocks.filter(s => s.status === 'assigned-tl' && !s.assigned_to_dsr);
  const assignedStock = stocks.filter(s => s.status === 'assigned-dsr' || s.status === 'assigned-team');
  const stockInHand = stocks.filter(s => s.status === 'in-hand');
  const stockSold = stocks.filter(s => s.status === 'sold');
  const stockUnpaid = stocks.filter(s => s.status === 'sold-unpaid');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Management</h1>
          <p className="text-muted-foreground">Manage and assign stock to your teams and DSRs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableStock.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{availableStock.length} items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned to DSRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignedStock.filter(s => s.status === 'assigned-dsr').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {assignedStock.filter(s => s.status === 'assigned-dsr').length} items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned to Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignedStock.filter(s => s.status === 'assigned-team').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {assignedStock.filter(s => s.status === 'assigned-team').length} items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock In Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stockInHand.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stockInHand.length} items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stockSold.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stockSold.length} items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sold but Unpaid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stockUnpaid.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stockUnpaid.length} items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Available Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Stock</CardTitle>
          <CardDescription>Stock available for assignment</CardDescription>
        </CardHeader>
        <CardContent>
          {availableStock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No available stock</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableStock.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-sm">{stock.stock_id}</TableCell>
                    <TableCell className="font-medium">{stock.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">1</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{stock.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleAssignClick(stock)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assigned Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Stock</CardTitle>
          <CardDescription>Stock already assigned to teams and DSRs</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedStock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No assigned stock yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedStock.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-sm">{stock.stock_id}</TableCell>
                    <TableCell className="font-medium">{stock.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">1</Badge>
                    </TableCell>
                    <TableCell>
                      {stock.status === 'assigned-dsr' && stock.dsr ? (
                        <div>
                          <div className="font-medium">{stock.dsr.profiles?.full_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{stock.dsr.dsr_number}</div>
                        </div>
                      ) : stock.status === 'assigned-team' && stock.team ? (
                        <div>
                          <Badge variant="secondary">{stock.team.name}</Badge>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stock.status === 'assigned-dsr' ? 'default' : 'secondary'}>
                        {stock.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(stock.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unpaid Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Unpaid Stock</CardTitle>
          <CardDescription>Stock sold but payment not yet received</CardDescription>
        </CardHeader>
        <CardContent>
          {stockUnpaid.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No unpaid stock</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockUnpaid.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-sm">{stock.stock_id}</TableCell>
                    <TableCell className="font-medium">{stock.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">1</Badge>
                    </TableCell>
                    <TableCell>
                      {stock.dsr ? (
                        <div>
                          <div className="font-medium">{stock.dsr.profiles?.full_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{stock.dsr.dsr_number}</div>
                        </div>
                      ) : stock.team ? (
                        <div>
                          <Badge variant="secondary">{stock.team.name}</Badge>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Unpaid</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(stock.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Stock Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Stock to DSR</DialogTitle>
            <DialogDescription>Assign stock directly to a DSR</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Stock ID</Label>
                <Input
                  value={assigningStock?.stock_id || 'N/A'}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Type</Label>
                <Input
                  value={assigningStock?.type || 'N/A'}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dsr">Assign to DSR *</Label>
                <Select
                  value={assignFormData.dsr_id}
                  onValueChange={(value) => setAssignFormData({ ...assignFormData, dsr_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select DSR" />
                  </SelectTrigger>
                  <SelectContent>
                    {dsrs.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No DSRs available. Create a DSR first.
                      </div>
                    ) : (
                      dsrs.map((dsr) => (
                        <SelectItem key={dsr.id} value={dsr.id}>
                          {dsr.dsr_number} - {dsr.profile?.full_name || 'N/A'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Stock'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
