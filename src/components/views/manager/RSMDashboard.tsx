import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Users,
  Package,
  TrendingUp,
  Layers,
  MapPin,
  Building2,
  BadgeDollarSign,
} from "lucide-react";

export function RSMDashboard() {
  const { user } = useAuth();

  // ---------------------------------------
  // FETCH RSM PROFILE
  // ---------------------------------------
  const { data: manager, isLoading: loadingManager } = useQuery({
    queryKey: ["rsm_manager", user?.id],
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
        .eq("manager_type", "RSM")
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const territories = manager?.zone?.territories || [];

  // ---------------------------------------
  // FETCH TLs IN ZONE TERRITORIES
  // ---------------------------------------
  const { data: tls = [] } = useQuery({
    queryKey: ["rsm_tls", territories],
    queryFn: async () => {
      if (territories.length === 0) return [];

      const { data, error } = await supabase
        .from("team_leaders")
        .select(`
          *,
          profiles:user_id(full_name),
          teams(*)
        `)
        .in("territory_id", territories);

      if (error) throw error;
      return data;
    },
    enabled: territories.length > 0,
  });

  // ---------------------------------------
  // FETCH DSRs UNDER TLs
  // ---------------------------------------
  const tlIds = tls.map((t: any) => t.id);

  const { data: dsrs = [] } = useQuery({
    queryKey: ["rsm_dsrs", tlIds],
    queryFn: async () => {
      if (tlIds.length === 0) return [];

      const { data, error } = await supabase
        .from("dsrs")
        .select(`
          *,
          profiles:user_id(full_name),
          team_leaders(id, territory_id)
        `)
        .in("team_leader_id", tlIds);

      if (error) throw error;
      return data;
    },
    enabled: tlIds.length > 0,
  });

  // ---------------------------------------
  // FETCH ALL SALES IN ZONE
  // ---------------------------------------
  const dsrIds = dsrs.map((d: any) => d.id);

  const { data: sales = [] } = useQuery({
    queryKey: ["rsm_sales", dsrIds],
    queryFn: async () => {
      if (dsrIds.length === 0) return [];

      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .in("dsr_id", dsrIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: dsrIds.length > 0,
  });

  // ---------------------------------------
  // KPIs
  // ---------------------------------------
  const totalSales = sales.length;
  const fsSales = sales.filter((s: any) => s.type === "FS").length;
  const doSales = sales.filter((s: any) => s.type === "DO").length;

  const totalTLs = tls.length;
  const totalDSRs = dsrs.length;

  const today = new Date().toDateString();
  const todaysSales = sales.filter(
    (s: any) => new Date(s.created_at).toDateString() === today
  );

  if (loadingManager) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (!manager) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        RSM role not found for this account.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          RSM Dashboard — {manager.zone?.name}
        </h1>
        <p className="text-muted-foreground">
          Zone-wide performance overview for your assigned zone.
        </p>

        <div className="flex gap-2 mt-2 flex-wrap">
          {territories.map((t: string) => (
            <span
              key={t}
              className="px-3 py-1 rounded-md text-sm bg-primary/10 text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sales (Zone)"
          value={totalSales}
          icon={TrendingUp}
          variant="success"
        />

        <MetricCard
          title="FS Sales"
          value={fsSales}
          icon={Package}
          variant="info"
        />

        <MetricCard
          title="DO Sales"
          value={doSales}
          icon={Package}
          variant="warning"
        />

        <MetricCard
          title="Today's Sales"
          value={todaysSales.length}
          icon={BadgeDollarSign}
          variant="default"
        />
      </div>

      {/* SECOND ROW KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Territories in Zone"
          value={territories.length}
          icon={MapPin}
          variant="danger"
        />

        <MetricCard
          title="Team Leaders"
          value={totalTLs}
          icon={Users}
          variant="info"
        />

        <MetricCard
          title="Total DSRs"
          value={totalDSRs}
          icon={Layers}
          variant="success"
        />
      </div>

      {/* TERRITORY PERFORMANCE TABLE */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>Territory Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-2 text-left">Territory</th>
                  <th className="py-2 text-left">TLs</th>
                  <th className="py-2 text-left">DSRs</th>
                  <th className="py-2 text-left">Sales</th>
                </tr>
              </thead>
              <tbody>
                {territories.map((territory: string) => {
                  const tlInTerritory = tls.filter(
                    (t: any) => t.territory_id === territory
                  );

                  const dsrInTerritory = dsrs.filter(
                    (d: any) => d.team_leaders?.territory_id === territory
                  );

                  const salesInTerritory = sales.filter((s: any) =>
                    dsrInTerritory.map((d) => d.id).includes(s.dsr_id)
                  );

                  return (
                    <tr key={territory} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">
                        {territory}
                      </td>
                      <td>{tlInTerritory.length}</td>
                      <td>{dsrInTerritory.length}</td>
                      <td>{salesInTerritory.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* RECENT SALES FEED */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>Recent Zone Sales</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No sales found in this zone.
            </p>
          ) : (
            sales.slice(0, 20).map((s: any) => (
              <div
                key={s.id}
                className="flex justify-between p-3 rounded-lg bg-secondary/40"
              >
                <span className="font-medium">{s.type}</span>
                <span className="text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
