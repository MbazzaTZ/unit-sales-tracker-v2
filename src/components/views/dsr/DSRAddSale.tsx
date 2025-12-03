import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent 
} from "@/components/ui/card";
import { 
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem 
} from "@/components/ui/select";
import { Loader2, ArrowLeft, CreditCard, TrendingUp, Search, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

type StockType = "FS" | "DO" | "DVS" | "";
type PackageType = "Package" | "No Package" | "";

interface StockItem {
  id: string;
  type: string;
  smartcard_number: string;
}

interface DSRAddSaleProps {
  onNavigate: (tab: string) => void;
}

// Monthly package prices are in the database.
// Only used for the frontend preview calculation.
const FRONTEND_PACKAGE_RATE = {
  ACCESS: 6000,
  FAMILY: 25000,
  COMPACT: 42000,
  COMPACT_PLUS: 75000,
  PREMIUM: 105000,
};

export default function DSRAddSale({ onNavigate }: DSRAddSaleProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [dsrId, setDsrId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);

  const [availableStock, setAvailableStock] = useState<StockItem[]>([]);
  const [filteredStock, setFilteredStock] = useState<StockItem[]>([]);
  
  const [stockType, setStockType] = useState<StockType>("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [manualSerial, setManualSerial] = useState("");

  const [packageType, setPackageType] = useState<PackageType>("");
  const [dstvPackage, setDstvPackage] = useState("");

  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [notes, setNotes] = useState("");
  const [smartcardSearch, setSmartcardSearch] = useState("");

  const [estimatedCommission, setEstimatedCommission] = useState(0);

  /* ----------------------- FETCH DSR RECORD -------------------------- */
  useEffect(() => {
    if (!user) return;
    loadDSRRecord();
  }, [user]);

  async function loadDSRRecord() {
    setLoading(true);
    const { data, error } = await supabase
      .from("dsrs")
      .select("id, tl_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) {
      toast.error("Failed loading your profile");
      return;
    }

    if (data) {
      setDsrId(data.id);
      setTlId(data.tl_id);
      fetchStock(data.id);
    } else {
      toast.error("You are not registered as a DSR");
    }

    setLoading(false);
  }

  /* ----------------------- FETCH STOCK -------------------------- */
  async function fetchStock(dsrId: string) {
    const { data, error } = await supabase
      .from("stock")
      .select("id, type, smartcard_number")
      .eq("assigned_to_dsr", dsrId)
      .eq("status", "in-hand");

    if (error) {
      toast.error("Failed loading stock");
      return;
    }

    setAvailableStock(data || []);
    setFilteredStock(data || []);
  }

  /* ----------------------- SEARCH FILTER -------------------------- */
  useEffect(() => {
    if (!smartcardSearch) {
      setFilteredStock(availableStock);
    } else {
      const q = smartcardSearch.toLowerCase();
      setFilteredStock(
        availableStock.filter(
          (s) =>
            s.smartcard_number?.toLowerCase().includes(q) ||
            s.type?.toLowerCase().includes(q)
        )
      );
    }
  }, [smartcardSearch, availableStock]);

  /* ----------------------- FETCH DSTV PACKAGES ---------------------- */
  const { data: dstvPackages } = useQuery({
    queryKey: ["dstv-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dstv_packages")
        .select("*")
        .eq("is_active", true)
        .order("monthly_price");

      if (error) throw error;
      return data;
    },
  });

  /* ----------------------- COMMISSION PREVIEW ---------------------- */
  const { data: commissionRates } = useQuery({
    queryKey: ["commission-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rates")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;

      const mapped: any = {};
      data.forEach((r) => {
        mapped[r.product_type] = {
          upfront: r.upfront_amount,
          activation: r.activation_amount,
          packageRate: r.package_commission_rate,
        };
      });

      return mapped;
    },
  });

  useEffect(() => {
    if (!commissionRates || !stockType) {
      setEstimatedCommission(0);
      return;
    }

    const base = commissionRates[stockType];
    let commission = base.upfront;

    if (paymentStatus === "paid") {
      commission += base.activation;

      if (packageType === "Package" && dstvPackage) {
        const pkg = dstvPackages?.find(
          (p) => p.package_code === dstvPackage
        );
        if (pkg) {
          commission += Math.floor(
            (pkg.monthly_price * base.packageRate) / 100
          );
        }
      }
    }

    setEstimatedCommission(commission);
  }, [stockType, paymentStatus, dstvPackage, packageType, commissionRates, dstvPackages]);

  /* ----------------------- SUBMIT SALE ---------------------------- */
  async function handleSubmitSale() {
    if (!stockType) return toast.error("Select stock type");
    if (!packageType) return toast.error("Select package option");

    if (stockType === "DVS" && !manualSerial.trim()) {
      return toast.error("Enter DVS serial number");
    }

    if (stockType !== "DVS" && !selectedStockId) {
      return toast.error("Select a smartcard");
    }

    if (stockType === "DVS" && packageType === "No Package") {
      return toast.error("DVS requires a package");
    }

    setSubmitting(true);

    try {
      let smartcard = manualSerial.trim();

      if (stockType !== "DVS") {
        const found = availableStock.find((s) => s.id === selectedStockId);
        smartcard = found?.smartcard_number || "";
      }

      let packageId = null;

      if (packageType === "Package" && dstvPackage) {
        const { data } = await supabase
          .from("dstv_packages")
          .select("id")
          .eq("package_code", dstvPackage)
          .maybeSingle();

        packageId = data?.id || null;
      }

      const { error: saleError } = await supabase
        .from("sales")
        .insert({
          dsr_id: dsrId,
          tl_id: tlId,
          stock_id: stockType !== "DVS" ? selectedStockId : null,
          stock_type: stockType,
          smartcard_number: smartcard,
          package_type: packageType,
          dstv_package_id: packageId,
          payment_status: paymentStatus,
          notes: notes || null,
        });

      if (saleError) throw saleError;

      if (stockType !== "DVS") {
        await supabase
          .from("stock")
          .update({ status: "sold" })
          .eq("id", selectedStockId);
      }

      toast.success("Sale recorded!");

      setStockType("");
      setSelectedStockId("");
      setManualSerial("");
      setPackageType("");
      setDstvPackage("");
      setNotes("");

      setTimeout(() => onNavigate("my-sales"), 800);
    } catch (e: any) {
      toast.error(e.message || "Sale failed");
    }

    setSubmitting(false);
  }

  /* ----------------------- UI ---------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => onNavigate("dashboard")} size="icon">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Add New Sale</h1>
          <p className="text-muted-foreground">Record a new sale transaction</p>
        </div>
      </div>

      {/* FORM SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT SIDE */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card>
            <CardHeader>
              <CardTitle>Stock Information</CardTitle>
              <CardDescription>Select the stock you are selling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* STOCK TYPE */}
              <div>
                <Label>Stock Type *</Label>
                <Select 
                  value={stockType} 
                  onValueChange={(v) => {
                    setStockType(v as StockType);
                    setSelectedStockId("");
                    setManualSerial("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select FS / DO / DVS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FS">Full Set (FS)</SelectItem>
                    <SelectItem value="DO">Decoder Only (DO)</SelectItem>
                    <SelectItem value="DVS">Digital Virtual Stock (DVS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SMARTCARD SEARCH / SELECTION */}
              {stockType && stockType !== "DVS" && (
                <>
                  <Label>Search Smartcard</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search smartcard…"
                      value={smartcardSearch}
                      className="pl-10"
                      onChange={(e) => setSmartcardSearch(e.target.value)}
                    />
                  </div>

                  <Label>Select Stock *</Label>
                  <Select value={selectedStockId} onValueChange={setSelectedStockId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose smartcard" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStock.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{s.smartcard_number}</span>
                            <span className="text-xs">{s.type}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* DVS MANUAL ENTRY */}
              {stockType === "DVS" && (
                <div>
                  <Label>Enter Serial Number *</Label>
                  <Input
                    placeholder="Enter DVS serial"
                    value={manualSerial}
                    onChange={(e) => setManualSerial(e.target.value)}
                  />
                </div>
              )}

              {/* PACKAGE TYPE */}
              <div>
                <Label>Package Option *</Label>
                <Select 
                  value={packageType} 
                  onValueChange={(v) => {
                    setPackageType(v as PackageType);
                    if (v === "No Package") setDstvPackage("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Package">With Package</SelectItem>
                    <SelectItem value="No Package" disabled={stockType === "DVS"}>
                      No Package {stockType === "DVS" && "(Not allowed for DVS)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* DSTV PACKAGE LIST */}
              {packageType === "Package" && (
                <div>
                  <Label>DStv Package *</Label>
                  <Select value={dstvPackage} onValueChange={setDstvPackage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select package" />
                    </SelectTrigger>
                    <SelectContent>
                      {dstvPackages?.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.package_code}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{pkg.package_name}</p>
                            </div>
                            <span className="text-sm">
                              TZS {pkg.monthly_price.toLocaleString()}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            </CardContent>
          </Card>

          {/* NOTES */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>

        </div>

        {/* RIGHT SIDE - SUMMARY */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Sale Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* STOCK SUMMARY */}
              {stockType && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Stock Type</span>
                    <span className="text-lg font-bold">{stockType}</span>
                  </div>
                </div>
              )}

              {/* SMARTCARD / SERIAL SUMMARY */}
              {(selectedStockId || manualSerial) && (
                <div className="p-2 bg-secondary/50 rounded">
                  <p className="text-xs text-muted-foreground">
                    {stockType === "DVS" ? "Serial Number" : "Smartcard"}
                  </p>
                  <p className="font-mono font-medium">
                    {stockType === "DVS" ? manualSerial : filteredStock.find(s => s.id === selectedStockId)?.smartcard_number}
                  </p>
                </div>
              )}

              {/* PACKAGE SUMMARY */}
              {dstvPackage && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-bold">
                    {dstvPackages?.find(p => p.package_code === dstvPackage)?.package_name}
                  </p>
                  <p className="text-xs">
                    TZS {dstvPackages?.find(p => p.package_code === dstvPackage)?.monthly_price.toLocaleString()}
                  </p>
                </div>
              )}

              {/* COMMISSION SUMMARY */}
              {estimatedCommission > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold">Estimated Commission</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    TZS {estimatedCommission.toLocaleString()}
                  </p>
                </div>
              )}

              {/* PAYMENT STATUS */}
              <div>
                <Label>Payment Status *</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SUBMIT BUTTON */}
              <Button 
                onClick={handleSubmitSale}
                disabled={
                  submitting ||
                  !stockType ||
                  (stockType !== "DVS" && !selectedStockId) ||
                  (stockType === "DVS" && !manualSerial.trim()) ||
                  !packageType
                }
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recording…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Record Sale
                  </>
                )}
              </Button>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => onNavigate("dashboard")}
              >
                Cancel
              </Button>

            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
