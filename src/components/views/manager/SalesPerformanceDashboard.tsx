import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  BarChart3,
  TrendingUp,
  Users,
  Globe2,
  ArrowUpRight,
  Package,
  LineChart,
} from "lucide-react";

export function SalesPerformanceDashboard() {
  const { user } = useAuth();

  const [selectedTerritory, setSelectedTerritory] = useState("");

  // -------------------------------
  // FETCH MANAGER INFO
  // -------------------------------
  const { data: manager } = useQuery({
    queryKey: ["sales_manager", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select(
          `
          *,
          zone:zone_id(id, name, code, territories)
        `
        )
        .eq("user_id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (!manager) {
    return <div className="p-6">Loading manager info...</div>;
  }

  const isTSM = manager.manager_type === "TSM";
  const isRSM = manager.manager_type === "RSM";

  const territories = isTSM
    ? manager.territories || []
    : manager.zone?.territories || [];

  const activeTerritory =
    isTSM ? selectedTerritory || territories[0] : null;

  // -------------------------------
  // FETCH SALES
  // -------------------------------
  const { data: sales = [] } = useQuery({
    queryKey: ["sales_data", territories],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // -------------------------------
  // FILTER SALES BY ROLE
  // -------------------------------
  const filteredSales = isTSM
    ? sales.filter((s) => s.territory_id === activeTerritory)
    : sales; // RSM sees all zone territories

  // -------------------------------
  // KPI CALCULATIONS
  // -------------------------------
  const totalSales = filteredSales.length;

  const activations = filteredSales.filter(
    (s) => s.sale_type === "activation"
  ).length;

  const reconnects = filteredSales.filter(
    (s) => s.sale_type === "reconnect"
  ).length;

  const subscriptions = filteredSales.filter(
    (s) => s.sale_type === "subscription"
  ).length;

  const byPackage: Record<string, number> = {};
  filteredSales.forEach((s) => {
    if (!byPackage[s.package_code]) byPackage[s.package_code] = 0;
    byPackage[s.package_code]++;
  });

  const packageList = Object.entries(byPackage).map(([pkg, count]) => ({
    package: pkg,
    count: count as number,
  }));

  // TL & DSR stats
  const byTL = {};
  const byDSR = {};

  filteredSales.forEach((s) => {
    byTL[s.tl_id] = (byTL[s.tl_id] || 0) + 1;
    byDSR[s.dsr_id] = (byDSR[s.dsr_id] || 0) + 1;
  });

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold flex gap-2 items-center">
          <LineChart className="h-8 w-8 text-primary" />
          Sales Performance — {isTSM ? "TSM" : "RSM"}
        </h1>
        <p className="text-muted-foreground">
          {isTSM
            ? "Territory-level performance analytics"
            : "Zone-level sales analytics"}
        </p>

        {isTSM && territories.length > 1 && (
          <div className="flex gap-3 mt-4">
            {territories.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTerritory(t)}
                className={`px-4 py-2 rounded-lg border ${
                  activeTerritory === t
                    ? "bg-primary text-white"
                    : "bg-secondary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sales"
          value={totalSales}
          icon={TrendingUp}
          variant="default"
        />
        <MetricCard
          title="Activations"
          value={activations}
          icon={Package}
          variant="success"
        />
        <MetricCard
          title="Reconnects"
          value={reconnects}
          icon={ArrowUpRight}
          variant="info"
        />
        <MetricCard
          title="Subscriptions"
          value={subscriptions}
          icon={Globe2}
          variant="warning"
        />
      </div>

      {/* PACKAGE BREAKDOWN */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>Package Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {packageList.map((p) => (
              <MetricCard
                key={p.package}
                title={p.package}
                value={p.count}
                icon={Package}
                variant="info"
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TL Breakdown */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>Team Leader Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2">TL ID</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byTL).map(([tlId, count]) => (
                <tr key={tlId} className="border-b border-border/20">
                  <td className="py-2">{tlId}</td>
                  <td>{count as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* DSR Breakdown */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>DSR Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2">DSR ID</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byDSR).map(([dsrId, count]) => (
                <tr key={dsrId} className="border-b border-border/20">
                  <td className="py-2">{dsrId}</td>
                  <td>{count as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}
