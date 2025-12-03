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
import { UserPlus, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function AdminTLManagement() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regionId, setRegionId] = useState('');
  const [target, setTarget] = useState('');
  
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

  // Fetch TLs with profiles
  const { data: teamLeaders = [], isLoading } = useQuery({
    queryKey: ['team_leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_leaders')
        .select(`
          *,
          region:regions(name, code)
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
          monthly_target: parseInt(target) || 0
        });
      
      if (tlError) throw tlError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_leaders'] });
      toast({ title: 'Team Leader created successfully' });
      setEmail('');
      setPassword('');
      setFullName('');
      setRegionId('');
      setTarget('');
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating TL', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = () => {
    if (!email || !password || !fullName) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    createTLMutation.mutate();
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
              <DialogTitle>Create Team Leader</DialogTitle>
              <DialogDescription>Add a new team leader account</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
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
                disabled={createTLMutation.isPending}
              >
                {createTLMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Team Leader
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
                <TableHead className="text-muted-foreground">Target</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
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
                  <TableCell className="text-foreground">{tl.monthly_target}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(tl.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
