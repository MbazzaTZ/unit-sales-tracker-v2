import { useState, useEffect } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DSREarningsDashboard } from "@/components/dashboard/DSREarningsDashboard";
import {
  Package,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Calendar,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DSRDashboardProps {
  onNavigate: (tab: string) => void;
}

interface DashboardMetrics {
  stockInHand: number;
  paidSales: number;
  unpaidSales: number;
  todaySales: number;
  monthlySales: number;
  totalRevenue: number;
}

interface WeeklyDataPoint {
  day: string;
  sales: number;
}

export function DSRDashboard({ onNavigate }: DSRDashboardProps) {
  const { user, profile } = useAuth();
  const [dsrId, setDsrId] = useState<string | null>(null);
  const [dsrName, setDsrName] = useState<string>("DSR");
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    stockInHand: 0,
    paidSales: 0,
    unpaidSales: 0,
    todaySales: 0,
    monthlySales: 0,
    totalRevenue: 0,
  });

  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);

  const STOCK_PRICES = {
    FS: 65000,
    DO: 25000,
    DVS: 27500,
  };

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  async function loadDashboard() {
    try {
      setLoading(true);

      // GET DSR ACCOUNT
      const { data: dsr, error: dsrError } = await supabase
        .from("dsrs")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (dsrError) throw dsrError;
      if (!dsr) return setLoading(false);

      setDsrId(dsr.id);
      setDsrName(profile?.full_name || "DSR");

      // STOCK IN HAND
      const { data: stock } = await supabase
        .from("stock")
        .select("id")
        .eq("assigned_to_dsr", dsr.id)
        .eq("status", "assigned-dsr");

      const stockInHand = stock?.length || 0;

      // GET SALES
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .eq("dsr_id", dsr.id);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const paidSales = sales?.filter((s) => s.payment_status === "paid").length || 0;
      const unpaidSales = sales?.filter((s) => s.payment_status === "unpaid").length || 0;

      const todaySales =
        sales?.filter((s) => new Date(s.created_at) >= today).length || 0;

      const monthlySales =
        sales?.filter((s) => new Date(s.created_at) >= monthStart).length || 0;

      const totalRevenue =
        sales?.reduce(
          (sum, sale) => sum + STOCK_PRICES[sale.stock_type as keyof typeof STOCK_PRICES],
          0
        ) || 0;

      setMetrics({
        stockInHand,
        paidSales,
        unpaidSales,
        todaySales,
        monthlySales,
        totalRevenue,
      });

      // Weekly chart
      setWeeklyData(calculateWeeklySales(sales || []));
    } catch (err) {
      console.error("DSR dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  function calculateWeeklySales(sales: any[]): WeeklyDataPoint[] {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const result: WeeklyDataPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      const count = sales.filter((s) => {
        const d = new Date(s.created_at);
        return d >= date && d < nextDay;
      }).length;

      result.push({
        day: days[date.getDay()],
        sales: count,
      });
    }

    return result;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dsrId) {
    return (
      <div className="flex items-center justify-center p-10 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold">No DSR Profile Found</h2>
        <p className="text-muted-foreground mt-2">
          Contact admin to activate your DSR account.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {dsrName}</h1>
        <p className="text-muted-foreground">Your daily performance overview</p>
      </div>

      {/* EARNINGS SUMMARY */}
      <DSREarningsDashboard dsrId={dsrId} />

      {/* METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Stock In Hand" value={metrics.stockInHand} icon={Package} variant="info" />
        <MetricCard title="Paid Stock" value={metrics.paidSales} icon={CheckCircle} variant="success" />
        <MetricCard title="Unpaid Stock" value={metrics.unpaidSales} icon={AlertCircle} variant="danger" />
        <MetricCard title="Today's Sales" value={metrics.todaySales} icon={ShoppingCart} />
        <MetricCard title="Monthly Sales" value={metrics.monthlySales} icon={Calendar} />
      </div>

      {/* QUICK ACTIONS */}
      <div className="glass p-5 rounded-xl border border-border/50">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button onClick={() => onNavigate("stock")} className="h-auto py-4 flex flex-col items-center gap-2 bg-primary/10 text-primary border-primary/30" variant="outline">
            <Package className="w-6 h-6" />
            My Stock
          </Button>

          <Button onClick={() => onNavigate("add-sale")} className="h-auto py-4 flex flex-col items-center gap-2 bg-success/10 text-success border-success/30" variant="outline">
            <ShoppingCart className="w-6 h-6" />
            Add Sale
          </Button>

          <Button onClick={() => onNavigate("my-sales")} className="h-auto py-4 flex flex-col items-center gap-2 bg-info/10 text-info border-info/30" variant="outline">
            <TrendingUp className="w-6 h-6" />
            My Sales
          </Button>

          <Button onClick={() => onNavigate("commission")} className="h-auto py-4 flex flex-col items-center gap-2 bg-warning/10 text-warning border-warning/30" variant="outline">
            <Calendar className="w-6 h-6" />
            Commission
          </Button>
        </div>
      </div>

      {/* WEEKLY SALES CHART */}
      <div className="glass p-5 rounded-xl border border-border/50">
        <h2 className="text-lg font-semibold mb-4">Last 7 Days Sales</h2>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis dataKey="day" stroke="hsl(215, 20%, 55%)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 8%)", border: "1px solid hsl(217, 33%, 17%)", borderRadius: "8px", color: "white" }} />

              <Area type="monotone" dataKey="sales" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#salesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
