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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const AdminDEManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDE, setEditingDE] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [territory, setTerritory] = useState("");
  const [target, setTarget] = useState("");
  const queryClient = useQueryClient();

  // Fetch DEs with their profiles
  const { data: des, isLoading } = useQuery({
    queryKey: ['distribution-executives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_executives')
        .select(`
          *,
          profiles(full_name, phone_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create DE mutation
  const createDEMutation = useMutation({
    mutationFn: async (deData: any) => {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: deData.email,
        password: deData.password,
        email_confirm: true,
      });

      if (authError) throw authError;
      const userId = authData.user.id;

      // 2. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: deData.full_name,
          phone_number: deData.phone_number,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // 3. Create DE record
      const { error: deError } = await supabase
        .from('distribution_executives')
        .insert({
          user_id: userId,
          territory: deData.territory,
          target: deData.target || 0,
        });

      if (deError) throw deError;

      // 4. Assign DE role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'de',
        });

      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-executives'] });
      toast.success('Distribution Executive created successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create Distribution Executive');
    },
  });

  // Update DE mutation
  const updateDEMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('distribution_executives')
        .update({
          territory: data.territory,
          target: data.target || 0,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-executives'] });
      toast.success('Distribution Executive updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update Distribution Executive');
    },
  });

  // Delete DE mutation
  const deleteDEMutation = useMutation({
    mutationFn: async (deId: string) => {
      const { error } = await supabase
        .from('distribution_executives')
        .delete()
        .eq('id', deId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-executives'] });
      toast.success('Distribution Executive deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete Distribution Executive');
    },
  });

  const handleOpenDialog = (de?: any) => {
    if (de) {
      setEditingDE(de);
      setTerritory(de.territory);
      setTarget(de.target?.toString() || '');
      setFullName(de.profiles?.full_name || '');
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDE(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhoneNumber('');
    setTerritory('');
    setTarget('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDE) {
      // Update existing DE
      if (!territory.trim()) {
        toast.error('Territory is required');
        return;
      }

      updateDEMutation.mutate({
        id: editingDE.id,
        data: {
          territory: territory.trim(),
          target: parseFloat(target) || 0,
        },
      });
    } else {
      // Create new DE
      if (!email.trim() || !password.trim() || !fullName.trim() || !territory.trim()) {
        toast.error('All fields except phone number and target are required');
        return;
      }

      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }

      createDEMutation.mutate({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim() || null,
        territory: territory.trim(),
        target: parseFloat(target) || 0,
      });
    }
  };

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
              <Plus className="mr-2 h-4 w-4" />
              Add DE
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingDE ? 'Edit Distribution Executive' : 'Add New Distribution Executive'}
                </DialogTitle>
                <DialogDescription>
                  {editingDE
                    ? 'Update DE territory and target'
                    : 'Create a new Distribution Executive account'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!editingDE && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="de@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+255..."
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="territory">Territory *</Label>
                  <Input
                    id="territory"
                    value={territory}
                    onChange={(e) => setTerritory(e.target.value)}
                    placeholder="e.g., Dar es Salaam Central"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Monthly Target (TZS)</Label>
                  <Input
                    id="target"
                    type="number"
                    min="0"
                    step="0.01"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDEMutation.isPending || updateDEMutation.isPending}
                >
                  {createDEMutation.isPending || updateDEMutation.isPending
                    ? 'Saving...'
                    : editingDE
                    ? 'Update'
                    : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* DEs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead>Monthly Target</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading Distribution Executives...
                </TableCell>
              </TableRow>
            ) : des?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No Distribution Executives found. Create your first DE to get started.
                </TableCell>
              </TableRow>
            ) : (
              des?.map((de: any) => (
                <TableRow key={de.id}>
                  <TableCell className="font-medium">
                    {de.profiles?.full_name || 'N/A'}
                  </TableCell>
                  <TableCell>{de.profiles?.phone_number || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{de.territory}</Badge>
                  </TableCell>
                  <TableCell>TZS {Number(de.target || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    {new Date(de.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDialog(de)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          confirm(
                            'Are you sure you want to delete this Distribution Executive? This will also delete all their agents and sales records.'
                          )
                        ) {
                          deleteDEMutation.mutate(de.id);
                        }
                      }}
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
};
