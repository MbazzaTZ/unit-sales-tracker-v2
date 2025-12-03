import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Loader2, Users, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function AdminTLManagement() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regionId, setRegionId] = useState('');
  const [territoryId, setTerritoryId] = useState('');
  const [target, setTarget] = useState('');
  const [editingTL, setEditingTL] = useState<any>(null);
  const [deletingTL, setDeletingTL] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch regions
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regions').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch territories
  const { data: territories = [] } = useQuery({
    queryKey: ['territories', regionId],
    queryFn: async () => {
      if (!regionId) return [];
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('region_id', regionId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!regionId
  });

  // Fetch TLs with profiles
  const { data: teamLeaders = [], isLoading } = useQuery({
    queryKey: ['team_leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_leaders')
        .select(`
          *,
          region:regions(name, code),
          territory:territories(name, code)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = data.map(tl => tl.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      return data.map(tl => ({
        ...tl,
        profile: profiles?.find(p => p.id === tl.user_id)
      }));
    }
  });

  // Create TL mutation
  const createTLMutation = useMutation({
    mutationFn: async () => {
      // Create user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');
      
      // Delete default DSR role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', authData.user.id)
        .eq('role', 'dsr');
      
      // Insert TL role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'tl'
        });
      
      if (roleError) throw roleError;
      
      // Create TL record
      const { error: tlError } = await supabase
        .from('team_leaders')
        .insert({
          user_id: authData.user.id,
          region_id: regionId || null,
          territory_id: territoryId || null,
          monthly_target: parseInt(target) || 0
        });
      
      if (tlError) throw tlError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_leaders'] });
      toast({ title: editingTL ? 'Team Leader updated successfully' : 'Team Leader created successfully' });
      setEmail('');
      setPassword('');
      setFullName('');
      setRegionId('');
      setTerritoryId('');
      setTarget('');
      setEditingTL(null);
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating TL', description: error.message, variant: 'destructive' });
    }
  });

  // Update TL mutation
  const updateTLMutation = useMutation({
    mutationFn: async () => {
      if (!editingTL) return;
      
      const { error } = await supabase
        .from('team_leaders')
        .update({
          region_id: regionId || null,
          territory_id: territoryId || null,
          monthly_target: parseInt(target) || 0
        })
        .eq('id', editingTL.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_leaders'] });
      toast({ title: 'Team Leader updated successfully' });
      setRegionId('');
      setTerritoryId('');
      setTarget('');
      setEditingTL(null);
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating TL', description: error.message, variant: 'destructive' });
    }
  });

  // Delete TL mutation
  const deleteTLMutation = useMutation({
    mutationFn: async (tlId: string) => {
      const { error } = await supabase
        .from('team_leaders')
        .delete()
        .eq('id', tlId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_leaders'] });
      toast({ title: 'Team Leader deleted successfully' });
      setDeletingTL(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting TL', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = () => {
    if (editingTL) {
      updateTLMutation.mutate();
    } else {
      if (!email || !password || !fullName) {
        toast({ title: 'Please fill all required fields', variant: 'destructive' });
        return;
      }
      createTLMutation.mutate();
    }
  };

  const handleEdit = (tl: any) => {
    setEditingTL(tl);
    setRegionId(tl.region_id || '');
    setTerritoryId(tl.territory_id || '');
    setTarget(tl.monthly_target?.toString() || '');
    setIsOpen(true);
  };

  const handleDelete = (tl: any) => {
    setDeletingTL(tl);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Leaders</h1>
          <p className="text-muted-foreground">Manage team leaders across regions</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create TL
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-border/50">
            <DialogHeader>
              <DialogTitle>{editingTL ? 'Edit Team Leader' : 'Create Team Leader'}</DialogTitle>
              <DialogDescription>
                {editingTL ? 'Update team leader details' : 'Add a new team leader account'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {!editingTL && (
                <>
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="tl@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={regionId} onValueChange={setRegionId}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name} ({region.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Territory</Label>
                <Select value={territoryId} onValueChange={setTerritoryId} disabled={!regionId}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder={regionId ? "Select territory" : "Select region first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {territories.map(territory => (
                      <SelectItem key={territory.id} value={territory.id}>
                        {territory.name} ({territory.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Target</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={createTLMutation.isPending || updateTLMutation.isPending}
              >
                {(createTLMutation.isPending || updateTLMutation.isPending) && 
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                }
                {editingTL ? 'Update Team Leader' : 'Create Team Leader'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* TL Table */}
      <div className="glass rounded-xl border border-border/50">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : teamLeaders.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No team leaders yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Region</TableHead>
                <TableHead className="text-muted-foreground">Territory</TableHead>
                <TableHead className="text-muted-foreground">Target</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamLeaders.map((tl) => (
                <TableRow key={tl.id} className="border-border/50 hover:bg-secondary/30">
                  <TableCell className="font-medium text-foreground">{tl.profile?.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{tl.profile?.email}</TableCell>
                  <TableCell>
                    {tl.region ? (
                      <Badge variant="outline">{tl.region.code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {tl.territory ? (
                      <Badge variant="secondary">{tl.territory.code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground">{tl.monthly_target}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(tl.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(tl)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(tl)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTL} onOpenChange={() => setDeletingTL(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Leader</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingTL?.profile?.full_name}? This action cannot be undone.
              All associated data will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTL && deleteTLMutation.mutate(deletingTL.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTLMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
