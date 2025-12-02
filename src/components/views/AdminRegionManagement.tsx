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

interface TerritoryTSM {
  territory: string;
  tsm_name: string;
}

interface Region {
  id: string;
  name: string;
  code: string;
  rsm_name?: string;
  territories?: TerritoryTSM[];
  created_at: string;
  tl_count?: number;
  team_count?: number;
  dsr_count?: number;
}

export function AdminRegionManagement() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    rsm_name: ''
  });
  const [territories, setTerritories] = useState<TerritoryTSM[]>([{ territory: '', tsm_name: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRegions();
  }, []);

  async function fetchRegions() {
    try {
      setLoading(true);
      const { data: regionsData, error } = await supabase
        .from('regions')
        .select('*')
        .order('name');

      if (error) throw error;

      // Fetch counts for each region
      const regionsWithCounts = await Promise.all(
        (regionsData || []).map(async (region) => {
          const { count: tlCount } = await supabase
            .from('team_leaders')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', region.id);

          const { count: teamCount } = await supabase
            .from('teams')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', region.id);

          const { count: dsrCount } = await supabase
            .from('dsrs')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', region.id);

          return {
            ...region,
            tl_count: tlCount || 0,
            team_count: teamCount || 0,
            dsr_count: dsrCount || 0,
          };
        })
      );

      setRegions(regionsWithCounts);
    } catch (error) {
      console.error('Error fetching regions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load regions',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in Regional Name and Code',
      });
      return;
    }

    // Filter out empty territories
    const validTerritories = territories.filter(t => t.territory.trim() || t.tsm_name.trim());

    setSubmitting(true);
    try {
      if (editingRegion) {
        // Update existing region
        const { error } = await supabase
          .from('regions')
          .update({
            name: formData.name,
            code: formData.code.toUpperCase(),
            rsm_name: formData.rsm_name || null,
            territories: validTerritories.length > 0 ? validTerritories : [],
          })
          .eq('id', editingRegion.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Region updated successfully',
        });
      } else {
        // Create new region
        const { error } = await supabase
          .from('regions')
          .insert({
            name: formData.name,
            code: formData.code.toUpperCase(),
            rsm_name: formData.rsm_name || null,
            territories: validTerritories.length > 0 ? validTerritories : [],
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Region created successfully',
        });
      }

      setDialogOpen(false);
      setFormData({ name: '', code: '', rsm_name: '' });
      setTerritories([{ territory: '', tsm_name: '' }]);
      setEditingRegion(null);
      fetchRegions();
    } catch (error: any) {
      console.error('Error saving region:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save region',
      });
    } finally {
      setSubmitting(false);
    }
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

  async function handleDelete(region: Region) {
    if (region.tl_count! > 0 || region.team_count! > 0 || region.dsr_count! > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete',
        description: 'This region has associated team leaders, teams, or DSRs. Please reassign them first.',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${region.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('regions')
        .delete()
        .eq('id', region.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Region deleted successfully',
      });

      fetchRegions();
    } catch (error: any) {
      console.error('Error deleting region:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete region',
      });
    }
  }

  function openEditDialog(region: Region) {
    setEditingRegion(region);
    setFormData({ 
      name: region.name, 
      code: region.code,
      rsm_name: region.rsm_name || ''
    });
    setTerritories(
      region.territories && region.territories.length > 0 
        ? region.territories 
        : [{ territory: '', tsm_name: '' }]
    );
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingRegion(null);
    setFormData({ name: '', code: '', rsm_name: '' });
    setTerritories([{ territory: '', tsm_name: '' }]);
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Region Management</h1>
          <p className="text-muted-foreground">Manage regions and territories</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => closeDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Region
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRegion ? 'Edit Region' : 'Add New Region'}</DialogTitle>
              <DialogDescription>
                {editingRegion
                  ? 'Update the region details below.'
                  : 'Create a new region or territory.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Regional Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Dar es Salaam"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Region Code *</Label>
                  <Input
                    id="code"
                    placeholder="e.g., DSM (3-4 letters)"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    maxLength={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Short code for the region (will be converted to uppercase)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rsm_name">RSM Name</Label>
                  <Input
                    id="rsm_name"
                    placeholder="Regional Sales Manager name"
                    value={formData.rsm_name}
                    onChange={(e) =>
                      setFormData({ ...formData, rsm_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Territories & TSMs</Label>
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
                            placeholder="Territory name"
                            value={item.territory}
                            onChange={(e) =>
                              updateTerritory(index, 'territory', e.target.value)
                            }
                          />
                          <Input
                            placeholder="TSM name"
                            value={item.tsm_name}
                            onChange={(e) =>
                              updateTerritory(index, 'tsm_name', e.target.value)
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
                  onClick={closeDialog}
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
                  ) : (
                    <>{editingRegion ? 'Update' : 'Create'} Region</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Regions</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total TLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regions.reduce((sum, r) => sum + (r.tl_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regions.reduce((sum, r) => sum + (r.team_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total DSRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regions.reduce((sum, r) => sum + (r.dsr_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Regions</CardTitle>
          <CardDescription>
            List of all regions and territories in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>RSM Name</TableHead>
                <TableHead>Territories</TableHead>
                <TableHead className="text-center">TLs</TableHead>
                <TableHead className="text-center">Teams</TableHead>
                <TableHead className="text-center">DSRs</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No regions found. Click "Add Region" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                regions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell className="font-medium">{region.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{region.code}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{region.rsm_name || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {region.territories && region.territories.length > 0 ? (
                        <div className="space-y-1">
                          {region.territories.map((t, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="font-medium">{t.territory}</span>
                              {t.tsm_name && <span className="text-muted-foreground"> ({t.tsm_name})</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">{region.tl_count}</TableCell>
                    <TableCell className="text-center">{region.team_count}</TableCell>
                    <TableCell className="text-center">{region.dsr_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(region.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(region)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(region)}
                          disabled={
                            (region.tl_count || 0) > 0 ||
                            (region.team_count || 0) > 0 ||
                            (region.dsr_count || 0) > 0
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
