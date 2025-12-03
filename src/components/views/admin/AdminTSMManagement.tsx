import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminTSMManagement() {
  const queryClient = useQueryClient();

  // Form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditTargetOpen, setIsEditTargetOpen] = useState(false);
  const [selectedTSM, setSelectedTSM] = useState<any>(null);
  const [targetAmount, setTargetAmount] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);

  // ------------------ FETCH ZONES ------------------
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // ------------------ FETCH TERRITORIES ------------------
  const { data: allTerritories = [] } = useQuery({
    queryKey: ["territories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("territories")
        .select(`
          *,
          regions!inner(zone_id, name)
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all TSMs to determine occupied territories
  const { data: allTSMs = [] } = useQuery({
    queryKey: ["all-tsms-territories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("territories, zone_id")
        .eq("manager_type", "TSM");
      if (error) throw error;
      return data;
    },
  });

  // Territory list based on selected zone - show only vacant territories
  const territories = selectedZone
    ? (() => {
        // Get all territories in the selected zone
        const zoneTerritories = allTerritories.filter(
          (t: any) => t.regions?.zone_id === selectedZone
        );
        
        if (zoneTerritories.length === 0) return [];
        
        // Get all territories occupied by TSMs in this zone
        const occupiedTerritories = allTSMs
          .filter((tsm: any) => tsm.zone_id === selectedZone)
          .flatMap((tsm: any) => tsm.territories || []);
        
        console.log('Zone territories:', zoneTerritories);
        console.log('Occupied territories:', occupiedTerritories);
        
        // Return only vacant territories
        return zoneTerritories
          .filter((t: any) => !occupiedTerritories.includes(t.id))
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            regionName: t.regions?.name || ''
          }));
      })()
    : [];

  // ------------------ FETCH TSMs ------------------
  const { data: tsms = [], isLoading } = useQuery({
    queryKey: ["tsms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select(
          `
          *,
          zones!managers_zone_id_fkey(id, name)
        `
        )
        .eq("manager_type", "TSM")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching TSMs:", error);
        throw error;
      }

      console.log("Raw TSMs data:", data);

      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        console.log("Fetching profiles for TSM user IDs:", userIds);
        
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone_number")
          .in("id", userIds);

        console.log("TSM Profiles data:", profiles);

        if (profileError) {
          console.error("Error fetching TSM profiles:", profileError);
        }

        // Map profiles to TSMs
        const mappedTSMs = data.map(tsm => ({
          ...tsm,
          zone: tsm.zones,
          profiles: profiles?.find(p => p.id === tsm.user_id)
        }));
        
        console.log("Mapped TSMs:", mappedTSMs);
        return mappedTSMs;
      }

      return data;
    },
  });

  // ------------------ CREATE TSM ------------------
  const createTSM = useMutation({
    mutationFn: async (payload: any) => {
      const { email, password, fullName, phoneNumber, zoneId, territoryIds } = payload;

      // 1. Create user with manager role in metadata
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone_number: phoneNumber, role: 'manager' } },
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error("User creation failed");

      const userId = authData.user.id;

      // 2. Wait for trigger to create profile and role
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Update profile with phone number
      await supabase.from("profiles").update({
        phone_number: phoneNumber,
      }).eq("id", userId);

      // 4. Insert TSM record
      const { error: tsmErr } = await supabase.from("managers").insert({
        user_id: userId,
        manager_type: "TSM",
        zone_id: zoneId,
        territories: territoryIds || [],
      });

      if (tsmErr) {
        console.error("Error inserting TSM:", tsmErr);
        throw tsmErr;
      }
    },
    onSuccess: () => {
      toast.success("TSM created successfully");
      queryClient.invalidateQueries({ queryKey: ["tsms"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ------------------ UPDATE TARGET ------------------
  const updateTarget = useMutation({
    mutationFn: async ({ tsmId, target }: { tsmId: string; target: number }) => {
      const { error } = await supabase
        .from("managers")
        .update({
          monthly_target: target,
          target_updated_at: new Date().toISOString(),
        })
        .eq("id", tsmId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Target updated successfully");
      queryClient.invalidateQueries({ queryKey: ["tsms"] });
      setIsEditTargetOpen(false);
      setSelectedTSM(null);
      setTargetAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ------------------ DELETE TSM ------------------
  const deleteTSM = useMutation({
    mutationFn: async (tsmId: string) => {
      await supabase.from("managers").delete().eq("id", tsmId);
    },
    onSuccess: () => {
      toast.success("TSM deleted");
      queryClient.invalidateQueries({ queryKey: ["tsms"] });
      queryClient.invalidateQueries({ queryKey: ["all-tsms-territories"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // ------------------ SUBMIT ------------------
  const handleSubmit = () => {
    if (!fullName || !email || !password) {
      return toast.error("Missing required fields");
    }

    if (!selectedZone) return toast.error("Select a zone");

    if (selectedTerritories.length === 0)
      return toast.error("TSM must select at least 1 territory (max 2)");

    createTSM.mutate({
      email,
      password,
      fullName,
      phoneNumber,
      zoneId: selectedZone,
      territoryIds: selectedTerritories,
    });
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhoneNumber("");
    setSelectedZone("");
    setSelectedTerritories([]);
    setIsAddOpen(false);
  };

  // ------------------ UI ------------------
  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="glass p-6 rounded-xl border border-border/50 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            TSM Management
          </h1>
          <p className="text-muted-foreground">Create & manage Territory Sales Managers</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add TSM
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create TSM</DialogTitle>
              <DialogDescription>Territory Sales Manager manages 1-2 territories within a zone</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div>
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div>
                <Label>Password *</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              <div>
                <Label>Phone Number</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>

              {/* ZONE SELECT */}
              <div>
                <Label>Select Zone *</Label>
                <Select
                  value={selectedZone}
                  onValueChange={(v) => {
                    setSelectedZone(v);
                    setSelectedTerritories([]); // reset territories
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z: any) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* TERRITORY MULTI-SELECT */}
              <div>
                <Label>Assign Vacant Territories * (1-2 required)</Label>
                {territories.length === 0 && selectedZone ? (
                  <p className="text-sm text-muted-foreground mt-2">No vacant territories available in this zone</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {territories.map((t: any) => {
                      const active = selectedTerritories.includes(t.id);
                      return (
                        <Badge
                          key={t.id}
                          onClick={() => {
                            if (active) {
                              setSelectedTerritories((prev) => prev.filter((x) => x !== t.id));
                            } else if (selectedTerritories.length < 2) {
                              setSelectedTerritories((prev) => [...prev, t.id]);
                            } else {
                              toast.error("Max 2 territories allowed");
                            }
                          }}
                          className={cn(
                            "cursor-pointer px-3 py-1",
                            active ? "bg-primary text-white" : "bg-secondary text-foreground"
                          )}
                        >
                          {t.name} {t.regionName && `(${t.regionName})`}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={handleSubmit} disabled={createTSM.isPending}>
                  {createTSM.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Create TSM"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* TSMs TABLE */}
      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Territories</TableHead>
              <TableHead>Monthly Target</TableHead>
              <TableHead>Actual Sales</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6">Loading...</TableCell></TableRow>
            ) : tsms.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6">No TSMs yet</TableCell></TableRow>
            ) : (
              tsms.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.profiles?.full_name}</TableCell>
                  <TableCell>{m.profiles?.email}</TableCell>
                  <TableCell>{m.profiles?.phone_number}</TableCell>
                  <TableCell>{m.zone?.name || "-"}</TableCell>
                  <TableCell>
                    {m.territories?.length > 0 ? (
                      m.territories.map((territoryId: string) => {
                        const territory = allTerritories.find((t: any) => t.id === territoryId);
                        return (
                          <Badge key={territoryId} className="mr-1">
                            {territory?.name || territoryId}
                          </Badge>
                        );
                      })
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTSM(m);
                        setTargetAmount(m.monthly_target?.toString() || "");
                        setIsEditTargetOpen(true);
                      }}
                    >
                      {m.monthly_target ? `$${Number(m.monthly_target).toLocaleString()}` : "Set Target"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.actual_sales ? `$${Number(m.actual_sales).toLocaleString()}` : "$0"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTSM.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* EDIT TARGET DIALOG */}
      <Dialog open={isEditTargetOpen} onOpenChange={setIsEditTargetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Monthly Target</DialogTitle>
            <DialogDescription>
              Set monthly sales target for {selectedTSM?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label>Monthly Target Amount ($)</Label>
              <Input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Enter target amount"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                if (!targetAmount || isNaN(Number(targetAmount))) {
                  return toast.error("Please enter a valid amount");
                }
                updateTarget.mutate({
                  tsmId: selectedTSM.id,
                  target: Number(targetAmount),
                });
              }}
              disabled={updateTarget.isPending}
            >
              {updateTarget.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Save Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
