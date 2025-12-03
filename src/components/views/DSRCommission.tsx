import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Package, CheckCircle } from "lucide-react";

// Commission rates per product type
const COMMISSION_RATES = {
  'FS': 2000, // TZS 2,000 per FS sale
  'DO': 1500, // TZS 1,500 per DO sale
};

interface DSRCommissionProps {
  onNavigate?: (tab: string) => void;
}

export const DSRCommission = ({ onNavigate }: DSRCommissionProps) => {
  // Fetch DSR info
  const { data: dsrInfo } = useQuery({
    queryKey: ['dsr-info'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('dsrs')
        .select(`
          *,
          teams(name),
          team_leaders(profiles(full_name))
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch DSR sales with product details
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['dsr-commission-sales', dsrInfo?.id],
    queryFn: async () => {
      if (!dsrInfo?.id) return [];

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_type,
          payment_status,
          created_at,
          tl_verified,
          admin_approved,
          products(name, category)
        `)
        .eq('dsr_id', dsrInfo.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!dsrInfo?.id,
  });

  // Calculate commission breakdown
  const commissionBreakdown = salesData?.reduce((acc, sale) => {
    const saleType = sale.sale_type as 'FS' | 'DO';
    const commissionAmount = COMMISSION_RATES[saleType] || 0;
    
    // Commission is only earned for paid, verified, and approved sales
    const isCommissionEligible = 
      sale.payment_status === 'paid' && 
      sale.tl_verified && 
      sale.admin_approved;

    if (!acc[saleType]) {
      acc[saleType] = {
        count: 0,
        paidCount: 0,
        eligibleCount: 0,
        pendingCount: 0,
        totalCommission: 0,
        earnedCommission: 0,
        pendingCommission: 0,
      };
    }

    acc[saleType].count++;
    
    if (sale.payment_status === 'paid') {
      acc[saleType].paidCount++;
    }

    if (isCommissionEligible) {
      acc[saleType].eligibleCount++;
      acc[saleType].earnedCommission += commissionAmount;
    } else if (sale.payment_status === 'paid' && (!sale.tl_verified || !sale.admin_approved)) {
      // Paid but pending verification/approval
      acc[saleType].pendingCount++;
      acc[saleType].pendingCommission += commissionAmount;
    }

    acc[saleType].totalCommission += commissionAmount;

    return acc;
  }, {} as Record<string, any>) || {};

  // Calculate totals
  const totalSales = salesData?.length || 0;
  const totalEarned = Object.values(commissionBreakdown).reduce(
    (sum: number, item: any) => sum + item.earnedCommission, 
    0
  );
  const totalPending = Object.values(commissionBreakdown).reduce(
    (sum: number, item: any) => sum + item.pendingCommission, 
    0
  );
  const totalPotential = Object.values(commissionBreakdown).reduce(
    (sum: number, item: any) => sum + item.totalCommission, 
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Commission Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Track your earnings and pending commissions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              TZS {totalEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Approved & paid commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              TZS {totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting TL/Admin approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Total</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              TZS {totalPotential.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All sales (paid + unpaid)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time sales count
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commission Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Full Setup (FS)</p>
                  <p className="text-2xl font-bold">TZS 2,000</p>
                </div>
                <Badge variant="default">Per Sale</Badge>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Dish Only (DO)</p>
                  <p className="text-2xl font-bold">TZS 1,500</p>
                </div>
                <Badge variant="default">Per Sale</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown by Sale Type */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Breakdown by Sale Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale Type</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Total Sales</TableHead>
                <TableHead>Paid Sales</TableHead>
                <TableHead>Eligible Sales</TableHead>
                <TableHead>Earned</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Potential</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(commissionBreakdown).map(([saleType, data]: [string, any]) => (
                <TableRow key={saleType}>
                  <TableCell>
                    <Badge variant={saleType === 'FS' ? 'default' : 'secondary'}>
                      {saleType === 'FS' ? 'Full Setup' : 'Dish Only'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    TZS {COMMISSION_RATES[saleType as 'FS' | 'DO'].toLocaleString()}
                  </TableCell>
                  <TableCell>{data.count}</TableCell>
                  <TableCell>{data.paidCount}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {data.eligibleCount}
                  </TableCell>
                  <TableCell className="text-green-600 font-bold">
                    TZS {data.earnedCommission.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-orange-600">
                    TZS {data.pendingCommission.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-blue-600">
                    TZS {data.totalCommission.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {Object.keys(commissionBreakdown).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No sales data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Commission Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Earning Conditions:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
            <li>Commission is earned only when the sale is <strong>paid</strong></li>
            <li>Sale must be <strong>verified by Team Leader</strong></li>
            <li>Sale must be <strong>approved by Admin</strong></li>
            <li>Unpaid sales do not qualify for commission until payment is received</li>
          </ul>
          <p className="mt-4"><strong>Status Definitions:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
            <li><span className="text-green-600 font-medium">Earned:</span> Paid, verified, and approved - ready for payout</li>
            <li><span className="text-orange-600 font-medium">Pending:</span> Paid but awaiting TL verification or Admin approval</li>
            <li><span className="text-blue-600 font-medium">Potential:</span> Total commission value including unpaid sales</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
