import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, Loader2, Trash2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AdminManagerManagement() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditTargetOpen, setIsEditTargetOpen] = useState(false);
  const [selectedRSM, setSelectedRSM] = useState<any>(null);
  const [targetAmount, setTargetAmount] = useState("");

  // Form
  const [managerType, setManagerType] = useState<"RSM" | "TSM">("RSM");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [selectedZone, setSelectedZone] = useState("");
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // ------------------ FETCH ZONES ------------------
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // ------------------ FETCH TERRITORIES ------------------
  const territories = selectedZone
    ? (() => {
        const zone = zones.find((z: any) => z.id === selectedZone);
        if (!zone || !zone.territories) return [];
        return zone.territories.map((t: any) => ({
          id: `${zone.id}-${t.territory}`,
          name: t.territory,
        }));
      })()
    : [];

  // ------------------ FETCH RSMs ------------------
  const { data: rsms = [], isLoading } = useQuery({
    queryKey: ["rsms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select(
          `
          *,
          zones!managers_zone_id_fkey(id, name)
        `
        )
        .eq("manager_type", "RSM")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching RSMs:", error);
        throw error;
      }

      console.log("Raw RSMs data:", data);

      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        console.log("Fetching profiles for RSM user IDs:", userIds);
        
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone_number")
          .in("id", userIds);

        console.log("RSM Profiles data:", profiles);

        if (profileError) {
          console.error("Error fetching RSM profiles:", profileError);
        }

        // Map profiles to RSMs
        const mappedRSMs = data.map(rsm => ({
          ...rsm,
          zone: rsm.zones,
          profiles: profiles?.find(p => p.id === rsm.user_id)
        }));
        
        console.log("Mapped RSMs:", mappedRSMs);
        return mappedRSMs;
      }

      return data;
    },
  });

  // ------------------ CREATE RSM ------------------
  const createRSM = useMutation({
    mutationFn: async (payload: any) => {
      const { email, password, fullName, phoneNumber, zoneId } = payload;

      // 1. Create user with manager role in metadata
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone_number: phoneNumber, role: 'manager' } },
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error("User creation failed");

      const userId = authData.user.id;

      // 2. Wait for trigger to create profile and role (increased wait time)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Update profile with phone number
      await supabase.from("profiles").update({
        phone_number: phoneNumber,
      }).eq("id", userId);

      // 4. Insert RSM record
      const { error: rsmErr } = await supabase.from("managers").insert({
        user_id: userId,
        manager_type: "RSM",
        zone_id: zoneId,
        territories: [], // RSMs manage entire zone, no specific territories
      });

      if (rsmErr) {
        console.error("Error inserting RSM:", rsmErr);
        throw rsmErr;
      }
    },
    onSuccess: () => {
      toast.success("RSM created successfully");
      queryClient.invalidateQueries({ queryKey: ["rsms"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ------------------ UPDATE TARGET ------------------
  const updateTarget = useMutation({
    mutationFn: async ({ rsmId, target }: { rsmId: string; target: number }) => {
      const { error } = await supabase
        .from("managers")
        .update({
          monthly_target: target,
          target_updated_at: new Date().toISOString(),
        })
        .eq("id", rsmId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Target updated successfully");
      queryClient.invalidateQueries({ queryKey: ["rsms"] });
      setIsEditTargetOpen(false);
      setSelectedRSM(null);
      setTargetAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ------------------ DELETE RSM ------------------
  const deleteRSM = useMutation({
    mutationFn: async (rsmId: string) => {
      await supabase.from("managers").delete().eq("id", rsmId);
    },
    onSuccess: () => {
      toast.success("RSM deleted");
      queryClient.invalidateQueries({ queryKey: ["rsms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // ------------------ SUBMIT ------------------
  const handleSubmit = () => {
    if (!fullName || !email || !password) {
      return toast.error("Missing required fields");
    }

    if (!selectedZone) return toast.error("Select a zone");

    createRSM.mutate({
      email,
      password,
      fullName,
      phoneNumber,
      zoneId: selectedZone,
    });
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhoneNumber("");
    setSelectedZone("");
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
            RSM Management
          </h1>
          <p className="text-muted-foreground">Create & manage Regional Sales Managers</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add RSM
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create RSM</DialogTitle>
              <DialogDescription>Regional Sales Manager manages an entire zone</DialogDescription>
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
                <Select value={selectedZone} onValueChange={setSelectedZone}>
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

              <DialogFooter>
                <Button onClick={handleSubmit} disabled={createRSM.isPending}>
                  {createRSM.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Create RSM"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* RSMs TABLE */}
      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Monthly Target</TableHead>
              <TableHead>Actual Sales</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
            ) : rsms.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">No RSMs yet</TableCell></TableRow>
            ) : (
              rsms.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.profiles?.full_name}</TableCell>
                  <TableCell>{m.profiles?.email}</TableCell>
                  <TableCell>{m.profiles?.phone_number}</TableCell>
                  <TableCell>{m.zone?.name || "-"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedRSM(m);
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
                      onClick={() => deleteRSM.mutate(m.id)}
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
              Set monthly sales target for {selectedRSM?.profiles?.full_name}
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
                  rsmId: selectedRSM.id,
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
