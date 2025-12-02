import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DSR {
  id: string;
  user_id: string;
  dsr_number?: string;
  team_id?: string;
  region_id?: string;
  territory?: string;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
  team?: {
    name: string;
  };
  region?: {
    name: string;
    code: string;
  };
}

export function TLDSRManagement() {
  const { user } = useAuth();
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [territories, setTerritories] = useState<{territory: string, tsm_name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDSR, setEditingDSR] = useState<DSR | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    dsr_number: '',
    team_id: '',
    region_id: '',
    territory: ''
  });
  const [editFormData, setEditFormData] = useState({
    dsr_number: '',
    team_id: '',
    region_id: '',
    territory: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    try {
      setLoading(true);

      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, region_id')
        .eq('user_id', user?.id)
        .single();

      if (!tlData) return;

      // Fetch teams under this TL
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tl_id', tlData.id)
        .order('name');

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
      }
      
      console.log('TL ID:', tlData.id, 'Teams fetched:', teamsData);
      console.log('Teams query:', 'SELECT * FROM teams WHERE tl_id =', tlData.id);
      setTeams(teamsData || []);

      // Fetch regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('*')
        .order('name');

      setRegions(regionsData || []);

      // Extract territories from regions
      const allTerritories: {territory: string, tsm_name: string}[] = [];
      regionsData?.forEach((region: any) => {
        if (region.territories && Array.isArray(region.territories)) {
          region.territories.forEach((t: any) => {
            if (t.territory) {
              allTerritories.push(t);
            }
          });
        }
      });
      setTerritories(allTerritories);

      // Fetch DSRs under this TL
      const { data: dsrsData, error } = await supabase
        .from('dsrs')
        .select(`
          *,
          team:teams(name),
          region:regions(name, code)
        `)
        .eq('tl_id', tlData.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching DSRs:', error);
        throw error;
      }
      
      console.log('DSRs fetched:', dsrsData);

      // Fetch profiles for DSRs
      if (dsrsData && dsrsData.length > 0) {
        const userIds = dsrsData.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const dsrsWithProfiles = dsrsData.map(dsr => ({
          ...dsr,
          profile: profiles?.find(p => p.id === dsr.user_id)
        }));

        setDsrs(dsrsWithProfiles);
      } else {
        setDsrs([]);
      }

    } catch (error) {
      console.error('Error fetching DSRs:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load DSRs',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.full_name || !formData.dsr_number) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, region_id')
        .eq('user_id', user?.id)
        .single();

      if (!tlData) throw new Error('Team Leader record not found');

      // Try to create user or find existing user
      let userId = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name }
        }
      });

      if (authError) {
        // If user already exists, try to find them
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', formData.email)
            .single();
          
          if (existingUser) {
            userId = existingUser.id;
            console.log('Using existing user:', userId);
          } else {
            throw new Error('User already exists but profile not found');
          }
        } else {
          throw authError;
        }
      } else if (authData.user) {
        userId = authData.user.id;
      } else {
        throw new Error('Failed to create user');
      }

      // DSR role is created by default, so no need to modify roles

      // Create DSR record
      if (!userId) throw new Error('User ID not available');

      const dsrInsertData = {
        user_id: userId,
        dsr_number: formData.dsr_number,
        team_id: formData.team_id || null,
        territory: formData.territory || null,
        tl_id: tlData.id,
        region_id: formData.region_id || tlData.region_id || null
      };
      
      console.log('Inserting DSR with data:', dsrInsertData);

      const { error: dsrError } = await supabase
        .from('dsrs')
        .insert(dsrInsertData);

      if (dsrError) {
        console.error('DSR insert error details:', dsrError);
        throw dsrError;
      }

      toast({
        title: 'Success',
        description: 'DSR created successfully',
      });

      setDialogOpen(false);
      setFormData({ email: '', password: '', full_name: '', dsr_number: '', team_id: '', region_id: '', territory: '' });
      fetchData();

    } catch (error: any) {
      console.error('Error creating DSR:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create DSR',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(dsr: DSR) {
    setEditingDSR(dsr);
    setEditFormData({
      dsr_number: dsr.dsr_number || '',
      team_id: dsr.team_id || '',
      region_id: dsr.region_id || '',
      territory: dsr.territory || ''
    });
    setEditDialogOpen(true);
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDSR) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('dsrs')
        .update({
          dsr_number: editFormData.dsr_number,
          team_id: editFormData.team_id || null,
          region_id: editFormData.region_id || null,
          territory: editFormData.territory || null
        })
        .eq('id', editingDSR.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'DSR updated successfully',
      });

      setEditDialogOpen(false);
      setEditingDSR(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating DSR:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update DSR',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(dsrId: string) {
    if (!confirm('Are you sure you want to delete this DSR?')) return;

    try {
      const { error } = await supabase
        .from('dsrs')
        .delete()
        .eq('id', dsrId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'DSR deleted successfully',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting DSR:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete DSR',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DSR Management</h1>
          <p className="text-muted-foreground">Create and manage Direct Sales Representatives</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (open) {
            fetchData(); // Refresh data when dialog opens
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create DSR
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New DSR</DialogTitle>
              <DialogDescription>Add a new Direct Sales Representative</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    placeholder="e.g., John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dsr_number">DSR Number *</Label>
                  <Input
                    id="dsr_number"
                    placeholder="e.g., DSR-001"
                    value={formData.dsr_number}
                    onChange={(e) => setFormData({ ...formData, dsr_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="dsr@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Select
                    value={formData.team_id}
                    onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No teams available. Create a team first.
                        </div>
                      ) : (
                        teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={formData.region_id}
                    onValueChange={(value) => setFormData({ ...formData, region_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name} ({region.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="territory">Territory</Label>
                  <Select
                    value={formData.territory}
                    onValueChange={(value) => setFormData({ ...formData, territory: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select territory" />
                    </SelectTrigger>
                    <SelectContent>
                      {territories.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No territories available. Create territories in Region Management first.
                        </div>
                      ) : (
                        territories.map((territory, index) => (
                          <SelectItem key={index} value={territory.territory}>
                            {territory.territory} (TSM: {territory.tsm_name})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create DSR'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* DSRs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All DSRs</CardTitle>
          <CardDescription>Direct Sales Representatives under your management</CardDescription>
        </CardHeader>
        <CardContent>
          {dsrs.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No DSRs yet. Create your first DSR!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DSR Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dsrs.map((dsr) => (
                  <TableRow key={dsr.id}>
                    <TableCell className="font-mono text-sm font-semibold">{dsr.dsr_number || 'N/A'}</TableCell>
                    <TableCell className="font-medium">{dsr.profile?.full_name || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{dsr.profile?.email || 'N/A'}</TableCell>
                    <TableCell>
                      {dsr.team ? (
                        <Badge variant="outline">{dsr.team.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {dsr.region ? (
                        <Badge variant="secondary">{dsr.region.code}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(dsr.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(dsr)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(dsr.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit DSR Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit DSR</DialogTitle>
            <DialogDescription>Update DSR information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_dsr_number">DSR Number *</Label>
                <Input
                  id="edit_dsr_number"
                  placeholder="e.g., DSR-001"
                  value={editFormData.dsr_number}
                  onChange={(e) => setEditFormData({ ...editFormData, dsr_number: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_team">Team</Label>
                <Select
                  value={editFormData.team_id}
                  onValueChange={(value) => setEditFormData({ ...editFormData, team_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No teams available. Create a team first.
                      </div>
                    ) : (
                      teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_region">Region</Label>
                <Select
                  value={editFormData.region_id}
                  onValueChange={(value) => setEditFormData({ ...editFormData, region_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name} ({region.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_territory">Territory</Label>
                <Select
                  value={editFormData.territory}
                  onValueChange={(value) => setEditFormData({ ...editFormData, territory: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select territory" />
                  </SelectTrigger>
                  <SelectContent>
                    {territories.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No territories available.
                      </div>
                    ) : (
                      territories.map((territory, index) => (
                        <SelectItem key={index} value={territory.territory}>
                          {territory.territory} (TSM: {territory.tsm_name})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update DSR'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
