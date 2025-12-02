import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { UserPlus, Users, Loader2, Mail, Phone, MapPin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminManagerManagement() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch managers
  const { data: managers = [], isLoading } = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email,
            phone_number,
            created_at
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Create manager mutation
  const createManagerMutation = useMutation({
    mutationFn: async (managerData: {
      email: string;
      password: string;
      fullName: string;
      phoneNumber?: string;
      location?: string;
    }) => {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: managerData.email,
        password: managerData.password,
        options: {
          data: {
            full_name: managerData.fullName,
            phone_number: managerData.phoneNumber,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // 2. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: managerData.fullName,
          phone_number: managerData.phoneNumber,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      // 3. Create manager record
      const { error: managerError } = await supabase
        .from('managers')
        .insert({
          user_id: authData.user.id,
          location: managerData.location || null,
        });

      if (managerError) throw managerError;

      // 4. Assign manager role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'manager',
        });

      if (roleError) throw roleError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers'] });
      toast({
        title: 'Manager created successfully',
        description: 'The manager can now log in with their credentials.',
      });
      setEmail('');
      setPassword('');
      setFullName('');
      setPhoneNumber('');
      setLocation('');
      setIsAddOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error creating manager',
        description: error.message,
      });
    },
  });

  // Delete manager mutation
  const deleteManagerMutation = useMutation({
    mutationFn: async (managerId: string) => {
      // Get manager to find user_id
      const { data: manager } = await supabase
        .from('managers')
        .select('user_id')
        .eq('id', managerId)
        .single();

      if (!manager) throw new Error('Manager not found');

      // Delete manager record (cascade will handle user_roles)
      const { error: deleteError } = await supabase
        .from('managers')
        .delete()
        .eq('id', managerId);

      if (deleteError) throw deleteError;

      // Note: We don't delete the auth user as that requires admin privileges
      // The user will just not have access to manager features
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers'] });
      toast({
        title: 'Manager removed',
        description: 'Manager has been removed from the system.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error removing manager',
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (!email || !password || !fullName) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Weak password',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    createManagerMutation.mutate({
      email,
      password,
      fullName,
      phoneNumber,
      location,
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="glass rounded-xl p-6 border border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" />
              Manager Management
            </h1>
            <p className="text-muted-foreground mt-1">Create and manage manager accounts</p>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <UserPlus className="h-4 w-4" />
                Add Manager
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border/50 max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Manager</DialogTitle>
                <DialogDescription>
                  Add a new manager to the system with full dashboard access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Enter full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    placeholder="manager@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+255 XXX XXX XXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g., Dar es Salaam"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={createManagerMutation.isPending}
                >
                  {createManagerMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Manager
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Managers Table */}
      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">All Managers</h2>
          <p className="text-sm text-muted-foreground">Total: {managers.length} managers</p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : managers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No managers yet</p>
            <p className="text-sm text-muted-foreground">Create your first manager account</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-muted-foreground hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="text-muted-foreground hidden lg:table-cell">Location</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((manager) => (
                  <TableRow key={manager.id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">
                          {manager.profiles?.full_name || 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground md:hidden">
                          {manager.profiles?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {manager.profiles?.email || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {manager.profiles?.phone_number || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {manager.location || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteManagerMutation.mutate(manager.id)}
                        disabled={deleteManagerMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
