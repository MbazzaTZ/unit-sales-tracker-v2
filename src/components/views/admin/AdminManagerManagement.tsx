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

  // ------------------ FETCH MANAGERS ------------------
  const { data: managers = [], isLoading } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select(
          `
          *,
          zones!managers_zone_id_fkey(id, name)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching managers:", error);
        throw error;
      }

      console.log("Raw managers data:", data);

      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        console.log("Fetching profiles for user IDs:", userIds);
        
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone_number")
          .in("id", userIds);

        console.log("Profiles data:", profiles);

        if (profileError) {
          console.error("Error fetching profiles:", profileError);
        }

        // Map profiles to managers
        const mappedManagers = data.map(manager => ({
          ...manager,
          zone: manager.zones,
          profiles: profiles?.find(p => p.id === manager.user_id)
        }));
        
        console.log("Mapped managers:", mappedManagers);
        return mappedManagers;
      }

      return data;
    },
  });

  // ------------------ CREATE MANAGER ------------------
  const createManager = useMutation({
    mutationFn: async (payload: any) => {
      const { email, password, fullName, phoneNumber, managerType, zoneId, territoryIds } = payload;

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

      // 4. Insert manager record
      const { error: mgrErr } = await supabase.from("managers").insert({
        user_id: userId,
        manager_type: managerType,
        zone_id: zoneId,
        territories: territoryIds || [], // Column name is 'territories' not 'territory_ids'
      });

      if (mgrErr) {
        console.error("Error inserting manager:", mgrErr);
        throw mgrErr;
      }
    },
    onSuccess: () => {
      toast.success("Manager created successfully");
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ------------------ DELETE MANAGER ------------------
  const deleteManager = useMutation({
    mutationFn: async (managerId: string) => {
      await supabase.from("managers").delete().eq("id", managerId);
    },
    onSuccess: () => {
      toast.success("Manager deleted");
      queryClient.invalidateQueries({ queryKey: ["managers"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // ------------------ SUBMIT ------------------
  const handleSubmit = () => {
    if (!fullName || !email || !password) {
      return toast.error("Missing required fields");
    }

    if (!selectedZone) return toast.error("Select a zone");

    if (managerType === "TSM" && selectedTerritories.length === 0)
      return toast.error("TSM must select at least 1 territory");

    createManager.mutate({
      email,
      password,
      fullName,
      phoneNumber,
      managerType,
      zoneId: selectedZone,
      territoryIds: managerType === "TSM" ? selectedTerritories : [],
    });
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhoneNumber("");
    setManagerType("RSM");
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
            Manager Management
          </h1>
          <p className="text-muted-foreground">Create & manage managers</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Manager
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Manager</DialogTitle>
              <DialogDescription>RSM = Zone. TSM = Zone + Territories</DialogDescription>
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

              <div>
                <Label>Manager Type *</Label>
                <Select value={managerType} onValueChange={(v) => setManagerType(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSM">RSM (Zone Manager)</SelectItem>
                    <SelectItem value="TSM">TSM (Territory Manager)</SelectItem>
                  </SelectContent>
                </Select>
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
              {managerType === "TSM" && (
                <div>
                  <Label>Assign Territories (max 2)</Label>

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
                          {t.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleSubmit} disabled={createManager.isPending}>
                  {createManager.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Create"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* MANAGERS TABLE */}
      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Territories</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
            ) : managers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">No managers</TableCell></TableRow>
            ) : (
              managers.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.profiles?.full_name}</TableCell>
                  <TableCell>{m.profiles?.email}</TableCell>
                  <TableCell>{m.profiles?.phone_number}</TableCell>
                  <TableCell>
                    <Badge>{m.manager_type}</Badge>
                  </TableCell>
                  <TableCell>{m.zone?.name || "-"}</TableCell>
                  <TableCell>
                    {m.territories?.length
                      ? m.territories.map((t: string) => <Badge key={t} className="mr-1">{t.split("-")[1] || t}</Badge>)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => deleteManager.mutate(m.id)}
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
    </div>
  );
}
