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
import { Target, TrendingUp, DollarSign, Package } from "lucide-react";

export const DESalesReport = () => {
  // Fetch DE info
  const { data: deInfo } = useQuery({
    queryKey: ['de-info'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('distribution_executives')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch agents with their sales
  const { data: agentsSales, isLoading } = useQuery({
    queryKey: ['de-agents-sales-report', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return [];

      // Get all agents
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .eq('de_id', deInfo.id);

      if (agentsError) throw agentsError;

      // Get sales for each agent this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const agentsWithSales = await Promise.all(
        agents.map(async (agent) => {
          const { data: sales, error: salesError } = await supabase
            .from('agent_sales')
            .select('sale_amount, quantity')
            .eq('agent_id', agent.id)
            .gte('sale_date', startOfMonth.toISOString());

          if (salesError) throw salesError;

          const totalAmount = sales?.reduce((sum, s) => sum + Number(s.sale_amount), 0) || 0;
          const totalUnits = sales?.reduce((sum, s) => sum + s.quantity, 0) || 0;

          return {
            ...agent,
            totalAmount,
            totalUnits,
            salesCount: sales?.length || 0,
          };
        })
      );

      return agentsWithSales.sort((a, b) => b.totalAmount - a.totalAmount);
    },
    enabled: !!deInfo?.id,
  });

  // Fetch product breakdown
  const { data: productBreakdown } = useQuery({
    queryKey: ['de-product-breakdown', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return [];

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('agent_sales')
        .select(`
          product_id,
          quantity,
          sale_amount,
          products(name)
        `)
        .eq('de_id', deInfo.id)
        .gte('sale_date', startOfMonth.toISOString());

      if (error) throw error;

      // Group by product
      const grouped = data?.reduce((acc: any, sale: any) => {
        const productId = sale.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            name: sale.products?.name || 'Unknown',
            quantity: 0,
            amount: 0,
          };
        }
        acc[productId].quantity += sale.quantity;
        acc[productId].amount += Number(sale.sale_amount);
        return acc;
      }, {});

      return Object.values(grouped || {}).sort((a: any, b: any) => b.amount - a.amount);
    },
    enabled: !!deInfo?.id,
  });

  // Calculate totals
  const totalSales = agentsSales?.reduce((sum, agent) => sum + agent.totalAmount, 0) || 0;
  const totalUnits = agentsSales?.reduce((sum, agent) => sum + agent.totalUnits, 0) || 0;
  const targetAchievement = deInfo?.target 
    ? (totalSales / Number(deInfo.target)) * 100 
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales Report</h1>
        <p className="text-muted-foreground mt-1">
          Territory: {deInfo?.territory} | Current Month Performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">TZS {totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              TZS {Number(deInfo?.target || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly target
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{targetAchievement.toFixed(1)}%</div>
            <Badge variant={targetAchievement >= 100 ? "default" : "secondary"} className="mt-1">
              {targetAchievement >= 100 ? "Target Met" : "In Progress"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total units
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Agent Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Sales Count</TableHead>
                <TableHead>Units Sold</TableHead>
                <TableHead>Total Amount (TZS)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading report...
                  </TableCell>
                </TableRow>
              ) : agentsSales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No sales data available for this month
                  </TableCell>
                </TableRow>
              ) : (
                agentsSales?.map((agent, index) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-bold">{index + 1}</TableCell>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>{agent.location || '-'}</TableCell>
                    <TableCell>{agent.salesCount}</TableCell>
                    <TableCell>{agent.totalUnits}</TableCell>
                    <TableCell>{agent.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Product Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Units Sold</TableHead>
                <TableHead>Total Amount (TZS)</TableHead>
                <TableHead>Avg. Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productBreakdown?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No product data available
                  </TableCell>
                </TableRow>
              ) : (
                productBreakdown?.map((product: any) => (
                  <TableRow key={product.name}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.quantity}</TableCell>
                    <TableCell>{product.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {(product.amount / product.quantity).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
