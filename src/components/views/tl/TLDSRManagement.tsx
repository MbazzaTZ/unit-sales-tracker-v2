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

interface Zone {
  id: string;
  name: string;
  code: string;
  territories: { territory: string; tsm_name: string }[];
}

interface Team {
  id: string;
  name: string;
  territory_name: string;
  tl_id: string;
}

interface DSR {
  id: string;
  user_id: string;
  dsr_number?: string;
  team_id?: string;
  territory_name?: string;
  zone_name?: string;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
    territory_name: string;
  };
}

export function TLDSRManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingDSR, setEditingDSR] = useState<DSR | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    dsr_number: '',
    team_id: '',
  });

  const [editFormData, setEditFormData] = useState({
    dsr_number: '',
    team_id: '',
  });

  // ----------------------------------------------------------
  // FRONTEND LOOKUP: find zone_name based on territory
  // ----------------------------------------------------------
  function getZoneName(territory: string): string | null {
    for (const zone of zones) {
      if (zone.territories.some((t) => t.territory === territory)) {
        return zone.name;
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // LOAD TL's TEAMS + DSRs + ZONES
  // ----------------------------------------------------------
  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  async function fetchData() {
    try {
      setLoading(true);

      const tl_id = user?.id; // TL is stored inside profiles

      // Load Zones
      const { data: zonesData } = await supabase
        .from('zones')
        .select('id, name, code, zonal_manager, created_at')
        .order('name');

      setZones(zonesData || []);

      // Load TEAMS belonging to TL
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*')
        .eq('tl_id', tl_id)
        .order('name');

      if (teamsErr) throw teamsErr;
      setTeams(teamsData || []);

      // Load DSRs belonging to these teams
      const teamIds = teamsData?.map((t) => t.id) || [];
      let dsrsData: any[] = [];

      if (teamIds.length > 0) {
        const { data, error } = await supabase
          .from('dsrs')
          .select(`
            *,
            team:teams(*),
            profile:profiles(full_name, email)
          `)
          .in('team_id', teamIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Attach zone_name by lookup
        dsrsData = data.map((d) => ({
          ...d,
          zone_name: getZoneName(d.territory_name),
        }));
      }

      setDsrs(dsrsData);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error loading data',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // CREATE NEW DSR
  // ----------------------------------------------------------
  async function handleSubmit(e: any) {
    e.preventDefault();

    const { full_name, email, password, dsr_number, team_id } = formData;

    if (!full_name || !email || !password || !dsr_number || !team_id) {
      return toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Fill in all required fields.',
      });
    }

    setSubmitting(true);
    try {
      let newUserId = null;

      // SIGN UP USER
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name } },
      });

      if (authErr) {
        if (authErr.message.includes('already')) {
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (!existing) throw new Error('User exists but profile missing');
          newUserId = existing.id;
        } else throw authErr;
      } else {
        newUserId = authData.user?.id;
      }

      const team = teams.find((t) => t.id === team_id);
      if (!team) throw new Error('Team not found');

      const territory_name = team.territory_name;
      const zone_name = getZoneName(territory_name);

      // INSERT DSR
      const newDSR = {
        user_id: newUserId,
        dsr_number,
        team_id,
        territory_name,
        zone_name,
      };

      const { error: dsrErr } = await supabase.from('dsrs').insert(newDSR);
      if (dsrErr) throw dsrErr;

      toast({ title: 'DSR Created Successfully' });
      setDialogOpen(false);
      setFormData({
        full_name: '',
        email: '',
        password: '',
        dsr_number: '',
        team_id: '',
      });

      fetchData();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ----------------------------------------------------------
  // EDIT DSR
  // ----------------------------------------------------------
  function handleEdit(dsr: DSR) {
    setEditingDSR(dsr);
    setEditFormData({
      dsr_number: dsr.dsr_number || '',
      team_id: dsr.team_id || '',
    });
    setEditDialogOpen(true);
  }

  async function handleUpdateSubmit(e: any) {
    e.preventDefault();
    if (!editingDSR) return;

    const team = teams.find((t) => t.id === editFormData.team_id);
    if (!team) {
      toast({
        variant: 'destructive',
        title: 'Invalid Team',
      });
      return;
    }

    const territory_name = team.territory_name;
    const zone_name = getZoneName(territory_name);

    try {
      const { error } = await supabase
        .from('dsrs')
        .update({
          dsr_number: editFormData.dsr_number,
          team_id: editFormData.team_id,
          territory_name,
          zone_name,
        })
        .eq('id', editingDSR.id);

      if (error) throw error;

      toast({ title: 'DSR Updated Successfully' });
      setEditDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error Updating DSR',
        description: err.message,
      });
    }
  }

  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------
  async function handleDelete(id: string) {
    if (!confirm('Delete this DSR?')) return;

    try {
      const { error } = await supabase.from('dsrs').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'DSR Deleted' });
      fetchData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
    }
  }

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* ---------------- HEADER ---------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">DSR Management</h1>
          <p className="text-muted-foreground">Manage DSRs under your teams</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Create DSR
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New DSR</DialogTitle>
              <DialogDescription>Add a new Direct Sales Representative</DialogDescription>
            </DialogHeader>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4 py-2">

              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>DSR Number *</Label>
                <Input
                  value={formData.dsr_number}
                  onChange={(e) => setFormData({ ...formData, dsr_number: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Assign Team *</Label>

                <Select
                  value={formData.team_id}
                  onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>

                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} — {team.territory_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create DSR'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ---------------- TABLE ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>All DSRs</CardTitle>
          <CardDescription>DSRs under your teams</CardDescription>
        </CardHeader>

        <CardContent>
          {dsrs.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No DSRs yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DSR No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {dsrs.map((dsr) => (
                  <TableRow key={dsr.id}>
                    <TableCell className="font-mono">{dsr.dsr_number}</TableCell>
                    <TableCell>{dsr.profile?.full_name || 'N/A'}</TableCell>
                    <TableCell>{dsr.profile?.email || 'N/A'}</TableCell>

                    <TableCell>
                      <Badge>{dsr.team?.name}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">{dsr.territory_name}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{dsr.zone_name}</Badge>
                    </TableCell>

                    <TableCell>{new Date(dsr.created_at).toLocaleDateString()}</TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(dsr)}>
                          Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
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

      {/* ---------------- EDIT DSR ---------------- */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit DSR</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>DSR Number</Label>
              <Input
                value={editFormData.dsr_number}
                onChange={(e) => setEditFormData({ ...editFormData, dsr_number: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Assign Team</Label>

              <Select
                value={editFormData.team_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, team_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>

                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} — {team.territory_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update DSR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
