import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const DEAgentSales = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch DE info
  const { data: deInfo } = useQuery({
    queryKey: ['de-info'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('distribution_executives')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch active agents
  const { data: agents } = useQuery({
    queryKey: ['de-active-agents', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return [];

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('de_id', deInfo.id)
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!deInfo?.id,
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch agent sales
  const { data: sales, isLoading } = useQuery({
    queryKey: ['agent-sales', deInfo?.id],
    queryFn: async () => {
      if (!deInfo?.id) return [];

      const { data, error } = await supabase
        .from('agent_sales')
        .select(`
          *,
          agents(name),
          products(name)
        `)
        .eq('de_id', deInfo.id)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!deInfo?.id,
  });

  // Create sales mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!deInfo?.id) throw new Error('DE info not loaded');

      const { error } = await supabase
        .from('agent_sales')
        .insert({
          ...saleData,
          de_id: deInfo.id,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-sales'] });
      queryClient.invalidateQueries({ queryKey: ['de-sales-data'] });
      queryClient.invalidateQueries({ queryKey: ['de-sales-by-date'] });
      toast.success('Sale recorded successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record sale');
    },
  });

  // Delete sales mutation
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('agent_sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-sales'] });
      queryClient.invalidateQueries({ queryKey: ['de-sales-data'] });
      queryClient.invalidateQueries({ queryKey: ['de-sales-by-date'] });
      toast.success('Sale deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete sale');
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAgent('');
    setSelectedProduct('');
    setQuantity('');
    setSaleAmount('');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAgent || !selectedProduct || !quantity || !saleAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const quantityNum = parseInt(quantity);
    const amountNum = parseFloat(saleAmount);

    if (quantityNum <= 0 || amountNum < 0) {
      toast.error('Invalid quantity or amount');
      return;
    }

    createSaleMutation.mutate({
      agent_id: selectedAgent,
      product_id: selectedProduct,
      quantity: quantityNum,
      sale_amount: amountNum,
      sale_date: saleDate,
      notes: notes || null,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Agent Sales Entry</h1>
          <p className="text-muted-foreground mt-1">
            Manually record sales on behalf of your agents
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Record Agent Sale</DialogTitle>
                <DialogDescription>
                  Enter sales information for your agent
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="agent">Agent *</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product">Product *</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Sale Amount (TZS) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Sale Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes (optional)"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createSaleMutation.isPending}>
                  {createSaleMutation.isPending ? 'Recording...' : 'Record Sale'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sales Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Amount (TZS)</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading sales...
                </TableCell>
              </TableRow>
            ) : sales?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No sales recorded yet. Record your first sale to get started.
                </TableCell>
              </TableRow>
            ) : (
              sales?.map((sale: any) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{sale.agents?.name || '-'}</TableCell>
                  <TableCell>{sale.products?.name || '-'}</TableCell>
                  <TableCell>{sale.quantity}</TableCell>
                  <TableCell>{Number(sale.sale_amount).toLocaleString()}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {sale.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          confirm('Are you sure you want to delete this sale record?')
                        ) {
                          deleteSaleMutation.mutate(sale.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {sales && sales.length > 0 && (
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-bold">{sales.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">
                {sales.reduce((sum, sale) => sum + Number(sale.sale_amount), 0).toLocaleString()} TZS
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold">
                {sales.reduce((sum, sale) => sum + sale.quantity, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agents Involved</p>
              <p className="text-2xl font-bold">
                {new Set(sales.map((sale: any) => sale.agent_id)).size}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
