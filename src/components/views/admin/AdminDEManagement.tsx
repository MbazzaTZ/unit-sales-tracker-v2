import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const AdminDEManagement = () => {
  console.log("AdminDEManagement component rendered");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDE, setEditingDE] = useState<any>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // NEW: Zone + Territory
  const [zoneId, setZoneId] = useState("");
  const [territoryId, setTerritoryId] = useState("");

  const [target, setTarget] = useState("");
  const queryClient = useQueryClient();

  // Fetch Zones (contains territories JSON array)
  const { data: zones = [] } = useQuery({
    queryKey: ["zones-with-territories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, name, code, territories")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch DEs with profile join
  const { data: des, isLoading } = useQuery({
    queryKey: ["distribution-executives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_executives")
        .select(`
          *,
          profile:profiles!distribution_executives_user_id_fkey(full_name, phone_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create DE
  const createDEMutation = useMutation({
    mutationFn: async (deData: any) => {
      // Step 1 — Create Auth.User with DE role in metadata
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: deData.email,
        password: deData.password,
        email_confirm: true,
        user_metadata: {
          full_name: deData.full_name,
          phone_number: deData.phone_number,
          role: 'de'
        }
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Step 2 — Wait for trigger to create profile and role
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3 — Update profile with phone number
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone_number: deData.phone_number,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Step 4 — Create DE row
      const { error: deError } = await supabase
        .from("distribution_executives")
        .insert({
          user_id: userId,
          zone_id: deData.zone_id,
          territory_id: deData.territory_id,
          target: deData.target,
        });

      if (deError) throw deError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-executives"] });
      toast.success("Distribution Executive created successfully");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create Distribution Executive");
    },
  });

  // Update DE
  const updateDEMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("distribution_executives")
        .update({
          zone_id: data.zone_id,
          territory_id: data.territory_id,
          target: data.target,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-executives"] });
      toast.success("Distribution Executive updated successfully");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update Distribution Executive");
    },
  });

  // Delete DE
  const deleteDEMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("distribution_executives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-executives"] });
      toast.success("Distribution Executive deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete");
    },
  });

  // -----------------------------------
  // Open Dialog (Edit or Create)
  // -----------------------------------
  const handleOpenDialog = (de?: any) => {
    if (de) {
      setEditingDE(de);
      setFullName(de.profile?.full_name || "");
      setPhoneNumber(de.profile?.phone_number || "");
      setZoneId(de.zone_id);
      setTerritoryId(de.territory_id);
      setTarget(de.target?.toString() || "");
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDE(null);
    setEmail("");
    setPassword("");
    setFullName("");
    setPhoneNumber("");
    setZoneId("");
    setTerritoryId("");
    setTarget("");
  };

  // -----------------------------------
  // Submit Form
  // -----------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!zoneId || !territoryId) {
      toast.error("Zone and Territory are required");
      return;
    }

    if (editingDE) {
      updateDEMutation.mutate({
        id: editingDE.id,
        data: {
          zone_id: zoneId,
          territory_id: territoryId,
          target: parseFloat(target) || 0,
        },
      });
      return;
    }

    if (!email || !password || !fullName) {
      toast.error("All required fields must be filled");
      return;
    }

    createDEMutation.mutate({
      email,
      password,
      full_name: fullName,
      phone_number: phoneNumber,
      zone_id: zoneId,
      territory_id: territoryId,
      target: parseFloat(target) || 0,
    });
  };

  const selectedZone = zones.find((z) => z.id === zoneId);
  const territories = selectedZone?.territories || [];

  // -----------------------------------
  // UI Starts Here
  // -----------------------------------
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Distribution Executive Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage Distribution Executives (DE)
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Add DE
            </Button>
          </DialogTrigger>

          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingDE ? "Edit Distribution Executive" : "Add New Distribution Executive"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">

                {/* Only show auth fields on create */}
                {!editingDE && (
                  <>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Zone *</Label>
                  <Select value={zoneId} onValueChange={setZoneId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Territory *</Label>
                  <Select
                    disabled={!zoneId}
                    value={territoryId}
                    onValueChange={setTerritoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Territory" />
                    </SelectTrigger>
                    <SelectContent>
                      {territories.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Monthly Target</Label>
                  <Input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingDE ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* DE Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead>Monthly Target</TableHead>
              <TableHead>Actual Sales</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : des?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No Distribution Executives found.
                </TableCell>
              </TableRow>
            ) : (
              des.map((de: any) => {
                const zone = zones.find((z) => z.id === de.zone_id);
                const territory = zone?.territories?.find((t: any) => t.id === de.territory_id);

                return (
                  <TableRow key={de.id}>
                    <TableCell>{de.profile?.full_name}</TableCell>
                    <TableCell>{de.profile?.phone_number || "-"}</TableCell>
                    <TableCell>{zone?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{territory?.name || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      {de.monthly_target ? `$${Number(de.monthly_target).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{de.actual_sales ? `$${Number(de.actual_sales).toLocaleString()}` : "$0"}</Badge>
                    </TableCell>
                    <TableCell>{new Date(de.created_at).toLocaleDateString()}</TableCell>

                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(de)}>
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            confirm("Delete this Distribution Executive?")
                          ) {
                            deleteDEMutation.mutate(de.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
