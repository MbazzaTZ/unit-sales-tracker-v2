import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Package, AlertCircle } from 'lucide-react';

interface StockItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  quantity: number;
  status: string;
  assigned_to_dsr: string | null;
  dsr_name?: string;
  tl_name?: string;
  batch_number?: string;
}

interface UnpaidStockByTL {
  tl_id: string;
  tl_name: string;
  unpaid_count: number;
  unpaid_stock: StockItem[];
}

export default function ManagerStock() {
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [unpaidByTL, setUnpaidByTL] = useState<UnpaidStockByTL[]>([]);
  const [selectedTL, setSelectedTL] = useState<UnpaidStockByTL | null>(null);
  const [showUnpaidDialog, setShowUnpaidDialog] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    inHand: 0,
    sold: 0,
    assigned: 0,
    unpaid: 0
  });

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);

      // First, let's fetch stock data with batch information
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          type,
          status,
          created_at,
          batch_id,
          assigned_to_dsr,
          stock_batches!stock_batch_id_fkey (
            batch_number
          )
        `)
        .order('created_at', { ascending: false });

      if (stockError) {
        console.error('Stock fetch error:', stockError);
        throw stockError;
      }

      // Get all DSR IDs from stock data
      const dsrIds = [...new Set(stockData?.map(item => item.assigned_to_dsr).filter(Boolean))];
      
      // Fetch DSR data with profiles
      let dsrProfiles: Record<string, any> = {};
      if (dsrIds.length > 0) {
        const { data: dsrData, error: dsrError } = await supabase
          .from('dsrs')
          .select(`
            id,
            tl_id,
            profiles!dsrs_user_id_fkey (
              full_name
            )
          `)
          .in('id', dsrIds);

        if (dsrError) {
          console.error('DSR fetch error:', dsrError);
        } else {
          // Create a map of DSR ID to profile name
          dsrProfiles = Object.fromEntries(
            dsrData?.map(dsr => [dsr.id, {
              dsr_name: dsr.profiles?.full_name || 'Unknown DSR',
              tl_id: dsr.tl_id
            }]) || []
          );
        }
      }

      // Get TL IDs from DSR data
      const tlIds = [...new Set(Object.values(dsrProfiles).map(d => d.tl_id).filter(Boolean))];
      
      // Fetch TL profiles
      let tlProfiles: Record<string, string> = {};
      if (tlIds.length > 0) {
        const { data: tlData, error: tlError } = await supabase
          .from('team_leaders')
          .select(`
            id,
            profiles!team_leaders_user_id_fkey (
              full_name
            )
          `)
          .in('id', tlIds);

        if (tlError) {
          console.error('TL fetch error:', tlError);
        } else {
          tlProfiles = Object.fromEntries(
            tlData?.map(tl => [tl.id, tl.profiles?.full_name || 'Unknown TL']) || []
          );
        }
      }

      // Format the stock data
      const formattedStock = stockData?.map(item => {
        const dsrInfo = item.assigned_to_dsr ? dsrProfiles[item.assigned_to_dsr] : null;
        const dsrProfile = dsrInfo || {};
        
        return {
          id: item.id,
          smartcard_number: item.stock_id || `STOCK-${item.id.substring(0, 8)}`,
          serial_number: item.stock_id || `SERIAL-${item.id.substring(0, 8)}`,
          stock_type: item.type || 'N/A',
          quantity: 1,
          status: item.status || 'unknown',
          assigned_to_dsr: item.assigned_to_dsr,
          dsr_name: dsrProfile.dsr_name || (item.assigned_to_dsr ? 'Unknown DSR' : 'Unassigned'),
          tl_name: dsrProfile.tl_id ? (tlProfiles[dsrProfile.tl_id] || 'Unknown TL') : 'Unassigned',
          batch_number: item.stock_batches?.[0]?.batch_number || item.batch_id || 'N/A'
        };
      }) || [];

      console.log('Formatted stock data:', formattedStock);
      setStock(formattedStock);

      // Calculate stats (count items)
      const total = formattedStock.length;
      const inHand = formattedStock.filter(item => item.status === 'assigned-dsr').length;
      const sold = formattedStock.filter(item => 
        item.status === 'sold-paid' || item.status === 'sold-unpaid'
      ).length;
      const assigned = formattedStock.filter(item => 
        item.status?.includes('assigned') || item.status === 'assigned-dsr'
      ).length;
      const unpaid = formattedStock.filter(item => item.status === 'sold-unpaid').length;

      setStats({ total, inHand, sold, assigned, unpaid });

      // Group unpaid stock by TL
      const unpaidStock = formattedStock.filter(item => item.status === 'sold-unpaid');
      const groupedByTL: Record<string, UnpaidStockByTL> = {};

      unpaidStock.forEach(item => {
        const tlKey = item.tl_name || 'Unassigned';
        if (!groupedByTL[tlKey]) {
          groupedByTL[tlKey] = {
            tl_id: item.tl_name || 'N/A',
            tl_name: tlKey,
            unpaid_count: 0,
            unpaid_stock: []
          };
        }
        groupedByTL[tlKey].unpaid_count++;
        groupedByTL[tlKey].unpaid_stock.push(item);
      });

      setUnpaidByTL(Object.values(groupedByTL));
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      'unassigned': { variant: 'outline', label: 'Unassigned' },
      'assigned-tl': { variant: 'secondary', label: 'Assigned to TL' },
      'assigned-team': { variant: 'secondary', label: 'Assigned to Team' },
      'assigned-dsr': { variant: 'default', label: 'In Hand (DSR)' },
      'sold-paid': { variant: 'default', label: 'Sold - Paid' },
      'sold-unpaid': { variant: 'destructive', label: 'Sold - Unpaid' }
    };

    const config = statusMap[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stock Management</h1>
        <p className="text-muted-foreground">View-only inventory overview</p>
      </div>

      {/* Stock Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All inventory items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Hand</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inHand}</div>
            <p className="text-xs text-muted-foreground">With DSRs for sale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Package className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.assigned}</div>
            <p className="text-xs text-muted-foreground">To TLs/Teams/DSRs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sold}</div>
            <p className="text-xs text-muted-foreground">Completed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Stock</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.unpaid}</div>
            <p className="text-xs text-muted-foreground">Sold but not paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Stock by TL/TSM */}
      {unpaidByTL.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Unpaid Stock by Team Leader / TSM
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Click on a TL/TSM to view their unpaid stock details
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Leader / TSM</TableHead>
                    <TableHead className="text-right">Unpaid Items</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidByTL.map((tl) => (
                    <TableRow key={tl.tl_name} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">{tl.tl_name}</div>
                            <div className="text-xs text-muted-foreground">Team Leader</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="font-bold">
                          {tl.unpaid_count} items
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTL(tl);
                            setShowUnpaidDialog(true);
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing {stock.length} stock items • Last updated: {new Date().toLocaleTimeString()}
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Smartcard No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned DSR</TableHead>
                  <TableHead>Team Leader</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No stock records found
                    </TableCell>
                  </TableRow>
                ) : (
                  stock.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">
                        {item.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono">
                        {item.smartcard_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.stock_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {item.batch_number}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.dsr_name}</span>
                          {item.assigned_to_dsr && (
                            <span className="text-xs text-muted-foreground">
                              DSR ID: {item.assigned_to_dsr.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.tl_name}</span>
                          <span className="text-xs text-muted-foreground">Team Leader</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Unpaid Stock Details Dialog */}
      <Dialog open={showUnpaidDialog} onOpenChange={setShowUnpaidDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Unpaid Stock - {selectedTL?.tl_name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedTL?.unpaid_count} unpaid items under this Team Leader
            </p>
          </DialogHeader>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Smartcard No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Assigned DSR</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTL?.unpaid_stock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.smartcard_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.stock_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {item.batch_number}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.dsr_name}</span>
                        {item.assigned_to_dsr && (
                          <span className="text-xs text-muted-foreground">
                            DSR ID: {item.assigned_to_dsr.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Sold - Unpaid</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowUnpaidDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}