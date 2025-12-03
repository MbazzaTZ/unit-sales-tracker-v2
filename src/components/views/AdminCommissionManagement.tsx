import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Edit, DollarSign, Package, Award, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface PackagePrice {
  id: string;
  package_code: string;
  package_name: string;
  monthly_price: number;
  is_active: boolean;
}

interface CommissionRate {
  id: string;
  product_type: string;
  upfront_amount: number;
  activation_amount: number;
  description: string;
}

interface PackageCommission {
  id: string;
  package_name: string;
  commission_amount: number;
}

interface BonusTier {
  id: string;
  tier_name: string;
  min_sales: number;
  max_sales: number;
  bonus_amount: number;
  requires_experience: boolean;
}

interface DevicePrice {
  type: string;
  price: number;
}

export function AdminCommissionManagement() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackagePrice[]>([]);
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
  const [packageCommissions, setPackageCommissions] = useState<PackageCommission[]>([]);
  const [bonusTiers, setBonusTiers] = useState<BonusTier[]>([]);
  const [devicePrices, setDevicePrices] = useState<DevicePrice[]>([
    { type: 'FS', price: 65000 },
    { type: 'DO', price: 25000 }
  ]);

  const [editDialog, setEditDialog] = useState(false);
  const [editType, setEditType] = useState<'package' | 'commission' | 'package_commission' | 'bonus' | 'device'>('package');
  const [editItem, setEditItem] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [packagesRes, commissionsRes, pkgCommissionsRes, bonusRes] = await Promise.all([
        supabase.from('dstv_packages').select('*').order('monthly_price'),
        supabase.from('commission_rates').select('*').order('product_type'),
        supabase.from('package_commission_rates').select('*').order('commission_amount', { ascending: false }),
        supabase.from('dsr_bonus_tiers').select('*').order('min_sales')
      ]);

      if (packagesRes.data) setPackages(packagesRes.data);
      if (commissionsRes.data) setCommissionRates(commissionsRes.data);
      if (pkgCommissionsRes.data) setPackageCommissions(pkgCommissionsRes.data);
      if (bonusRes.data) setBonusTiers(bonusRes.data);

    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type: typeof editType, item: any) => {
    setEditType(type);
    setEditItem({ ...item });
    setEditDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editType === 'package') {
        const { error } = await supabase
          .from('dstv_packages')
          .update({
            monthly_price: parseFloat(editItem.monthly_price),
            package_name: editItem.package_name
          })
          .eq('id', editItem.id);
        
        if (error) throw error;
        toast.success('Package price updated');
        
      } else if (editType === 'commission') {
        const { error } = await supabase
          .from('commission_rates')
          .update({
            upfront_amount: parseFloat(editItem.upfront_amount),
            activation_amount: parseFloat(editItem.activation_amount)
          })
          .eq('id', editItem.id);
        
        if (error) throw error;
        toast.success('Commission rate updated');
        
      } else if (editType === 'package_commission') {
        const { error } = await supabase
          .from('package_commission_rates')
          .update({
            commission_amount: parseFloat(editItem.commission_amount)
          })
          .eq('id', editItem.id);
        
        if (error) throw error;
        toast.success('Package commission updated');
        
      } else if (editType === 'bonus') {
        const { error } = await supabase
          .from('dsr_bonus_tiers')
          .update({
            min_sales: parseInt(editItem.min_sales),
            max_sales: parseInt(editItem.max_sales),
            bonus_amount: parseFloat(editItem.bonus_amount)
          })
          .eq('id', editItem.id);
        
        if (error) throw error;
        toast.success('Bonus tier updated');
        
      } else if (editType === 'device') {
        // Device prices are hardcoded in trigger, would need to create a table for them
        toast.info('Device prices are updated via database trigger');
      }

      setEditDialog(false);
      fetchData();
      
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commission & Bonus Management</h1>
          <p className="text-muted-foreground">Manage pricing, commissions, and bonus structures</p>
        </div>
        <Settings className="h-8 w-8 text-muted-foreground" />
      </div>

      <Tabs defaultValue="packages" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="packages">Package Prices</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="bonuses">Bonus Tiers</TabsTrigger>
          <TabsTrigger value="devices">Device Prices</TabsTrigger>
        </TabsList>

        {/* Package Prices Tab */}
        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                DSTV Package Prices
              </CardTitle>
              <CardDescription>Monthly subscription prices for DSTV packages</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package Code</TableHead>
                    <TableHead>Package Name</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-mono">{pkg.package_code}</TableCell>
                      <TableCell className="font-medium">{pkg.package_name}</TableCell>
                      <TableCell>TZS {pkg.monthly_price.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleEdit('package', pkg)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Product Commissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Product Commissions
                </CardTitle>
                <CardDescription>Upfront and activation commissions per product type</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Upfront</TableHead>
                      <TableHead>Activation</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionRates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">{rate.product_type}</TableCell>
                        <TableCell>TZS {rate.upfront_amount.toLocaleString()}</TableCell>
                        <TableCell>TZS {rate.activation_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => handleEdit('commission', rate)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Package Commissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Package Commissions
                </CardTitle>
                <CardDescription>Commission per package type</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packageCommissions.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.package_name}</TableCell>
                        <TableCell>TZS {pkg.commission_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => handleEdit('package_commission', pkg)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bonus Tiers Tab */}
        <TabsContent value="bonuses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                DSR Bonus Tiers
              </CardTitle>
              <CardDescription>Monthly sales bonus structure based on performance tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier Name</TableHead>
                    <TableHead>Min Sales</TableHead>
                    <TableHead>Max Sales</TableHead>
                    <TableHead>Bonus Amount</TableHead>
                    <TableHead>Requires Experience</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonusTiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell className="font-medium">{tier.tier_name}</TableCell>
                      <TableCell>{tier.min_sales}</TableCell>
                      <TableCell>{tier.max_sales === 999 ? '45+' : tier.max_sales}</TableCell>
                      <TableCell>TZS {tier.bonus_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={tier.requires_experience ? 'secondary' : 'default'}>
                          {tier.requires_experience ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleEdit('bonus', tier)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Prices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Device Prices
              </CardTitle>
              <CardDescription>Base prices for decoders and full sets</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">FS</TableCell>
                    <TableCell>Full Set (Decoder + Dish)</TableCell>
                    <TableCell>TZS 65,000</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleEdit('device', { type: 'FS', price: 65000 })}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">DO</TableCell>
                    <TableCell>Decoder Only</TableCell>
                    <TableCell>TZS 25,000</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleEdit('device', { type: 'DO', price: 25000 })}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground mt-4">
                Note: Device prices are currently hardcoded in the database trigger. To change them, update the trigger function.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editType === 'package' ? 'Package Price' : 
                    editType === 'commission' ? 'Commission Rate' : 
                    editType === 'package_commission' ? 'Package Commission' :
                    editType === 'device' ? 'Device Price' : 'Bonus Tier'}
            </DialogTitle>
            <DialogDescription>
              Update the values below and click save to apply changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editType === 'package' && editItem && (
              <>
                <div className="space-y-2">
                  <Label>Package Name</Label>
                  <Input
                    value={editItem.package_name}
                    onChange={(e) => setEditItem({ ...editItem, package_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Price (TZS)</Label>
                  <Input
                    type="number"
                    value={editItem.monthly_price}
                    onChange={(e) => setEditItem({ ...editItem, monthly_price: e.target.value })}
                  />
                </div>
              </>
            )}

            {editType === 'commission' && editItem && (
              <>
                <div className="space-y-2">
                  <Label>Product Type</Label>
                  <Input value={editItem.product_type} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Upfront Amount (TZS)</Label>
                  <Input
                    type="number"
                    value={editItem.upfront_amount}
                    onChange={(e) => setEditItem({ ...editItem, upfront_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Activation Amount (TZS)</Label>
                  <Input
                    type="number"
                    value={editItem.activation_amount}
                    onChange={(e) => setEditItem({ ...editItem, activation_amount: e.target.value })}
                  />
                </div>
              </>
            )}

            {editType === 'package_commission' && editItem && (
              <>
                <div className="space-y-2">
                  <Label>Package Name</Label>
                  <Input value={editItem.package_name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Commission Amount (TZS)</Label>
                  <Input
                    type="number"
                    value={editItem.commission_amount}
                    onChange={(e) => setEditItem({ ...editItem, commission_amount: e.target.value })}
                  />
                </div>
              </>
            )}

            {editType === 'bonus' && editItem && (
              <>
                <div className="space-y-2">
                  <Label>Tier Name</Label>
                  <Input value={editItem.tier_name} disabled />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Sales</Label>
                    <Input
                      type="number"
                      value={editItem.min_sales}
                      onChange={(e) => setEditItem({ ...editItem, min_sales: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Sales</Label>
                    <Input
                      type="number"
                      value={editItem.max_sales}
                      onChange={(e) => setEditItem({ ...editItem, max_sales: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bonus Amount (TZS)</Label>
                  <Input
                    type="number"
                    value={editItem.bonus_amount}
                    onChange={(e) => setEditItem({ ...editItem, bonus_amount: e.target.value })}
                  />
                </div>
              </>
            )}

            {editType === 'device' && editItem && (
              <>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Input value={editItem.type} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Price (TZS)</Label>
                  <Input
                    type="number"
                    value={editItem.price}
                    onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Device prices are managed in the database trigger. This is for reference only.
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
