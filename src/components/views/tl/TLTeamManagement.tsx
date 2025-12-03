import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Users, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Team {
  id: string;
  name: string;
  captain_name?: string;
  region_id?: string;
  territory?: string;
  created_at: string;
  dsr_count?: number;
}

export function TLTeamManagement() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [territories, setTerritories] = useState<{territory: string, tsm_name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    captain_name: '',
    region_id: '',
    territory: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    captain_name: '',
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
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!tlData) {
        console.error('TL record not found');
        return;
      }
      
      setTlId(tlData.id);

      // Fetch regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('*')
        .order('name');
      
      setRegions(regionsData || []);
      
      // Extract all territories from all regions
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

      // Fetch teams for this TL
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('*')
        .eq('tl_id', tlData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch DSR count for each team
      const teamsWithCounts = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { count } = await supabase
            .from('dsrs')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);

          return {
            ...team,
            dsr_count: count || 0
          };
        })
      );

      setTeams(teamsWithCounts);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load teams',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter team name',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (!tlId) {
        throw new Error('TL ID not found. Please refresh the page.');
      }

      const { error } = await supabase
        .from('teams')
        .insert({
          name: formData.name,
          captain_name: formData.captain_name || null,
          tl_id: tlId,
          region_id: formData.region_id || null,
          territory: formData.territory || null
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Team created successfully',
      });

      setDialogOpen(false);
      setFormData({ name: '', captain_name: '', region_id: '', territory: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create team',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(team: Team) {
    setEditingTeam(team);
    setEditFormData({
      name: team.name,
      captain_name: team.captain_name || '',
      region_id: team.region_id || '',
      territory: team.territory || ''
    });
    setEditDialogOpen(true);
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeam) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editFormData.name,
          captain_name: editFormData.captain_name || null,
          region_id: editFormData.region_id || null,
          territory: editFormData.territory || null
        })
        .eq('id', editingTeam.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Team updated successfully',
      });

      setEditDialogOpen(false);
      setEditingTeam(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update team',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(teamId: string) {
    if (!confirm('Are you sure you want to delete this team? All associated DSRs will need to be reassigned.')) return;

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Team deleted successfully',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete team',
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
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-muted-foreground">Create and manage your teams</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>Add a new team to your region</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Alpha Team"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="captain">Captain Name</Label>
                  <Input
                    id="captain"
                    placeholder="Team captain's name"
                    value={formData.captain_name}
                    onChange={(e) => setFormData({ ...formData, captain_name: e.target.value })}
                  />
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
                        territories.map((terr, idx) => (
                          <SelectItem key={idx} value={terr.territory}>
                            {terr.territory} {terr.tsm_name && `(TSM: ${terr.tsm_name})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Territories are created in Region Management
                  </p>
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
                    'Create Team'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Teams</CardTitle>
          <CardDescription>List of teams under your management</CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No teams yet. Create your first team!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead className="text-center">DSRs</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.captain_name || '-'}</TableCell>
                    <TableCell>{team.territory || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{team.dsr_count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(team.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(team)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(team.id)}
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

      {/* Edit Team Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_name">Team Name *</Label>
                <Input
                  id="edit_name"
                  placeholder="e.g., Alpha Team"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_captain">Captain Name</Label>
                <Input
                  id="edit_captain"
                  placeholder="Team captain's name"
                  value={editFormData.captain_name}
                  onChange={(e) => setEditFormData({ ...editFormData, captain_name: e.target.value })}
                />
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
                      territories.map((terr, idx) => (
                        <SelectItem key={idx} value={terr.territory}>
                          {terr.territory} {terr.tsm_name && `(TSM: ${terr.tsm_name})`}
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
                  'Update Team'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
