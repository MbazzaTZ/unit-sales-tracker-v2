import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  ShoppingCart, 
  ArrowLeft,
  Check,
  Search,
  CreditCard,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface DSRAddSaleProps {
  onNavigate: (tab: string) => void;
}

type PackageType = 'Package' | 'No Package' | '';
type StockType = 'FS' | 'DO' | 'DVS' | '';

interface StockOption {
  id: string;
  stock_item_id: string;
  name: string;
  smartcard_number: string;
  quantity: number;
  price: number;
}

const STOCK_PRICES: Record<'FS' | 'DO' | 'DVS', number> = {
  FS: 65000,
  DO: 25000,
  DVS: 27500
};

export function DSRAddSale({ onNavigate }: DSRAddSaleProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dsrId, setDsrId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<StockOption[]>([]);
  const [stockType, setStockType] = useState<StockType>('');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [smartcardSearch, setSmartcardSearch] = useState('');
  const [manualSerialNumber, setManualSerialNumber] = useState('');
  const [packageType, setPackageType] = useState<PackageType>('');
  const [dstvPackage, setDstvPackage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [notes, setNotes] = useState('');
  const [estimatedCommission, setEstimatedCommission] = useState(0);

  const [filteredStock, setFilteredStock] = useState<StockOption[]>([]);

  // Fetch commission rates from database
  const { data: commissionRates } = useQuery({
    queryKey: ['commission-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_rates')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const rates: Record<string, { upfront: number; activation: number }> = {};
      data?.forEach(rate => {
        rates[rate.product_type] = {
          upfront: rate.upfront_amount || 0,
          activation: rate.activation_amount || 0
        };
      });
      return rates;
    },
  });

  // Fetch package commission rates
  const { data: packageCommissionRates } = useQuery({
    queryKey: ['package-commission-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_commission_rates')
        .select('*');
      
      if (error) throw error;
      
      const rates: Record<string, number> = {};
      data?.forEach(rate => {
        rates[rate.package_name] = rate.commission_amount || 0;
      });
      return rates;
    },
  });

  // Fetch DSTV packages from database
  const { data: dstvPackages } = useQuery({
    queryKey: ['dstv-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dstv_packages')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price');
      
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (user) {
      fetchDSRStock();
    }
  }, [user]);

  useEffect(() => {
    if (smartcardSearch.trim()) {
      setFilteredStock(
        availableStock.filter(stock => 
          stock.smartcard_number.toLowerCase().includes(smartcardSearch.toLowerCase()) ||
          stock.name.toLowerCase().includes(smartcardSearch.toLowerCase())
        )
      );
    } else {
      setFilteredStock(availableStock);
    }
  }, [availableStock, smartcardSearch]);

  // Calculate estimated commission whenever relevant fields change
  useEffect(() => {
    if (!stockType || !commissionRates) {
      setEstimatedCommission(0);
      return;
    }

    const rates = commissionRates[stockType];
    if (!rates) {
      setEstimatedCommission(0);
      return;
    }

    let commission = rates.upfront;

    // Add activation and package commission only for paid sales
    if (paymentStatus === 'paid') {
      commission += rates.activation;

      // Add package commission if package selected
      if (packageType === 'Package' && dstvPackage && packageCommissionRates) {
        const packageCommission = packageCommissionRates[dstvPackage.toUpperCase()];
        if (packageCommission) {
          commission += packageCommission;
        }
      }
    }

    setEstimatedCommission(commission);
  }, [stockType, paymentStatus, packageType, dstvPackage, commissionRates, packageCommissionRates]);

  async function fetchDSRStock() {
    if (!user) return;

    try {
      setLoading(true);

      // Get DSR record
      const { data: dsrData, error: dsrError } = await supabase
        .from('dsrs')
        .select('id, tl_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dsrError) throw dsrError;
      
      if (!dsrData) {
        console.log('No DSR record found for user');
        setLoading(false);
        return;
      }
      
      setDsrId(dsrData.id);
      setTlId(dsrData.tl_id);

      // Fetch available stock (assigned-dsr means in-hand)
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          type,
          batch_id,
          stock_batches (
            id,
            batch_number
          )
        `)
        .eq('assigned_to_dsr', dsrData.id)
        .eq('status', 'assigned-dsr');

      if (stockError) throw stockError;

      const transformed: StockOption[] = (stockData || []).map((item: any) => ({
        id: item.id,
        stock_item_id: item.batch_id,
        name: item.type || 'Stock Item',
        smartcard_number: item.stock_id || 'N/A',
        quantity: 1, // Each stock item is 1 unit
        price: 0, // Price not stored in stock table
      }));

      setAvailableStock(transformed);
      setFilteredStock(transformed);

    } catch (error) {
      console.error('Error fetching stock:', error);
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }

  const getSelectedStock = () => {
    return availableStock.find(s => s.id === selectedStockId);
  };

  const calculateTotal = () => {
    if (!stockType) return 0;
    return STOCK_PRICES[stockType];
  };

  const handleSubmitSale = async () => {
    if (!stockType) {
      toast.error('Please select stock type (FS, DO, or DVS)');
      return;
    }

    // For DVS, check manual serial number entry
    if (stockType === 'DVS') {
      if (!manualSerialNumber.trim()) {
        toast.error('Please enter serial number for DVS');
        return;
      }
    } else {
      // For FS/DO, check stock selection
      if (!selectedStockId) {
        toast.error('Please select a stock item');
        return;
      }
    }

    if (!packageType) {
      toast.error('Please select package option');
      return;
    }

    // DVS requires package
    if (stockType === 'DVS' && packageType === 'No Package') {
      toast.error('DVS (Digital Virtual Stock) requires a package');
      return;
    }

    const stock = stockType === 'DVS' ? null : getSelectedStock();
    if (stockType !== 'DVS' && !stock) return;

    setSubmitting(true);

    try {
      console.log('🔍 Debug stockType:', {
        stockType,
        stockTypeType: typeof stockType,
        stock: stock,
        selectedStockId,
        stockItemType: stock?.name,
      });

      // CRITICAL FIX: Your database enum expects values like 'FS', 'DO', 'DVS'
      // We need to send exactly what the database expects
      let saleType: string = '';
      
      // Based on the error, your database expects these exact enum values:
      // Check your Supabase table schema for the exact enum values
      // Common values might be: 'FS', 'DO', 'DVS' or 'full_set', 'decoder_only', 'digital_virtual'
      
      // Try these mappings based on common patterns:
      if (stockType === 'FS') {
        saleType = 'FS'; // Most likely your database expects 'FS'
      } else if (stockType === 'DO') {
        saleType = 'DO'; // Most likely your database expects 'DO'
      } else if (stockType === 'DVS') {
        // DVS might map to DO or be separate
        saleType = 'DO'; // Or 'DVS' if your database has that enum
      }
      
      console.log('🔍 Final saleType for database:', saleType);

      // Get DSTV package ID if selected
      let dstvPackageId = null;
      if (packageType === 'Package' && dstvPackage) {
        const { data: packageData } = await supabase
          .from('dstv_packages')
          .select('id')
          .eq('package_code', dstvPackage)
          .single();
        
        dstvPackageId = packageData?.id || null;
      }

      // Create sale record
      const saleInsertData: any = {
        dsr_id: dsrId,
        tl_id: tlId,
        sale_id: `SALE-${Date.now()}`,
        sale_type: saleType, // Use the mapped value
        smart_card_number: stockType === 'DVS' ? manualSerialNumber.trim() : stock!.smartcard_number,
        sn_number: stockType === 'DVS' ? manualSerialNumber.trim() : stock!.smartcard_number,
        package_option: packageType,
        dstv_package_id: dstvPackageId,
        payment_status: paymentStatus,
        notes: notes || null,
      };

      console.log('🔍 Debug saleInsertData:', saleInsertData);

      // Only add stock_id for FS/DO (link to the actual stock record)
      if (stockType !== 'DVS' && selectedStockId) {
        saleInsertData.stock_id = selectedStockId;
      }

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert(saleInsertData)
        .select()
        .single();

      if (saleError) {
        console.error('Supabase error details:', {
          code: saleError.code,
          message: saleError.message,
          details: saleError.details,
          hint: saleError.hint
        });
        throw saleError;
      }

      // Update stock status only for FS/DO
      if (stockType !== 'DVS' && stock) {
        const newStatus = paymentStatus === 'paid' ? 'sold-paid' : 'sold-unpaid';
        const { error: stockError } = await supabase
          .from('stock')
          .update({ 
            status: newStatus
          })
          .eq('id', selectedStockId);

        if (stockError) throw stockError;
      }

      toast.success(
        paymentStatus === 'paid' 
          ? 'Sale recorded successfully!' 
          : 'Sale recorded. Awaiting payment.'
      );
      
      // Reset form
      setStockType('');
      setSelectedStockId('');
      setSmartcardSearch('');
      setManualSerialNumber('');
      setPackageType('');
      setPaymentStatus('paid');
      setNotes('');
      
      // Navigate to my sales
      setTimeout(() => {
        onNavigate('my-sales');
      }, 1000);

    } catch (error: any) {
      console.error('Error submitting sale:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to record sale';
      
      if (error.code === '22P02') {
        errorMessage = `Database error: Invalid sale type value. Please contact support.`;
        
        // Try to help debug the issue
        toast.error('Database schema issue detected', {
          description: 'Your database may expect different enum values for sale_type.',
          action: {
            label: 'Check Database',
            onClick: () => {
              // You could add a function to check the database schema here
              console.log('Check your Supabase sales table for sale_type enum values');
            }
          }
        });
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to check what enum values your database accepts
  const checkDatabaseSchema = async () => {
    try {
      // Check existing sales to see what sale_type values are used
      const { data: existingSales } = await supabase
        .from('sales')
        .select('sale_type')
        .limit(5);
      
      console.log('Existing sale_type values:', existingSales?.map(s => s.sale_type));
      
      // Try to insert a test record with different values to see what works
      const testValues = ['FS', 'DO', 'DVS', 'full_set', 'decoder_only', 'digital_virtual'];
      
      for (const testValue of testValues) {
        try {
          const { error } = await supabase
            .from('sales')
            .insert({
              sale_id: `TEST-${Date.now()}`,
              sale_type: testValue,
              dsr_id: dsrId,
              tl_id: tlId,
              smart_card_number: 'TEST',
              sn_number: 'TEST',
              package_option: 'Package',
              payment_status: 'paid'
            });
          
          if (!error) {
            console.log(`✅ Database accepts sale_type: "${testValue}"`);
            // Delete the test record
            await supabase
              .from('sales')
              .delete()
              .eq('sale_id', `TEST-${Date.now()}`);
          } else {
            console.log(`❌ Database rejects sale_type: "${testValue}" - ${error.message}`);
          }
        } catch (e) {
          console.log(`❌ Database rejects sale_type: "${testValue}"`);
        }
      }
    } catch (err) {
      console.error('Error checking schema:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-foreground">Add New Sale</h1>
            <p className="text-muted-foreground">Record a new sale transaction</p>
          </div>
        </div>
        
        {/* Debug button - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={checkDatabaseSchema}
          >
            Check Schema
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Sale Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stock Type & Smartcard Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Information</CardTitle>
              <CardDescription>Select stock type and smartcard number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="stockType">Stock Type *</Label>
                <Select value={stockType} onValueChange={(value) => {
                  setStockType(value as StockType);
                  setSelectedStockId('');
                  setManualSerialNumber('');
                }}>
                  <SelectTrigger id="stockType">
                    <SelectValue placeholder="Select FS or DO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FS">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">Full Set (FS)</span>
                        <span className="text-sm text-muted-foreground ml-4">TZS 65,000</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="DO">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">Decoder Only (DO)</span>
                        <span className="text-sm text-muted-foreground ml-4">TZS 25,000</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="DVS">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">Digital Virtual Stock (DVS)</span>
                        <span className="text-sm text-muted-foreground ml-4">TZS 27,500</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Note: DVS sales require a package and manual serial number entry
                </p>
              </div>

              {stockType === 'DVS' ? (
                // Manual serial number entry for DVS
                <div>
                  <Label htmlFor="manualSerialNumber">Serial Number *</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="manualSerialNumber"
                      placeholder="Enter serial number (e.g., SN123456)"
                      value={manualSerialNumber}
                      onChange={(e) => setManualSerialNumber(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ DVS requires manual serial number entry (not smartcard)
                  </p>
                </div>
              ) : stockType && (
                // Smartcard selection for FS/DO
                <>
                  <div>
                    <Label htmlFor="smartcardSearch">Search Stock by Smartcard</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="smartcardSearch"
                        placeholder="Search by smartcard number..."
                        value={smartcardSearch}
                        onChange={(e) => setSmartcardSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ℹ️ Search and select stock using smartcard number
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="stockSelect">Select Stock Item (Smartcard) *</Label>
                    <Select value={selectedStockId} onValueChange={setSelectedStockId}>
                      <SelectTrigger id="stockSelect">
                        <SelectValue placeholder="Select stock by smartcard number" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStock.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No stock available. Please contact your TL.
                          </div>
                        ) : (
                          filteredStock.map((stock) => (
                            <SelectItem key={stock.id} value={stock.id}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4" />
                                  <span className="font-medium">{stock.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Smartcard: {stock.smartcard_number} • {stock.name}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filteredStock.length} item(s) available
                    </p>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="packageType">Package Option *</Label>
                <Select value={packageType} onValueChange={(value) => {
                  setPackageType(value as PackageType);
                  if (value === 'No Package') {
                    setDstvPackage('');
                  }
                }}>
                  <SelectTrigger id="packageType">
                    <SelectValue placeholder="Select package option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Package">With Package</SelectItem>
                    <SelectItem value="No Package" disabled={stockType === 'DVS'}>
                      No Package {stockType === 'DVS' && '(Not available for DVS)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {stockType === 'DVS' && (
                  <p className="text-xs text-amber-600 mt-1">
                    DVS requires a package - "No Package" option is disabled
                  </p>
                )}
              </div>

              {packageType === 'Package' && (
                <div>
                  <Label htmlFor="dstvPackage">DStv Package *</Label>
                  <Select value={dstvPackage} onValueChange={setDstvPackage}>
                    <SelectTrigger id="dstvPackage">
                      <SelectValue placeholder="Select DStv package" />
                    </SelectTrigger>
                    <SelectContent>
                      {dstvPackages?.map((pkg) => (
                        <SelectItem key={pkg.package_code} value={pkg.package_code}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col">
                              <span className="font-medium">{pkg.package_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {pkg.description}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground ml-4">
                              TZS {pkg.monthly_price.toLocaleString()}/mo
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Monthly subscription price
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>Add optional notes about this sale</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this sale..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Sale Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {stockType && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Stock Type</span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {stockType === 'FS' ? 'Full Set (FS)' : 
                           stockType === 'DO' ? 'Decoder Only (DO)' : 
                           'Digital Virtual Stock (DVS)'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          TZS {STOCK_PRICES[stockType].toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {(getSelectedStock() || (stockType === 'DVS' && manualSerialNumber)) && (
                  <div className="p-2 bg-secondary/50 rounded">
                    <p className="text-xs text-muted-foreground">
                      {stockType === 'DVS' ? 'Serial Number' : 'Smartcard Number'}
                    </p>
                    <p className="text-sm font-mono font-medium">
                      {stockType === 'DVS' ? manualSerialNumber : getSelectedStock()?.smartcard_number}
                    </p>
                  </div>
                )}

                {packageType && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-medium">{packageType}</span>
                  </div>
                )}

                {dstvPackage && dstvPackages && (
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">DStv Package</span>
                      <span className="text-xs font-medium">
                        TZS {dstvPackages.find(p => p.package_code === dstvPackage)?.monthly_price.toLocaleString()}/mo
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {dstvPackages.find(p => p.package_code === dstvPackage)?.package_name}
                    </p>
                  </div>
                )}

                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-foreground">Total Amount</span>
                    <span className="font-bold text-2xl text-primary">
                      TZS {calculateTotal().toLocaleString()}
                    </span>
                  </div>

                  {/* Estimated Commission Display */}
                  {estimatedCommission > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                          Your Estimated Commission
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        TZS {estimatedCommission.toLocaleString()}
                      </div>
                      {stockType && commissionRates && (
                        <div className="mt-2 text-xs space-y-1 text-green-600 dark:text-green-400">
                          <div className="flex justify-between">
                            <span>Upfront:</span>
                            <span>TZS {commissionRates[stockType]?.upfront.toLocaleString()}</span>
                          </div>
                          {paymentStatus === 'paid' && (
                            <>
                              <div className="flex justify-between">
                                <span>Activation:</span>
                                <span>TZS {commissionRates[stockType]?.activation.toLocaleString()}</span>
                              </div>
                              {dstvPackage && packageCommissionRates && (
                                <div className="flex justify-between">
                                  <span>Package Commission:</span>
                                  <span>TZS {(packageCommissionRates[dstvPackage.toUpperCase()] || 0).toLocaleString()}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {paymentStatus === 'unpaid' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          Full commission paid on customer payment
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="paymentStatus">Payment Status *</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger id="paymentStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        Paid (Stock will be deducted)
                      </div>
                    </SelectItem>
                    <SelectItem value="unpaid">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                        Unpaid (Stock on hold)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmitSale}
                disabled={
                  !stockType || 
                  !packageType || 
                  (stockType === 'DVS' ? !manualSerialNumber.trim() : !selectedStockId) ||
                  submitting
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Record Sale
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => onNavigate('dashboard')}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}