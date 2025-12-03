import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, DollarSign, ShoppingCart, Gift, Loader2 } from 'lucide-react';
import { BONUS_CONFIG } from '@/data/mockData';

interface EarningsData {
  totalSales: number;
  mtdSales: number;
  totalEarnings: number;
  mtdEarnings: number;
  pendingCommission: number;
  bonusProgress: number;
  nextBonusIn: number;
}

interface DSREarningsDashboardProps {
  dsrId?: string | null;
}

export function DSREarningsDashboard({ dsrId }: DSREarningsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData>({
    totalSales: 0,
    mtdSales: 0,
    totalEarnings: 0,
    mtdEarnings: 0,
    pendingCommission: 0,
    bonusProgress: 0,
    nextBonusIn: 0,
  });

  useEffect(() => {
    if (dsrId) {
      fetchEarnings();
    } else {
      setLoading(false);
    }
  }, [dsrId]);

  async function fetchEarnings() {
    if (!dsrId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch earnings from view
      const { data: earningsData, error } = await supabase
        .from('dsr_earnings_view')
        .select('*')
        .eq('dsr_id', dsrId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching earnings:', error);
        setLoading(false);
        return;
      }

      // Fetch pending commission
      const { data: pendingData } = await supabase
        .from('sales')
        .select('total_commission')
        .eq('dsr_id', dsrId)
        .in('commission_status', ['pending', 'pending-payment']);

      const pendingCommission = pendingData?.reduce((sum, sale) => sum + (sale.total_commission || 0), 0) || 0;

      // Calculate bonus progress
      const mtdSales = earningsData?.mtd_sales || 0;
      const bonusProgress = (mtdSales % BONUS_CONFIG.salesThreshold) / BONUS_CONFIG.salesThreshold * 100;
      const nextBonusIn = BONUS_CONFIG.salesThreshold - (mtdSales % BONUS_CONFIG.salesThreshold);

      setEarnings({
        totalSales: earningsData?.total_sales || 0,
        mtdSales: earningsData?.mtd_sales || 0,
        totalEarnings: earningsData?.total_earnings || 0,
        mtdEarnings: earningsData?.mtd_earnings || 0,
        pendingCommission,
        bonusProgress,
        nextBonusIn,
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  }

  // Don't show anything if no dsrId provided
  if (!dsrId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* MTD Earnings */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MTD Earnings</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            TZS {earnings.mtdEarnings.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            From {earnings.mtdSales} sales this month
          </p>
        </CardContent>
      </Card>

      {/* Total Lifetime Earnings */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            TZS {earnings.totalEarnings.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            From {earnings.totalSales} total sales
          </p>
        </CardContent>
      </Card>

      {/* Pending Commission */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <ShoppingCart className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            TZS {earnings.pendingCommission.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Awaiting payment/approval
          </p>
        </CardContent>
      </Card>

      {/* Bonus Progress */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bonus Progress</CardTitle>
          <Gift className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {earnings.nextBonusIn === 0 ? 'Bonus Unlocked! 🎉' : `${earnings.nextBonusIn} more ${earnings.nextBonusIn === 1 ? 'sale' : 'sales'}`}
              </span>
              {earnings.nextBonusIn === 0 && (
                <Badge variant="default" className="bg-purple-600">
                  TZS {BONUS_CONFIG.bonusAmount.toLocaleString()}
                </Badge>
              )}
            </div>
            <Progress value={earnings.bonusProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Every {BONUS_CONFIG.salesThreshold} sales = TZS {BONUS_CONFIG.bonusAmount.toLocaleString()} bonus
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
