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

  // -------------------------------------------------------
  // FETCH PENDING SALES
  // -------------------------------------------------------
  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ['pending_approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          team:teams(name, zone_name)
        `)
        .eq('tl_verified', true)
        .eq('admin_approved', false)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch DSR names
      const dsrIds = data.map(s => s.dsr_id).filter(Boolean);
      const { data: dsrs } = await supabase
        .from('dsrs')
        .select('id, user_id')
        .in('id', dsrIds);

      const userIds = dsrs?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      return data.map(sale => {
        const dsr = dsrs?.find(d => d.id === sale.dsr_id);
        const profile = profiles?.find(p => p.id === dsr?.user_id);
        return {
          ...sale,
          dsr_name: profile?.full_name || '-'
        };
      });
    },
  });

  // -------------------------------------------------------
  // FETCH APPROVED SALES
  // -------------------------------------------------------
  const { data: approvedSales = [] } = useQuery({
    queryKey: ['approved_sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          team:teams(name, zone_name)
        `)
        .eq('admin_approved', true)
        .order('admin_approved_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const dsrIds = data.map(s => s.dsr_id).filter(Boolean);
      const { data: dsrs } = await supabase
        .from('dsrs')
        .select('id, user_id')
        .in('id', dsrIds);

      const userIds = dsrs?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      return data.map(sale => {
        const dsr = dsrs?.find(d => d.id === sale.dsr_id);
        const profile = profiles?.find(p => p.id === dsr?.user_id);

        return {
          ...sale,
          dsr_name: profile?.full_name || '-',
        };
      });
    },
  });

  // -------------------------------------------------------
  // APPROVE SALE
  // -------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('sales')
        .update({
          admin_approved: true,
          admin_approved_at: new Date().toISOString(),
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
      toast({
        title: 'Error approving sale',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------
  // REJECT SALE (returns to TL)
  // -------------------------------------------------------
  const rejectMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('sales')
        .update({
          tl_verified: false,
        })
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
      toast({ title: 'Sale rejected and sent back to TL' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error rejecting sale',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------
  // UI RENDER
  // -------------------------------------------------------
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales Approvals</h1>
        <p className="text-muted-foreground">
          Approve Team Leader–verified sales
        </p>
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

        {/* ------------------------------------------------ */}
        {/* PENDING TAB */}
        {/* ------------------------------------------------ */}
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
                  <TableRow>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>DSR</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Smart Card</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pendingSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono">{sale.sale_id}</TableCell>
                      <TableCell>{sale.dsr_name}</TableCell>
                      <TableCell>{sale.team?.name || '-'}</TableCell>
                      <TableCell>{sale.smart_card_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.sale_type}</Badge>
                      </TableCell>
                      <TableCell>{sale.team?.zone_name}</TableCell>

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

        {/* ------------------------------------------------ */}
        {/* APPROVED TAB */}
        {/* ------------------------------------------------ */}
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
                  <TableRow>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>DSR</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Smart Card</TableHead>
                    <TableHead>Approved</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {approvedSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono">{sale.sale_id}</TableCell>
                      <TableCell>{sale.dsr_name}</TableCell>
                      <TableCell>{sale.team?.name || '-'}</TableCell>
                      <TableCell>{sale.smart_card_number}</TableCell>

                      <TableCell>
                        {sale.admin_approved_at &&
                          new Date(sale.admin_approved_at).toLocaleDateString()}
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
