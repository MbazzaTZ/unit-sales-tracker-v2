import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculateSaleCommission, type CommissionStatus } from '@/types/commission';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  CreditCard,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';

interface DSRMySalesProps {
  onNavigate: (tab: string) => void;
}

interface Sale {
  id: string;
  date: string;
  stockType: 'DO' | 'FS' | 'DVS';
  smartcardNumber: string;
  serialNumber: string;
  packageType: string | null;
  amount: number;
  paymentStatus: 'paid' | 'unpaid';
  commissionStatus: CommissionStatus;
  commissionReason?: string;
  commissionAmount: number;
  notes?: string;
}

export function DSRMySales({ onNavigate }: DSRMySalesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterStockType, setFilterStockType] = useState<'all' | 'DO' | 'FS' | 'DVS'>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMySales();
    }
  }, [user]);

  const fetchMySales = async () => {
    try {
      setLoading(true);

      // Get DSR ID
      const { data: dsrData, error: dsrError } = await supabase
        .from('dsrs')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (dsrError) throw dsrError;
      
      if (!dsrData) {
        console.log('No DSR record found for user');
        setLoading(false);
        return;
      }

      // Fetch sales
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .eq('dsr_id', dsrData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const calculateRevenue = (saleType: string) => {
        switch (saleType) {
          case 'FS': return 65000;
          case 'DO': return 25000;
          default: return 27500;
        }
      };

      const formattedSales: Sale[] = salesData?.map(sale => {
        const commission = calculateSaleCommission(
          sale.sale_type as any,
          sale.package_option,
          sale.payment_status as any,
          sale.admin_approved,
          sale.stock_id
        );

        return {
          id: sale.sale_id,
          date: sale.created_at || new Date().toISOString(),
          stockType: sale.sale_type === 'FS' ? 'FS' : sale.sale_type === 'DO' ? 'DO' : 'DVS',
          smartcardNumber: sale.smart_card_number,
          serialNumber: sale.sn_number,
          packageType: sale.package_option,
          amount: calculateRevenue(sale.sale_type),
          paymentStatus: sale.payment_status as 'paid' | 'unpaid',
          commissionStatus: commission.status,
          commissionReason: commission.reason,
          commissionAmount: commission.breakdown.totalCommission,
          notes: ''
        };
      }) || [];

      setSales(formattedSales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter((sale) => {
    const matchesSearch = 
      sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.smartcardNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || sale.paymentStatus === filterStatus;
    const matchesStockType = filterStockType === 'all' || sale.stockType === filterStockType;

    return matchesSearch && matchesStatus && matchesStockType;
  });

  const totalSales = filteredSales.length;
  const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const paidSales = filteredSales.filter(s => s.paymentStatus === 'paid').length;
  const unpaidSales = filteredSales.filter(s => s.paymentStatus === 'unpaid').length;
  const paidAmount = filteredSales.filter(s => s.paymentStatus === 'paid').reduce((sum, sale) => sum + sale.amount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusBadge = (status: 'paid' | 'unpaid') => {
    if (status === 'paid') {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    }
    return (
      <Badge className="bg-danger/10 text-danger border-danger/20">
        <XCircle className="h-3 w-3 mr-1" />
        Unpaid
      </Badge>
    );
  };

  const getStockTypeBadge = (type: 'DO' | 'FS' | 'DVS') => {
    const colors = {
      FS: 'border-primary text-primary',
      DO: 'border-info text-info',
      DVS: 'border-purple-500 text-purple-500'
    };
    return (
      <Badge variant="outline" className={colors[type]}>
        {type}
      </Badge>
    );
  };

  const getCommissionStatusBadge = (status: CommissionStatus, reason?: string) => {
    const config = {
      'eligible': {
        variant: 'default' as const,
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
        label: 'Eligible for Commission'
      },
      'pending-approval': {
        variant: 'secondary' as const,
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: 'Pending Approval'
      },
      'not-eligible': {
        variant: 'destructive' as const,
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: `Not Eligible${reason ? ': ' + reason : ''}`
      }
    };

    const { variant, icon, label } = config[status];
    return (
      <Badge variant={variant}>
        {icon}
        {label}
      </Badge>
    );
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailDialogOpen(true);
  };

  const handleEdit = (sale: Sale) => {
    toast.info(`Edit sale ${sale.id} - Feature coming soon`);
    // Here you would navigate to edit form or open edit dialog
  };

  const handleDelete = (sale: Sale) => {
    if (confirm(`Are you sure you want to delete sale ${sale.id}?`)) {
      toast.success(`Sale ${sale.id} deleted successfully`);
      // Here you would call your delete API
    }
  };

  const handlePrint = (sale: Sale) => {
    toast.info(`Printing receipt for sale ${sale.id}`);
    // Here you would trigger print functionality
  };

  const handleExport = () => {
    toast.success('Exporting sales data...');
    // Here you would export the filtered sales data
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Sales</h1>
            <p className="text-muted-foreground">View and manage all your sales records</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-foreground">{totalSales}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">TZS</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid Stock</p>
                <p className="text-2xl font-bold text-success">{paidSales}</p>
                <p className="text-xs text-muted-foreground">TZS {paidAmount.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unpaid Stock</p>
                <p className="text-2xl font-bold text-danger">{unpaidSales}</p>
                <p className="text-xs text-muted-foreground">TZS {(totalAmount - paidAmount).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-danger/10">
                <Clock className="h-5 w-5 text-danger" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
          <CardDescription>All your recorded sales transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by sale ID or smartcard number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStockType} onValueChange={(value: any) => setFilterStockType(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Package className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Stock Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="DO">DO</SelectItem>
                <SelectItem value="FS">FS</SelectItem>
                <SelectItem value="DVS">DVS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sales Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Stock Type</TableHead>
                  <TableHead>Smartcard/SN</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatDate(sale.date)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStockTypeBadge(sale.stockType)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {sale.stockType === 'DVS' ? sale.serialNumber : sale.smartcardNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{sale.packageType}</TableCell>
                      <TableCell className="font-semibold">
                        TZS {sale.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                      <TableCell>{getCommissionStatusBadge(sale.commissionStatus, sale.commissionReason)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetails(sale)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrint(sale)}>
                              <Printer className="h-4 w-4 mr-2" />
                              Print Receipt
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(sale)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Sale
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(sale)}
                              className="text-danger focus:text-danger"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Sale
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredSales.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>Showing {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm" disabled>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>Complete information about this sale</DialogDescription>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-6">
              {/* Sale Header */}
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Sale ID</p>
                  <p className="text-xl font-bold">{selectedSale.id}</p>
                </div>
                <div className="text-right">
                  {getPaymentStatusBadge(selectedSale.paymentStatus)}
                </div>
              </div>

              {/* Sale Information Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Date & Time</p>
                    <div className="flex items-center gap-2 text-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{formatDate(selectedSale.date)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Stock Type</p>
                    <div className="flex items-center gap-2">
                      {getStockTypeBadge(selectedSale.stockType)}
                      <span className="text-sm text-muted-foreground">
                        (TZS {selectedSale.amount.toLocaleString()})
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Package Type</p>
                    <div className="flex items-center gap-2 text-foreground">
                      <Package className="h-4 w-4" />
                      <span className="font-medium">{selectedSale.packageType}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Smartcard Number</p>
                    <div className="flex items-center gap-2 text-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span className="font-mono font-medium">{selectedSale.smartcardNumber}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payment Status</p>
                    <div className="flex items-center gap-2 text-foreground">
                      {selectedSale.paymentStatus === 'paid' ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="font-medium text-success">Paid</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-danger" />
                          <span className="font-medium text-danger">Unpaid</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                    <div className="flex items-center gap-2 text-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xl font-bold text-primary">
                        TZS {selectedSale.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {selectedSale.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-foreground">{selectedSale.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handlePrint(selectedSale)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    handleEdit(selectedSale);
                    setIsDetailDialogOpen(false);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Sale
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    handleDelete(selectedSale);
                    setIsDetailDialogOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
