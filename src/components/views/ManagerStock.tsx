import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package } from 'lucide-react';

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
}

export default function ManagerStock() {
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    inHand: 0,
    sold: 0,
    assigned: 0
  });

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);

      const { data: stockData, error } = await supabase
        .from('stock')
        .select(`
          *,
          dsrs!stock_assigned_to_dsr_fkey (
            id,
            profiles!dsrs_user_id_fkey (
              full_name
            ),
            team_leaders!dsrs_tl_id_fkey (
              profiles!team_leaders_user_id_fkey (
                full_name
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedStock = stockData?.map(item => ({
        id: item.id,
        smartcard_number: item.smartcard_number || 'N/A',
        serial_number: item.serial_number || 'N/A',
        stock_type: item.stock_type || 'N/A',
        quantity: item.quantity || 0,
        status: item.status || 'unknown',
        assigned_to_dsr: item.assigned_to_dsr,
        dsr_name: item.dsrs?.profiles?.full_name || 'N/A',
        tl_name: item.dsrs?.team_leaders?.profiles?.full_name || 'N/A'
      })) || [];

      setStock(formattedStock);

      // Calculate stats
      const total = formattedStock.reduce((sum, item) => sum + item.quantity, 0);
      const inHand = formattedStock
        .filter(item => item.status === 'stock-in-hand')
        .reduce((sum, item) => sum + item.quantity, 0);
      const sold = formattedStock
        .filter(item => item.status === 'stock-sold' || item.status === 'stock-sold-unpaid')
        .reduce((sum, item) => sum + item.quantity, 0);
      const assigned = formattedStock
        .filter(item => item.status === 'assigned-dsr')
        .reduce((sum, item) => sum + item.quantity, 0);

      setStats({ total, inHand, sold, assigned });
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      'stock-in-hand': { variant: 'default', label: 'In Hand' },
      'assigned-dsr': { variant: 'secondary', label: 'Assigned' },
      'stock-sold': { variant: 'outline', label: 'Sold - Paid' },
      'stock-sold-unpaid': { variant: 'destructive', label: 'Sold - Unpaid' }
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Hand</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inHand}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Package className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assigned}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sold}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Smartcard No.</TableHead>
                  <TableHead>Serial No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned DSR</TableHead>
                  <TableHead>Team Leader</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No stock records found
                    </TableCell>
                  </TableRow>
                ) : (
                  stock.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.smartcard_number}</TableCell>
                      <TableCell className="font-mono">{item.serial_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.stock_type}</Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.dsr_name}</TableCell>
                      <TableCell>{item.tl_name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
