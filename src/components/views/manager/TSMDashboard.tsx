import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Package,
  TrendingUp,
  Layers,
  MapPin,
  BadgeDollarSign,
} from "lucide-react";

export function TSMDashboard() {
  const { user } = useAuth();

  // ----------------------------
  // FETCH TSM MANAGER RECORD
  // ----------------------------
  const { data: manager, isLoading: loadingManager } = useQuery({
    queryKey: ["tsm_manager", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select(
          `
            *,
            zone:zone_id(id, name),
            profiles:user_id(full_name)
          `
        )
        .eq("user_id", user?.id)
        .eq("manager_type", "TSM")
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const territoryIds = manager?.territory_ids || [];

  // ---------------------------------
  // FETCH TLs in these territories
  // ---------------------------------
  const { data: tls = [] } = useQuery({
    queryKey: ["tsm_tls", territoryIds],
    queryFn: async () => {
      if (territoryIds.length === 0) return [];

      const { data, error } = await supabase
        .from("team_leaders")
        .select(`
          *,
          profiles:user_id(full_name),
          teams(*)
        `)
        .in("territory_id", territoryIds);

      if (error) throw error;
      return data;
    },
    enabled: territoryIds.length > 0,
  });

  // ---------------------------------
  // FETCH DSRs belonging to these TLs
  // ---------------------------------
  const tlIds = tls.map((t: any) => t.id);

  const { data: dsrs = [] } = useQuery({
    queryKey: ["tsm_dsrs", tlIds],
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

  // ---------------------------------
  // FETCH SALES FOR THESE DSRs
  // ---------------------------------
  const dsrIds = dsrs.map((d: any) => d.id);

  const { data: sales = [] } = useQuery({
    queryKey: ["tsm_sales", dsrIds],
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

  // ---------------------------------
  // COMPUTE KPIs
  // ---------------------------------
  const totalSales = sales.length;
  const fsSales = sales.filter((s: any) => s.type === "FS").length;
  const doSales = sales.filter((s: any) => s.type === "DO").length;

  const totalTLs = tls.length;
  const totalDSRs = dsrs.length;

  // Today's sales
  const today = new Date().toDateString();
  const todaysSales = sales.filter(
    (s: any) => new Date(s.created_at).toDateString() === today
  );

  if (loadingManager) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!manager) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">
          No TSM role found for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* ----------------------------------- */}
      {/* HEADER */}
      {/* ----------------------------------- */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          TSM Dashboard — {manager.zone?.name}
        </h1>
        <p className="text-muted-foreground">
          Viewing performance for your assigned territories:
        </p>

        <div className="flex gap-2 mt-2">
          {territoryIds.map((t: string) => (
            <span
              key={t}
              className="px-3 py-1 text-sm rounded-md bg-primary/10 text-primary"
            >
              {t.split("-")[1]}
            </span>
          ))}
        </div>
      </div>

      {/* ----------------------------------- */}
      {/* KPI CARDS */}
      {/* ----------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sales"
          value={totalSales}
          icon={TrendingUp}
          variant="success"
        />

        <MetricCard
          title="Full Set (FS) Sales"
          value={fsSales}
          icon={Package}
          variant="info"
        />

        <MetricCard
          title="Decoder Only (DO) Sales"
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

      {/* ----------------------------------- */}
      {/* SECOND ROW CARDS */}
      {/* ----------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Team Leaders"
          value={totalTLs}
          icon={Users}
          variant="info"
        />

        <MetricCard
          title="DSR Count"
          value={totalDSRs}
          icon={Layers}
          variant="success"
        />

        <MetricCard
          title="Territories Managed"
          value={territoryIds.length}
          icon={MapPin}
          variant="danger"
        />
      </div>

      {/* ----------------------------------- */}
      {/* TERRITORY PERFORMANCE TABLE */}
      {/* ----------------------------------- */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>Territory Performance Summary</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2">Territory</th>
                  <th className="text-left py-2">TLs</th>
                  <th className="text-left py-2">DSRs</th>
                  <th className="text-left py-2">Sales</th>
                </tr>
              </thead>

              <tbody>
                {territoryIds.map((territory) => {
                  const tName = territory.split("-")[1];

                  const tlInTerritory = tls.filter(
                    (tl: any) => tl.territory_id === territory
                  );

                  const dsrInTerritory = dsrs.filter(
                    (d: any) => d.team_leaders?.territory_id === territory
                  );

                  const salesInTerritory = sales.filter((s: any) =>
                    dsrInTerritory.map((d) => d.id).includes(s.dsr_id)
                  );

                  return (
                    <tr key={territory} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{tName}</td>
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

      {/* ----------------------------------- */}
      {/* SALES FEED */}
      {/* ----------------------------------- */}
      <Card className="glass border border-border/50">
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No sales recorded yet.
            </p>
          ) : (
            sales.slice(0, 15).map((s: any) => (
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
