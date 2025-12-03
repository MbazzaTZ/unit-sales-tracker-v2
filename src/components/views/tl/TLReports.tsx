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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Calendar, Loader2, TrendingUp, DollarSign, Package, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

interface ReportData {
  totalSales: number;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  totalStock: number;
  stockInHand: number;
  stockSold: number;
  totalDSRs: number;
  totalTeams: number;
  topDSRs: Array<{
    dsr_number: string;
    full_name: string;
    sales_count: number;
    total_revenue: number;
  }>;
  salesByTeam: Array<{
    team_name: string;
    sales_count: number;
    total_revenue: number;
  }>;
  salesByPaymentStatus: {
    paid: number;
    unpaid: number;
  };
  salesByVerificationStatus: {
    pending: number;
    verified: number;
    rejected: number;
  };
}

export function TLReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dateRange, setDateRange] = useState('this-month');
  const [selectedDSR, setSelectedDSR] = useState('all');
  const [dsrs, setDsrs] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [user, dateRange, selectedDSR]);

  async function fetchReportData() {
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

      // Get date range
      const now = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'this-week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'this-month':
          startDate.setDate(1);
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          break;
        case 'this-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate.setDate(1);
      }

      // Fetch DSRs
      const { data: dsrsData } = await supabase
        .from('dsrs')
        .select('id, dsr_number, user_id')
        .eq('tl_id', tlData.id);

      if (!dsrsData || dsrsData.length === 0) {
        setReportData(null);
        return;
      }

      // Fetch profiles for DSRs
      const userIds = dsrsData.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const dsrsWithProfiles = dsrsData.map(dsr => ({
        ...dsr,
        full_name: profiles?.find(p => p.id === dsr.user_id)?.full_name || 'N/A'
      }));

      setDsrs(dsrsWithProfiles);

      // Filter DSR IDs based on selection
      const dsrIds = selectedDSR === 'all' 
        ? dsrsData.map(d => d.id)
        : [selectedDSR];

      // Fetch sales data
      let salesQuery = supabase
        .from('sales')
        .select('*')
        .in('dsr_id', dsrIds)
        .gte('created_at', startDate.toISOString());

      const { data: salesData } = await salesQuery;

      // Fetch teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('tl_id', tlData.id);

      // Fetch stock data
      const { data: stockData } = await supabase
        .from('stock')
        .select('*')
        .in('assigned_to_dsr', dsrIds);

      // Calculate metrics
      const totalSales = salesData?.length || 0;
      const totalRevenue = salesData?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
      const paidRevenue = salesData?.filter(s => s.payment_status === 'paid').reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
      const unpaidRevenue = salesData?.filter(s => s.payment_status === 'unpaid').reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

      const totalStock = stockData?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;
      const stockInHand = stockData?.filter(s => s.status === 'assigned-dsr').reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;
      const stockSold = stockData?.filter(s => s.status === 'stock-sold').reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;

      // Top DSRs
      const dsrSales = dsrsWithProfiles.map(dsr => {
        const dsrSalesData = salesData?.filter(s => s.dsr_id === dsr.id) || [];
        return {
          dsr_number: dsr.dsr_number,
          full_name: dsr.full_name,
          sales_count: dsrSalesData.length,
          total_revenue: dsrSalesData.reduce((sum, s) => sum + (s.total_amount || 0), 0)
        };
      }).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5);

      // Sales by team
      const teamSales = teamsData?.map(team => {
        const teamDSRs = dsrsData?.filter(d => d.team_id === team.id) || [];
        const teamDSRIds = teamDSRs.map(d => d.id);
        const teamSalesData = salesData?.filter(s => teamDSRIds.includes(s.dsr_id)) || [];
        return {
          team_name: team.name,
          sales_count: teamSalesData.length,
          total_revenue: teamSalesData.reduce((sum, s) => sum + (s.total_amount || 0), 0)
        };
      }).sort((a, b) => b.total_revenue - a.total_revenue) || [];

      // Payment status breakdown
      const paidCount = salesData?.filter(s => s.payment_status === 'paid').length || 0;
      const unpaidCount = salesData?.filter(s => s.payment_status === 'unpaid').length || 0;

      // Verification status breakdown
      const pendingCount = salesData?.filter(s => s.verification_status === 'pending').length || 0;
      const verifiedCount = salesData?.filter(s => s.verification_status === 'verified').length || 0;
      const rejectedCount = salesData?.filter(s => s.verification_status === 'rejected').length || 0;

      setReportData({
        totalSales,
        totalRevenue,
        paidRevenue,
        unpaidRevenue,
        totalStock,
        stockInHand,
        stockSold,
        totalDSRs: dsrsData.length,
        totalTeams: teamsData?.length || 0,
        topDSRs: dsrSales,
        salesByTeam: teamSales,
        salesByPaymentStatus: {
          paid: paidCount,
          unpaid: unpaidCount
        },
        salesByVerificationStatus: {
          pending: pendingCount,
          verified: verifiedCount,
          rejected: rejectedCount
        }
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load report data',
      });
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    if (!reportData) return;

    let csvContent = "TL Sales Report\n\n";
    csvContent += `Report Period: ${dateRange}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    csvContent += "SUMMARY\n";
    csvContent += `Total Sales,${reportData.totalSales}\n`;
    csvContent += `Total Revenue,TZS ${reportData.totalRevenue}\n`;
    csvContent += `Paid Revenue,TZS ${reportData.paidRevenue}\n`;
    csvContent += `Unpaid Revenue,TZS ${reportData.unpaidRevenue}\n`;
    csvContent += `Total DSRs,${reportData.totalDSRs}\n`;
    csvContent += `Total Teams,${reportData.totalTeams}\n\n`;

    csvContent += "TOP PERFORMING DSRs\n";
    csvContent += "DSR Number,Name,Sales Count,Total Revenue\n";
    reportData.topDSRs.forEach(dsr => {
      csvContent += `${dsr.dsr_number},${dsr.full_name},${dsr.sales_count},${dsr.total_revenue}\n`;
    });

    csvContent += "\nSALES BY TEAM\n";
    csvContent += "Team Name,Sales Count,Total Revenue\n";
    reportData.salesByTeam.forEach(team => {
      csvContent += `${team.team_name},${team.sales_count},${team.total_revenue}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tl-report-${dateRange}-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Report exported successfully',
    });
  }

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
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive sales and performance reports</p>
        </div>
        <Button onClick={exportToCSV} disabled={!reportData}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dsr">DSR Filter</Label>
              <Select value={selectedDSR} onValueChange={setSelectedDSR}>
                <SelectTrigger id="dsr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All DSRs</SelectItem>
                  {dsrs.map((dsr) => (
                    <SelectItem key={dsr.id} value={dsr.id}>
                      {dsr.dsr_number} - {dsr.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!reportData ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No data available for the selected filters</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalSales}</div>
                <p className="text-xs text-muted-foreground mt-1">Transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">TZS {reportData.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-green-600 mt-1">
                  Paid: TZS {reportData.paidRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-orange-600">
                  Unpaid: TZS {reportData.unpaidRevenue.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Stock Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalStock}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  In Hand: {reportData.stockInHand} | Sold: {reportData.stockSold}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalDSRs}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  DSRs across {reportData.totalTeams} teams
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment & Verification Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
                <CardDescription>Sales breakdown by payment status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Paid</Badge>
                      <span className="text-sm">{reportData.salesByPaymentStatus.paid} sales</span>
                    </div>
                    <span className="font-semibold">
                      {reportData.totalSales > 0 ? Math.round((reportData.salesByPaymentStatus.paid / reportData.totalSales) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Unpaid</Badge>
                      <span className="text-sm">{reportData.salesByPaymentStatus.unpaid} sales</span>
                    </div>
                    <span className="font-semibold">
                      {reportData.totalSales > 0 ? Math.round((reportData.salesByPaymentStatus.unpaid / reportData.totalSales) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Status</CardTitle>
                <CardDescription>Sales breakdown by verification status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Verified</Badge>
                      <span className="text-sm">{reportData.salesByVerificationStatus.verified} sales</span>
                    </div>
                    <span className="font-semibold">
                      {reportData.totalSales > 0 ? Math.round((reportData.salesByVerificationStatus.verified / reportData.totalSales) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Pending</Badge>
                      <span className="text-sm">{reportData.salesByVerificationStatus.pending} sales</span>
                    </div>
                    <span className="font-semibold">
                      {reportData.totalSales > 0 ? Math.round((reportData.salesByVerificationStatus.pending / reportData.totalSales) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Rejected</Badge>
                      <span className="text-sm">{reportData.salesByVerificationStatus.rejected} sales</span>
                    </div>
                    <span className="font-semibold">
                      {reportData.totalSales > 0 ? Math.round((reportData.salesByVerificationStatus.rejected / reportData.totalSales) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing DSRs */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing DSRs</CardTitle>
              <CardDescription>Best performing sales representatives</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>DSR Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Sales Count</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.topDSRs.map((dsr, index) => (
                    <TableRow key={dsr.dsr_number}>
                      <TableCell>
                        <Badge variant={index === 0 ? 'default' : 'outline'}>#{index + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{dsr.dsr_number}</TableCell>
                      <TableCell className="font-medium">{dsr.full_name}</TableCell>
                      <TableCell className="text-center">{dsr.sales_count}</TableCell>
                      <TableCell className="text-right font-semibold">
                        TZS {dsr.total_revenue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sales by Team */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Team</CardTitle>
              <CardDescription>Team performance comparison</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.salesByTeam.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No team data available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Name</TableHead>
                      <TableHead className="text-center">Sales Count</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.salesByTeam.map((team) => (
                      <TableRow key={team.team_name}>
                        <TableCell className="font-medium">{team.team_name}</TableCell>
                        <TableCell className="text-center">{team.sales_count}</TableCell>
                        <TableCell className="text-right font-semibold">
                          TZS {team.total_revenue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
