import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Target, DollarSign } from "lucide-react";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { MetricCard } from "@/components/dashboard/MetricCard";

export const DEDashboard = () => {
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

  // Fetch agents count
  const { data: agentsCount } = useQuery({
    queryKey: ['de-agents-count', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return 0;

      const { count, error } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('de_id', deInfo.id)
        .eq('status', 'active');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!deInfo?.id,
  });

  // Fetch total sales this month
  const { data: salesData } = useQuery({
    queryKey: ['de-sales-data', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return { total: 0, count: 0 };

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('agent_sales')
        .select('sale_amount')
        .eq('de_id', deInfo.id)
        .gte('sale_date', startOfMonth.toISOString());

      if (error) throw error;

      const total = data?.reduce((sum, sale) => sum + Number(sale.sale_amount), 0) || 0;
      return { total, count: data?.length || 0 };
    },
    enabled: !!deInfo?.id,
  });

  // Fetch sales by date for chart
  const { data: salesByDate } = useQuery({
    queryKey: ['de-sales-by-date', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('agent_sales')
        .select('sale_date, sale_amount')
        .eq('de_id', deInfo.id)
        .gte('sale_date', thirtyDaysAgo.toISOString())
        .order('sale_date');

      if (error) throw error;

      // Group by date
      const grouped = data?.reduce((acc: any, sale) => {
        const date = new Date(sale.sale_date).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += Number(sale.sale_amount);
        return acc;
      }, {});

      return Object.entries(grouped || {}).map(([date, amount]) => ({
        date,
        amount: amount as number,
      }));
    },
    enabled: !!deInfo?.id,
  });

  // Calculate target achievement
  const targetAchievement = deInfo?.target 
    ? ((salesData?.total || 0) / Number(deInfo.target)) * 100 
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Distribution Executive Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Territory: {deInfo?.territory || 'Loading...'}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Agents"
          value={agentsCount?.toString() || '0'}
          icon={Users}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Sales This Month"
          value={`TZS ${(salesData?.total || 0).toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Monthly Target"
          value={`TZS ${Number(deInfo?.target || 0).toLocaleString()}`}
          icon={Target}
          trend={{ value: targetAchievement, isPositive: targetAchievement >= 100 }}
        />
        <MetricCard
          title="Achievement"
          value={`${targetAchievement.toFixed(1)}%`}
          icon={TrendingUp}
          trend={{ value: targetAchievement, isPositive: targetAchievement >= 100 }}
        />
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={salesByDate || []} />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{salesData?.count || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sales entries this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Sale Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              TZS {salesData?.count ? ((salesData.total / salesData.count).toLocaleString()) : '0'}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Per transaction average
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
