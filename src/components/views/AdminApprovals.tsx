import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Check, X, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function AdminApprovals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sales pending admin approval (TL verified, paid only)
  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ['pending_approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`*, team:teams(name), region:regions(code)`)
        .eq('tl_verified', true)
        .eq('admin_approved', false)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get DSR info
      const dsrIds = data.map(s => s.dsr_id).filter(Boolean);
      const { data: dsrs } = await supabase.from('dsrs').select('id, user_id').in('id', dsrIds);
      const userIds = dsrs?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      
      return data.map(sale => {
        const dsr = dsrs?.find(d => d.id === sale.dsr_id);
        const profile = profiles?.find(p => p.id === dsr?.user_id);
        return { ...sale, dsr_name: profile?.full_name || '-' };
      });
    }
  });

  // Fetch approved sales
  const { data: approvedSales = [] } = useQuery({
    queryKey: ['approved_sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`*, team:teams(name), region:regions(code)`)
        .eq('admin_approved', true)
        .order('admin_approved_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const dsrIds = data.map(s => s.dsr_id).filter(Boolean);
      const { data: dsrs } = await supabase.from('dsrs').select('id, user_id').in('id', dsrIds);
      const userIds = dsrs?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      
      return data.map(sale => {
        const dsr = dsrs?.find(d => d.id === sale.dsr_id);
        const profile = profiles?.find(p => p.id === dsr?.user_id);
        return { ...sale, dsr_name: profile?.full_name || '-' };
      });
    }
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('sales')
        .update({ 
          admin_approved: true,
          admin_approved_at: new Date().toISOString()
        })
        .eq('id', saleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approved_sales'] });
      toast({ title: 'Sale approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error approving sale', description: error.message, variant: 'destructive' });
    }
  });

  // Reject mutation (sets admin_approved to false, stays pending)
  const rejectMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('sales')
        .update({ tl_verified: false })
        .eq('id', saleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
      toast({ title: 'Sale rejected and sent back to TL' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error rejecting sale', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales Approvals</h1>
        <p className="text-muted-foreground">Approve verified paid sales from Team Leaders</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="pending">
            Pending ({pendingSales.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="glass rounded-xl border border-border/50">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              </div>
            ) : pendingSales.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Sale ID</TableHead>
                    <TableHead className="text-muted-foreground">DSR</TableHead>
                    <TableHead className="text-muted-foreground">Team</TableHead>
                    <TableHead className="text-muted-foreground">Smart Card</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Region</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingSales.map((sale) => (
                    <TableRow key={sale.id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell className="font-mono font-medium text-foreground">{sale.sale_id}</TableCell>
                      <TableCell className="text-foreground">{sale.dsr_name}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.team?.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{sale.smart_card_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.sale_type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sale.region?.code || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            className="bg-success hover:bg-success/90"
                            onClick={() => approveMutation.mutate(sale.id)}
                            disabled={approveMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => rejectMutation.mutate(sale.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="approved">
          <div className="glass rounded-xl border border-border/50">
            {approvedSales.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No approved sales yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Sale ID</TableHead>
                    <TableHead className="text-muted-foreground">DSR</TableHead>
                    <TableHead className="text-muted-foreground">Team</TableHead>
                    <TableHead className="text-muted-foreground">Smart Card</TableHead>
                    <TableHead className="text-muted-foreground">Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedSales.map((sale) => (
                    <TableRow key={sale.id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell className="font-mono font-medium text-foreground">{sale.sale_id}</TableCell>
                      <TableCell className="text-foreground">{sale.dsr_name}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.team?.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{sale.smart_card_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.admin_approved_at && new Date(sale.admin_approved_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
