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
import { Package, Send, Loader2, CreditCard } from 'lucide-react';
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
  date_assigned?: string;
  stock_batches?: {
    batch_number: string;
  }[];
  dsr?: {
    id: string;
    dsr_number: string;
    user_id: string;
    profiles?: {
      full_name: string;
    };
  };
  team?: {
    id: string;
    name: string;
  };
}

interface DSR {
  id: string;
  dsr_number: string;
  user_id: string;
  tl_id: string;
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
    quantity: 1
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
      const { data: tlData, error: tlError } = await supabase
        .from('team_leaders')
        .select('id, region_id')
        .eq('user_id', user?.id)
        .single();

      if (tlError) {
        console.error('TL fetch error:', tlError);
        throw tlError;
      }

      if (!tlData) {
        console.error('TL record not found for user:', user?.id);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Team Leader record not found. Please contact admin.',
        });
        return;
      }

      console.log('TL Data:', tlData);

      // Fetch teams under this TL
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tl_id', tlData.id);

      if (teamsError) {
        console.error('Teams fetch error:', teamsError);
      } else {
        console.log('Teams data:', teamsData);
        setTeams(teamsData || []);
      }

      // Fetch DSRs under this TL
      const { data: dsrsData, error: dsrsError } = await supabase
        .from('dsrs')
        .select('id, dsr_number, user_id, tl_id')
        .eq('tl_id', tlData.id);

      if (dsrsError) {
        console.error('DSRs fetch error:', dsrsError);
        setDsrs([]);
      } else {
        console.log('DSRs data:', dsrsData);
        
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

          console.log('DSRs with profiles:', dsrsWithProfiles);
          setDsrs(dsrsWithProfiles as any);
        } else {
          setDsrs([]);
        }
      }

      // Fetch stock assigned to this TL (assigned-tl status)
      // ALSO fetch stock that's assigned to DSRs under this TL for tracking
      console.log('Fetching stock for TL ID:', tlData.id);
      
      // Query 1: Stock directly assigned to TL (status: assigned-tl)
      const { data: tlStockData, error: tlStockError } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          type,
          status,
          created_at,
          batch_id,
          date_assigned,
          assigned_to_dsr,
          assigned_to_team,
          assigned_to_tl,
          assigned_by,
          stock_batches!stock_batch_id_fkey (
            batch_number
          )
        `)
        .eq('assigned_to_tl', tlData.id)
        .order('created_at', { ascending: false });

      if (tlStockError) {
        console.error('TL stock fetch error:', tlStockError);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch TL stock: ' + tlStockError.message,
        });
      }

      console.log('TL Stock (assigned to TL):', tlStockData);

      // Query 2: Stock assigned to DSRs under this TL (status: assigned-dsr)
      const { data: dsrStockData, error: dsrStockError } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          type,
          status,
          created_at,
          batch_id,
          date_assigned,
          assigned_to_dsr,
          assigned_to_team,
          assigned_to_tl,
          assigned_by,
          stock_batches!stock_batch_id_fkey (
            batch_number
          )
        `)
        .in('assigned_to_dsr', dsrsData?.map(d => d.id) || [])
        .order('created_at', { ascending: false });

      if (dsrStockError) {
        console.error('DSR stock fetch error:', dsrStockError);
      }

      console.log('DSR Stock (assigned to DSRs):', dsrStockData);

      // Combine both stock lists
      const combinedStockData = [...(tlStockData || []), ...(dsrStockData || [])];
      
      // Remove duplicates by ID
      const uniqueStockData = Array.from(new Map(combinedStockData.map(item => [item.id, item])).values());

      console.log('Combined unique stock:', uniqueStockData);

      // Manually fetch DSR and team info for all stock items
      if (uniqueStockData.length > 0) {
        // Get DSR info for assigned stock
        const dsrIds = uniqueStockData
          .filter(s => s.assigned_to_dsr)
          .map(s => s.assigned_to_dsr);
        
        if (dsrIds.length > 0) {
          const { data: dsrInfo, error: dsrInfoError } = await supabase
            .from('dsrs')
            .select(`
              id,
              dsr_number,
              user_id,
              profiles!dsrs_user_id_fkey (
                full_name
              )
            `)
            .in('id', dsrIds);

          if (dsrInfoError) {
            console.error('DSR info fetch error:', dsrInfoError);
          }

          console.log('DSR info fetched:', dsrInfo);
          
          // Get team info for assigned stock
          const teamIds = uniqueStockData
            .filter(s => s.assigned_to_team)
            .map(s => s.assigned_to_team);
          
          if (teamIds.length > 0) {
            const { data: teamInfo, error: teamInfoError } = await supabase
              .from('teams')
              .select('id, name')
              .in('id', teamIds);

            if (teamInfoError) {
              console.error('Team info fetch error:', teamInfoError);
            }

            console.log('Team info fetched:', teamInfo);
            
            // Attach info to stock items
            const enhancedStock = uniqueStockData.map(stock => {
              const enhanced = { ...stock } as Stock;
              
              if (stock.assigned_to_dsr && dsrInfo) {
                const dsr = dsrInfo.find(d => d.id === stock.assigned_to_dsr);
                if (dsr) {
                  enhanced.dsr = {
                    id: dsr.id,
                    dsr_number: dsr.dsr_number,
                    user_id: dsr.user_id,
                    profiles: dsr.profiles
                  };
                }
              }
              
              if (stock.assigned_to_team && teamInfo) {
                const team = teamInfo.find(t => t.id === stock.assigned_to_team);
                if (team) {
                  enhanced.team = {
                    id: team.id,
                    name: team.name
                  };
                }
              }
              
              return enhanced;
            });

            console.log('Enhanced stock with DSR/Team info:', enhancedStock);
            setStocks(enhancedStock);
          } else {
            setStocks(uniqueStockData as Stock[]);
          }
        } else {
          setStocks(uniqueStockData as Stock[]);
        }
      } else {
        setStocks([]);
      }

      console.log('Final stocks state:', stocks.length);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load stock data: ' + (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAssignClick(stock: Stock) {
    console.log('Assigning stock:', stock);
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

    console.log('Submitting assignment for stock:', assigningStock.id);

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
        assigned_to_tl: null, // Remove TL assignment since it's going to DSR
        assigned_by: user?.id,
        date_assigned: new Date().toISOString()
      };

      console.log('Updating stock with data:', updateData);

      const { error } = await supabase
        .from('stock')
        .update(updateData)
        .eq('id', assigningStock.id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      console.log('Stock assigned successfully');

      toast({
        title: 'Success',
        description: 'Stock assigned successfully to DSR',
      });

      setDialogOpen(false);
      setAssigningStock(null);
      fetchData(); // Refresh data

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

  // Filter stock based on status
  const availableStock = stocks.filter(s => s.status === 'assigned-tl' && !s.assigned_to_dsr);
  const assignedStock = stocks.filter(s => s.status === 'assigned-dsr' || s.status === 'assigned-team');
  const stockInHand = stocks.filter(s => s.status === 'assigned-dsr');
  const stockSold = stocks.filter(s => s.status === 'sold-paid');
  const stockUnpaid = stocks.filter(s => s.status === 'sold-unpaid');

  console.log('Stock Summary:', {
    total: stocks.length,
    available: availableStock.length,
    assigned: assignedStock.length,
    inHand: stockInHand.length,
    sold: stockSold.length,
    unpaid: stockUnpaid.length,
    allStocks: stocks.map(s => ({ id: s.id, status: s.status, stock_id: s.stock_id }))
  });

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stocks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All inventory items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableStock.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to assign</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock In Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stockInHand.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              With DSRs for sale
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
              Completed transactions
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
              Pending payment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Available Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Stock for Assignment</CardTitle>
          <CardDescription>Stock assigned to you that can be assigned to DSRs</CardDescription>
        </CardHeader>
        <CardContent>
          {availableStock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No available stock assigned to you</p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact your manager or administrator to get stock assigned to you first.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Smartcard</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableStock.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-sm">{stock.id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{stock.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {stock.stock_batches?.[0]?.batch_number || stock.batch_id || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{stock.stock_id || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{stock.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleAssignClick(stock)}
                        disabled={dsrs.length === 0}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {dsrs.length === 0 ? 'No DSRs' : 'Assign to DSR'}
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
          <CardTitle>Stock Assigned to DSRs</CardTitle>
          <CardDescription>Stock currently assigned to your DSRs</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedStock.filter(s => s.status === 'assigned-dsr').length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No stock assigned to DSRs yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Smartcard</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Date Assigned</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedStock
                  .filter(s => s.status === 'assigned-dsr')
                  .map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-sm">{stock.id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{stock.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {stock.stock_batches?.[0]?.batch_number || stock.batch_id || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{stock.stock_id || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {stock.dsr ? (
                        <div>
                          <div className="font-medium">{stock.dsr.profiles?.full_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{stock.dsr.dsr_number}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stock.date_assigned ? new Date(stock.date_assigned).toLocaleDateString() : 
                       stock.created_at ? new Date(stock.created_at).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stock.status === 'assigned-dsr' ? 'default' : 'secondary'}>
                        {stock.status === 'assigned-dsr' ? 'In Hand (DSR)' : stock.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unpaid Stock Table */}
      {stockUnpaid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unpaid Stock</CardTitle>
            <CardDescription>Stock sold but payment not yet received</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Smartcard</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockUnpaid.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-sm">{stock.id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{stock.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{stock.stock_id || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {stock.dsr ? (
                        <div>
                          <div className="font-medium">{stock.dsr.profiles?.full_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{stock.dsr.dsr_number}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Unpaid</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stock.date_assigned ? new Date(stock.date_assigned).toLocaleDateString() : 
                       stock.created_at ? new Date(stock.created_at).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  value={assigningStock?.id.substring(0, 8) || 'N/A'}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label>Smartcard Number</Label>
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
                <Label>Batch</Label>
                <Input
                  value={assigningStock?.stock_batches?.[0]?.batch_number || assigningStock?.batch_id || 'N/A'}
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
                        No DSRs available under your leadership. Create a DSR first.
                      </div>
                    ) : (
                      dsrs.map((dsr) => (
                        <SelectItem key={dsr.id} value={dsr.id}>
                          {dsr.dsr_number} - {dsr.profile?.full_name || 'Unnamed DSR'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {dsrs.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You need to have DSRs under your leadership to assign stock.
                  </p>
                )}
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
              <Button 
                type="submit" 
                disabled={submitting || dsrs.length === 0}
              >
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