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
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Edit, Trash2, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/* ---------------------------------------------
   TYPE DEFINITIONS
----------------------------------------------*/
interface TerritoryTSM {
  territory: string;
  tsm_name: string;
}

interface Zone {
  id: string;
  name: string;
  code: string;
  zonal_manager?: string; // RSM renamed → Zonal Manager
  territories?: TerritoryTSM[];
  created_at: string;
  tl_count?: number;
  team_count?: number;
  dsr_count?: number;
}

/* ---------------------------------------------
   COMPONENT START
----------------------------------------------*/
export function AdminZoneManagement() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    zonal_manager: '',
  });
  const [territories, setTerritories] = useState<TerritoryTSM[]>([
    { territory: '', tsm_name: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  /* ---------------------------------------------
     FETCH ZONES
  ----------------------------------------------*/
  useEffect(() => {
    fetchZones();
  }, []);

  async function fetchZones() {
    try {
      setLoading(true);

      const { data: zoneData, error } = await supabase
        .from('zones')
        .select('*')
        .order('name');

      if (error) throw error;

      const zonesWithCounts = await Promise.all(
        (zoneData || []).map(async (zone) => {
          // Get regions in this zone
          const { data: regionsData } = await supabase
            .from('regions')
            .select('id')
            .eq('zone_id', zone.id);
          
          const regionIds = regionsData?.map(r => r.id) || [];
          
          // Count TLs in these regions
          const { count: tlCount } = await supabase
            .from('team_leaders')
            .select('*', { count: 'exact', head: true })
            .in('region_id', regionIds.length > 0 ? regionIds : ['']);

          // Count teams in these regions
          const { count: teamCount } = await supabase
            .from('teams')
            .select('*', { count: 'exact', head: true })
            .in('region_id', regionIds.length > 0 ? regionIds : ['']);

          // Count DSRs through TLs in these regions
          const { data: tlsData } = await supabase
            .from('team_leaders')
            .select('id')
            .in('region_id', regionIds.length > 0 ? regionIds : ['']);
          
          const tlIds = tlsData?.map(tl => tl.id) || [];
          
          const { count: dsrCount } = await supabase
            .from('dsrs')
            .select('*', { count: 'exact', head: true })
            .in('tl_id', tlIds.length > 0 ? tlIds : ['']);

          return {
            ...zone,
            tl_count: tlCount || 0,
            team_count: teamCount || 0,
            dsr_count: dsrCount || 0,
          };
        })
      );

      setZones(zonesWithCounts);
    } catch (error) {
      console.error('Error fetching zones:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load zones',
      });
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------
     HANDLE SAVE (CREATE / UPDATE ZONE)
  ----------------------------------------------*/
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in Zone Name and Code',
      });
      return;
    }

    const validTerritories = territories.filter(
      (t) => t.territory.trim() || t.tsm_name.trim()
    );

    setSubmitting(true);
    try {
      if (editingZone) {
        // Update existing Zone
        const { error } = await supabase
          .from('zones')
          .update({
            name: formData.name,
            code: formData.code.toUpperCase(),
            zonal_manager: formData.zonal_manager || null,
            territories: validTerritories.length > 0 ? validTerritories : [],
          })
          .eq('id', editingZone.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Zone updated successfully',
        });
      } else {
        // Create new zone
        const { error } = await supabase
          .from('zones')
          .insert({
            name: formData.name,
            code: formData.code.toUpperCase(),
            zonal_manager: formData.zonal_manager || null,
            territories: validTerritories.length > 0 ? validTerritories : [],
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Zone created successfully',
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchZones();
    } catch (error: any) {
      console.error('Error saving zone:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save zone',
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------
     HELPERS
  ----------------------------------------------*/
  function resetForm() {
    setFormData({ name: '', code: '', zonal_manager: '' });
    setTerritories([{ territory: '', tsm_name: '' }]);
    setEditingZone(null);
  }

  function addTerritory() {
    setTerritories([...territories, { territory: '', tsm_name: '' }]);
  }

  function removeTerritory(index: number) {
    if (territories.length > 1) {
      setTerritories(territories.filter((_, i) => i !== index));
    }
  }

  function updateTerritory(index: number, field: keyof TerritoryTSM, value: string) {
    const updated = [...territories];
    updated[index][field] = value;
    setTerritories(updated);
  }

  async function handleDelete(zone: Zone) {
    if (
      (zone.tl_count || 0) > 0 ||
      (zone.team_count || 0) > 0 ||
      (zone.dsr_count || 0) > 0
    ) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete',
        description:
          'This zone has TLs, Teams, or DSRs. Reassign them first.',
      });
      return;
    }

    if (!confirm(`Delete Zone "${zone.name}"?`)) return;

    try {
      const { error } = await supabase.from('zones').delete().eq('id', zone.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Zone deleted successfully',
      });

      fetchZones();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete',
      });
    }
  }

  function openEditDialog(zone: Zone) {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      code: zone.code,
      zonal_manager: zone.zonal_manager || '',
    });
    setTerritories(
      zone.territories && zone.territories.length > 0
        ? zone.territories
        : [{ territory: '', tsm_name: '' }]
    );
    setDialogOpen(true);
  }

  /* ---------------------------------------------
     LOADING STATE
  ----------------------------------------------*/
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ---------------------------------------------
     MAIN UI
  ----------------------------------------------*/
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zone Management</h1>
          <p className="text-muted-foreground">
            Manage Zones, Territories & Assigned TSMs
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          </DialogTrigger>

          {/* CREATE / EDIT FORM */}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingZone ? 'Edit Zone' : 'Add New Zone'}
              </DialogTitle>
              <DialogDescription>
                Define Zone details, territories & assigned TSMs.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Zone Name */}
                <div className="space-y-2">
                  <Label>Zone Name *</Label>
                  <Input
                    placeholder="e.g., Southern Zone"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Zone Code */}
                <div className="space-y-2">
                  <Label>Zone Code *</Label>
                  <Input
                    placeholder="e.g., SZ"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={4}
                    required
                  />
                </div>

                {/* Zonal Manager */}
                <div className="space-y-2">
                  <Label>Zonal Manager (Optional)</Label>
                  <Input
                    placeholder="Enter Zonal Manager Name"
                    value={formData.zonal_manager}
                    onChange={(e) =>
                      setFormData({ ...formData, zonal_manager: e.target.value })
                    }
                  />
                </div>

                {/* TERRITORIES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Territories & Assigned TSM</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTerritory}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Territory
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {territories.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Territory name (e.g., Iringa)"
                            value={item.territory}
                            onChange={(e) =>
                              updateTerritory(
                                index,
                                'territory',
                                e.target.value
                              )
                            }
                          />
                          <Input
                            placeholder="TSM Name"
                            value={item.tsm_name}
                            onChange={(e) =>
                              updateTerritory(
                                index,
                                'tsm_name',
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {territories.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTerritory(index)}
                            className="mt-1"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
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
                      Saving...
                    </>
                  ) : editingZone ? (
                    'Update Zone'
                  ) : (
                    'Create Zone'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Zones</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{zones.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total TLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {zones.reduce((sum, z) => sum + (z.tl_count || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {zones.reduce((sum, z) => sum + (z.team_count || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total DSRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {zones.reduce((sum, z) => sum + (z.dsr_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>All Zones</CardTitle>
          <CardDescription>
            List of all zones, territories & assigned TSMs
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Zonal Manager</TableHead>
                <TableHead>Territories</TableHead>
                <TableHead className="text-center">TLs</TableHead>
                <TableHead className="text-center">Teams</TableHead>
                <TableHead className="text-center">DSRs</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {zones.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    No zones available.
                  </TableCell>
                </TableRow>
              ) : (
                zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.name}</TableCell>

                    <TableCell>
                      <Badge variant="outline">{zone.code}</Badge>
                    </TableCell>

                    <TableCell className="text-sm">{zone.zonal_manager || '-'}</TableCell>

                    <TableCell className="text-sm">
                      {zone.territories && zone.territories.length > 0 ? (
                        <div className="space-y-1">
                          {zone.territories.map((t, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="font-medium">{t.territory}</span>
                              {t.tsm_name && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  (TSM: {t.tsm_name})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>

                    <TableCell className="text-center">{zone.tl_count}</TableCell>
                    <TableCell className="text-center">{zone.team_count}</TableCell>
                    <TableCell className="text-center">{zone.dsr_count}</TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(zone.created_at).toLocaleDateString()}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(zone)}>
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(zone)}
                          disabled={
                            (zone.tl_count || 0) > 0 ||
                            (zone.team_count || 0) > 0 ||
                            (zone.dsr_count || 0) > 0
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
