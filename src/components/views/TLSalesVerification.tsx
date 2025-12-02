import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Sale {
  id: string;
  stock_id: string;
  dsr_id: string;
  customer_name: string;
  customer_phone?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_status: string;
  verification_status: string;
  verification_notes?: string;
  sale_date: string;
  created_at: string;
  dsr?: {
    dsr_number: string;
    profile?: {
      full_name: string;
    };
  };
  stock?: {
    stock_item?: {
      name: string;
      sku: string;
    };
  };
}

export function TLSalesVerification() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyingSale, setVerifyingSale] = useState<Sale | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user]);

  async function fetchSales() {
    try {
      setLoading(true);

      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!tlData) {
        console.error('TL record not found');
        return;
      }

      // First get DSRs under this TL
      const { data: dsrsData } = await supabase
        .from('dsrs')
        .select('id')
        .eq('tl_id', tlData.id);

      if (!dsrsData || dsrsData.length === 0) {
        console.log('No DSRs found for this TL');
        setSales([]);
        return;
      }

      const dsrIds = dsrsData.map(d => d.id);

      // Fetch sales from these DSRs
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .in('dsr_id', dsrIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales:', error);
        throw error;
      }

      console.log('Sales fetched:', salesData);

      // Fetch related data separately
      if (salesData && salesData.length > 0) {
        // Fetch DSR profiles
        const { data: dsrProfiles } = await supabase
          .from('dsrs')
          .select('id, dsr_number, user_id')
          .in('id', dsrIds);

        const userIds = dsrProfiles?.map(d => d.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        // Fetch stock items
        const stockIds = salesData.map(s => s.stock_id).filter(Boolean);
        const { data: stockData } = await supabase
          .from('stock')
          .select('id, stock_item_id')
          .in('id', stockIds);

        const batchIds = stockData?.map(s => s.stock_item_id).filter(Boolean) || [];
        const { data: batchData } = await supabase
          .from('stock_batches')
          .select('id, name, sku')
          .in('id', batchIds);

        // Combine data
        const enrichedSales = salesData.map(sale => {
          const dsr = dsrProfiles?.find(d => d.id === sale.dsr_id);
          const profile = profiles?.find(p => p.id === dsr?.user_id);
          const stock = stockData?.find(s => s.id === sale.stock_id);
          const batch = batchData?.find(b => b.id === stock?.stock_item_id);

          return {
            ...sale,
            dsr: dsr ? {
              dsr_number: dsr.dsr_number,
              profile: profile ? { full_name: profile.full_name } : undefined
            } : undefined,
            stock: stock ? {
              stock_item: batch ? { name: batch.name, sku: batch.sku } : undefined
            } : undefined
          };
        });

        setSales(enrichedSales);
      } else {
        setSales([]);
      }

    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load sales data',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleViewSale(sale: Sale) {
    setVerifyingSale(sale);
    setVerificationNotes(sale.verification_notes || '');
    setDialogOpen(true);
  }

  async function handleVerify(status: 'verified' | 'rejected') {
    if (!verifyingSale) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('sales')
        .update({
          verification_status: status,
          verification_notes: verificationNotes || null,
          verified_at: new Date().toISOString(),
          verified_by: user?.id
        })
        .eq('id', verifyingSale.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Sale ${status === 'verified' ? 'approved' : 'rejected'} successfully`,
      });

      setDialogOpen(false);
      setVerifyingSale(null);
      setVerificationNotes('');
      fetchSales();

    } catch (error: any) {
      console.error('Error verifying sale:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to verify sale',
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

  const pendingSales = sales.filter(s => s.verification_status === 'pending');
  const verifiedSales = sales.filter(s => s.verification_status === 'verified');
  const rejectedSales = sales.filter(s => s.verification_status === 'rejected');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Verification</h1>
          <p className="text-muted-foreground">Review and verify sales submitted by DSRs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingSales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: TZS {pendingSales.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{verifiedSales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: TZS {verifiedSales.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejectedSales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: TZS {rejectedSales.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Sales</CardTitle>
          <CardDescription>Sales awaiting verification</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingSales.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No pending sales to verify</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>DSR</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sale.dsr?.profile?.full_name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{sale.dsr?.dsr_number}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sale.customer_name}</div>
                        {sale.customer_phone && (
                          <div className="text-xs text-muted-foreground">{sale.customer_phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sale.stock?.stock_item?.name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{sale.stock?.stock_item?.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sale.quantity}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      TZS {sale.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sale.payment_status === 'paid' ? 'default' : 'destructive'}>
                        {sale.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewSale(sale)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verified Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verified Sales</CardTitle>
          <CardDescription>Approved sales</CardDescription>
        </CardHeader>
        <CardContent>
          {verifiedSales.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No verified sales yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>DSR</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sale.dsr?.profile?.full_name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{sale.dsr?.dsr_number}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sale.customer_name}</div>
                        {sale.customer_phone && (
                          <div className="text-xs text-muted-foreground">{sale.customer_phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sale.stock?.stock_item?.name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{sale.stock?.stock_item?.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sale.quantity}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      TZS {sale.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sale.payment_status === 'paid' ? 'default' : 'destructive'}>
                        {sale.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewSale(sale)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>Review and verify this sale</DialogDescription>
          </DialogHeader>
          {verifyingSale && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Sale Date</Label>
                  <p className="font-medium">{new Date(verifyingSale.sale_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">DSR</Label>
                  <p className="font-medium">{verifyingSale.dsr?.profile?.full_name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{verifyingSale.dsr?.dsr_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium">{verifyingSale.customer_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer Phone</Label>
                  <p className="font-medium">{verifyingSale.customer_phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Item</Label>
                  <p className="font-medium">{verifyingSale.stock?.stock_item?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{verifyingSale.stock?.stock_item?.sku}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium">{verifyingSale.quantity} units</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit Price</Label>
                  <p className="font-medium">TZS {verifyingSale.unit_price.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="font-medium text-lg">TZS {verifyingSale.total_amount.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Status</Label>
                  <Badge variant={verifyingSale.payment_status === 'paid' ? 'default' : 'destructive'}>
                    {verifyingSale.payment_status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Verification Status</Label>
                  <Badge variant={
                    verifyingSale.verification_status === 'verified' ? 'default' :
                    verifyingSale.verification_status === 'rejected' ? 'destructive' : 'secondary'
                  }>
                    {verifyingSale.verification_status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Verification Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this sale..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                  disabled={verifyingSale.verification_status !== 'pending'}
                />
              </div>

              {verifyingSale.verification_notes && verifyingSale.verification_status !== 'pending' && (
                <div className="space-y-2">
                  <Label>Previous Notes</Label>
                  <p className="text-sm text-muted-foreground border rounded-md p-3">
                    {verifyingSale.verification_notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Close
            </Button>
            {verifyingSale?.verification_status === 'pending' && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleVerify('rejected')}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={() => handleVerify('verified')}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
