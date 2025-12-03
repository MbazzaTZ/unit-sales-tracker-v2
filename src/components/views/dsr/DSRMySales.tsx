import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Filter,
  MoreVertical,
  Package,
  Printer,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface DSRMySalesProps {
  onNavigate: (tab: string) => void;
}

interface SaleRecord {
  id: string;
  created_at: string;
  stock_type: "FS" | "DO" | "DVS";
  smartcard_number: string;
  package_type: string;
  dstv_package_id: string | null;
  payment_status: "paid" | "unpaid";
  notes: string | null;

  // Commission calculated in DB triggers
  upfront_commission: number;
  activation_commission: number;
  package_commission: number;
  bonus_commission: number;
  total_commission: number;

  stock?: {
    id: string;
    type: string;
    smartcard_number: string;
  } | null;
}

export default function DSRMySales({ onNavigate }: DSRMySalesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [filterType, setFilterType] = useState<"all" | "FS" | "DO" | "DVS">("all");

  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (user) loadSales();
  }, [user]);

  async function loadSales() {
    try {
      setLoading(true);

      const { data: dsr } = await supabase
        .from("dsrs")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!dsr) return;

      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          stock:stock_id (
            id,
            type,
            smartcard_number
          )
        `)
        .eq("dsr_id", dsr.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSales(data || []);
      setFilteredSales(data || []);
    } catch (err) {
      toast.error("Failed to load sales");
    } finally {
      setLoading(false);
    }
  }

  // FILTER + SEARCH
  useEffect(() => {
    let result = [...sales];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.smartcard_number.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "all") {
      result = result.filter((s) => s.payment_status === filterStatus);
    }

    if (filterType !== "all") {
      result = result.filter((s) => s.stock_type === filterType);
    }

    setFilteredSales(result);
  }, [search, filterStatus, filterType, sales]);

  const STOCK_PRICES = {
    FS: 65000,
    DO: 25000,
    DVS: 27500,
  };

  async function deleteSale(sale: SaleRecord) {
    if (!confirm("Delete this sale?")) return;

    const { error } = await supabase.from("sales").delete().eq("id", sale.id);

    if (error) {
      toast.error("Failed to delete sale");
      return;
    }

    toast.success("Sale deleted");
    loadSales();
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">My Sales</h1>
          <p className="text-muted-foreground">Track your recorded sales</p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* TOTAL SALES */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold">{filteredSales.length}</p>
          </CardContent>
        </Card>

        {/* TOTAL AMOUNT */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">
              TZS{" "}
              {filteredSales
                .reduce((sum, sale) => sum + STOCK_PRICES[sale.stock_type], 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* PAID */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-success">
              {filteredSales.filter((s) => s.payment_status === "paid").length}
            </p>
          </CardContent>
        </Card>

        {/* UNPAID */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Unpaid</p>
            <p className="text-2xl font-bold text-danger">
              {filteredSales.filter((s) => s.payment_status === "unpaid").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH + FILTER */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* SEARCH BAR */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by sale ID or smartcard"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "paid" | "unpaid")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "FS" | "DO" | "DVS")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stock Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="FS">FS</SelectItem>
                <SelectItem value="DO">DO</SelectItem>
                <SelectItem value="DVS">DVS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SALES TABLE */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Card / Serial</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.id}</TableCell>
                    <TableCell>{new Date(sale.created_at).toLocaleString()}</TableCell>

                    <TableCell>
                      <Badge variant="outline">{sale.stock_type}</Badge>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono">
                        {sale.smartcard_number}
                      </span>
                    </TableCell>

                    <TableCell>{sale.package_type}</TableCell>

                    <TableCell>
                      {sale.payment_status === "paid" ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-600/20">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-600 border-red-600/20">
                          <XCircle className="w-3 h-3 mr-1" />
                          Unpaid
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      TZS {sale.total_commission.toLocaleString()}
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuItem onClick={() => {
                            setSelectedSale(sale);
                            setDetailDialogOpen(true);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => deleteSale(sale)}>
                            <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                            Delete Sale
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                  </TableRow>
                ))}

                {!loading && filteredSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No sales found
                    </TableCell>
                  </TableRow>
                )}

              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DETAIL DIALOG */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>Complete breakdown</DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">

              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm">Sale ID</p>
                <p className="font-bold">{selectedSale.id}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Stock Type</p>
                <Badge>{selectedSale.stock_type}</Badge>
              </div>

              <div>
                <p className="text-sm">Smartcard / Serial</p>
                <p className="font-mono">{selectedSale.smartcard_number}</p>
              </div>

              <div>
                <p className="text-sm">Payment Status</p>
                <p className="font-bold">{selectedSale.payment_status}</p>
              </div>

              <div>
                <p className="text-sm">Package Type</p>
                <p>{selectedSale.package_type}</p>
              </div>

              <Card className="border border-green-500/40 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-green-700">Commission Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Upfront: TZS {selectedSale.upfront_commission.toLocaleString()}</p>
                  <p>Activation: TZS {selectedSale.activation_commission.toLocaleString()}</p>
                  <p>Package: TZS {selectedSale.package_commission.toLocaleString()}</p>
                  <p>Bonus: TZS {selectedSale.bonus_commission.toLocaleString()}</p>
                  <p className="font-bold text-green-700">
                    Total: TZS {selectedSale.total_commission.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {selectedSale.notes && (
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{selectedSale.notes}</p>
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
