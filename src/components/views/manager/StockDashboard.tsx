import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Layers,
  Package,
  Users,
  Truck,
  TrendingUp,
  ScanBarcode,
  MapPin,
  Building2,
} from "lucide-react";
import { useState } from "react";

export function StockDashboard() {
  const { user } = useAuth();

  const [selectedTerritory, setSelectedTerritory] = useState("");

  // -----------------------------------------
  // GET MANAGER PROFILE
  // -----------------------------------------
  const { data: manager, isLoading } = useQuery({
    queryKey: ["stock_manager", user?.id],
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

  if (isLoading) {
    return (
      <div className="p-6 text-center">Loading stock dashboard...</div>
    );
  }

  if (!manager) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Manager role not found.
      </div>
    );
  }

  const isTSM = manager.manager_type === "TSM";
  const isRSM = manager.manager_type === "RSM";

  const territories = isTSM
    ? manager.territories || []
    : manager.zone?.territories || [];

  const activeTerritory = isTSM
    ? selectedTerritory || territories[0]
    : null;

  // -----------------------------------------
  // FETCH TLs BASED ON MANAGER TYPE
  // -----------------------------------------
  const { data: tls = [] } = useQuery({
    queryKey: ["stock_tls", territories],
    queryFn: async () => {
      if (!territories.length) return [];

      const { data, error } = await supabase
        .from("team_leaders")
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .in("territory_id", territories);

      if (error) throw error;
      return data;
    },
    enabled: territories.length > 0,
  });

  const tlIds = tls
    .filter(t => (isTSM ? t.territory_id === activeTerritory : true))
    .map(t => t.id);

  // -----------------------------------------
  // FETCH DSRs
  // -----------------------------------------
  const { data: dsrs = [] } = useQuery({
    queryKey: ["stock_dsrs", tlIds],
    queryFn: async () => {
      if (!tlIds.length) return [];

      const { data, error } = await supabase
        .from("dsrs")
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .in("team_leader_id", tlIds);

      if (error) throw error;
      return data;
    },
    enabled: tlIds.length > 0,
  });

  const dsrIds = dsrs.map((d) => d.id);

  // -----------------------------------------
  // FETCH STOCK FOR TL + DSR + SYSTEM
  // -----------------------------------------
  const { data: stock = [] } = useQuery({
    queryKey: ["stock_data", territories],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // -----------------------------------------
  // CALCULATE KPIs
  // -----------------------------------------
  const unassigned = stock.filter(s => s.status === "unassigned").length;

  const assignedToTL = stock.filter(
    s => s.status === "assigned-tl" && tlIds.includes(s.assigned_to_tl)
  ).length;

  const assignedToDSR = stock.filter(
    s => s.status === "assigned-dsr" && dsrIds.includes(s.assigned_to_dsr)
  ).length;

  const used = stock.filter(s => s.status === "used").length;

  // -----------------------------------------
  // UI START
  // -----------------------------------------
  return (
    <div className="p-6 space-y-6">

      {/* DASHBOARD HEADER */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8 text-primary" />
          Stock Dashboard — {isTSM ? "TSM" : "RSM"}
        </h1>

        <p className="text-muted-foreground mt-1">
          {isTSM
            ? "Monitor stock within your assigned territories"
            : "Zone-wide stock performance overview"}
        </p>

        {/* TSM TERRITORY SELECTOR */}
        {isTSM && territories.length > 1 && (
          <div className="mt-4 flex gap-3">
            {territories.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTerritory(t)}
                className={`px-4 py-2 rounded-lg border ${
                  activeTerritory === t
                    ? "bg-primary text-white"
                    : "bg-secondary text-foreground"
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
          title="System Unassigned Stock"
          value={unassigned}
          icon={Layers}
          variant="default"
        />
        <MetricCard
          title="Assigned to TLs"
          value={assignedToTL}
          icon={Users}
          variant="info"
        />
        <MetricCard
          title="Assigned to DSRs"
          value={assignedToDSR}
          icon={Truck}
          variant="success"
        />
        <MetricCard
          title="Used (Sales)"
          value={used}
          icon={TrendingUp}
          variant="warning"
        />
      </div>

      {/* TERRITORY BREAKDOWN (RSM MODE) */}
      {isRSM && (
        <Card className="glass border border-border/50">
          <CardHeader>
            <CardTitle>Territory Stock Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-2 text-left">Territory</th>
                  <th>TL Stock</th>
                  <th>DSR Stock</th>
                  <th>Used</th>
                </tr>
              </thead>
              <tbody>
                {manager.zone?.territories.map((t) => {
                  const tlInT = tls.filter((x) => x.territory_id === t);
                  const tlIdsT = tlInT.map((x) => x.id);

                  const dsrInT = dsrs.filter((x) =>
                    tlIdsT.includes(x.team_leader_id)
                  );
                  const dsrIdsT = dsrInT.map((x) => x.id);

                  const stockTL = stock.filter(
                    s =>
                      s.status === "assigned-tl" &&
                      tlIdsT.includes(s.assigned_to_tl)
                  ).length;

                  const stockDSR = stock.filter(
                    s =>
                      s.status === "assigned-dsr" &&
                      dsrIdsT.includes(s.assigned_to_dsr)
                  ).length;

                  const usedT = stock.filter(
                    s =>
                      s.status === "used" &&
                      dsrIdsT.includes(s.used_by_dsr)
                  ).length;

                  return (
                    <tr key={t} className="border-b border-border/30">
                      <td className="py-2 font-medium">{t}</td>
                      <td>{stockTL}</td>
                      <td>{stockDSR}</td>
                      <td>{usedT}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TSM TL / DSR STOCK TABLE */}
      {isTSM && (
        <Card className="glass border border-border/50">
          <CardHeader>
            <CardTitle>TL & DSR Stock Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-2 text-left">Owner</th>
                  <th>Role</th>
                  <th>Stock Assigned</th>
                  <th>Used</th>
                </tr>
              </thead>
              <tbody>
                {tls
                  .filter((t) => t.territory_id === activeTerritory)
                  .map((tl) => {
                    const tlStock = stock.filter(
                      s =>
                        s.status === "assigned-tl" &&
                        s.assigned_to_tl === tl.id
                    ).length;

                    const dsrUnderTL = dsrs.filter(
                      (d) => d.team_leader_id === tl.id
                    );

                    const dsrIdsUnder = dsrUnderTL.map((x) => x.id);

                    const usedByDSRs = stock.filter(
                      s =>
                        s.status === "used" &&
                        dsrIdsUnder.includes(s.used_by_dsr)
                    ).length;

                    return (
                      <tr key={tl.id} className="border-b border-border/30">
                        <td className="py-2 font-medium">
                          {tl.profiles?.full_name}
                        </td>
                        <td>TL</td>
                        <td>{tlStock}</td>
                        <td>{usedByDSRs}</td>
                      </tr>
                    );
                  })}

                {dsrs
                  .filter((d) => {
                    const tl = tls.find(t => t.id === d.team_leader_id);
                    return tl?.territory_id === activeTerritory;
                  })
                  .map((dsr) => {
                    const dsrStock = stock.filter(
                      s =>
                        s.status === "assigned-dsr" &&
                        s.assigned_to_dsr === dsr.id
                    ).length;

                    const usedByDSR = stock.filter(
                      s =>
                        s.status === "used" &&
                        s.used_by_dsr === dsr.id
                    ).length;

                    return (
                      <tr key={dsr.id} className="border-b border-border/30">
                        <td className="py-2 font-medium">
                          {dsr.profiles?.full_name}
                        </td>
                        <td>DSR</td>
                        <td>{dsrStock}</td>
                        <td>{usedByDSR}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
