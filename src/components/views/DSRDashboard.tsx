import { MetricCard } from '@/components/dashboard/MetricCard';
import { 
  Package, 
  CheckCircle, 
  AlertCircle, 
  ShoppingCart, 
  Calendar,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Tooltip 
} from 'recharts';

const dsrMetrics = {
  stockInHand: 24,
  paidSales: 65,
  unpaidSales: 8,
  todaySales: 4,
  monthlySales: 73,
};

const weeklyData = [
  { day: 'Mon', sales: 8 },
  { day: 'Tue', sales: 12 },
  { day: 'Wed', sales: 10 },
  { day: 'Thu', sales: 15 },
  { day: 'Fri', sales: 11 },
  { day: 'Sat', sales: 9 },
  { day: 'Sun', sales: 4 },
];

interface DSRDashboardProps {
  onNavigate: (tab: string) => void;
}

export function DSRDashboard({ onNavigate }: DSRDashboardProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, John</h1>
        <p className="text-muted-foreground">Here's your performance overview</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard 
          title="Stock In Hand" 
          value={dsrMetrics.stockInHand} 
          icon={Package}
          variant="info"
        />
        <MetricCard 
          title="Paid Sales" 
          value={dsrMetrics.paidSales} 
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard 
          title="Unpaid Sales" 
          value={dsrMetrics.unpaidSales} 
          icon={AlertCircle}
          variant="danger"
        />
        <MetricCard 
          title="Today's Sales" 
          value={dsrMetrics.todaySales} 
          icon={ShoppingCart}
        />
        <MetricCard 
          title="Monthly Sales" 
          value={dsrMetrics.monthlySales} 
          icon={Calendar}
        />
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            onClick={() => onNavigate('stock')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
            variant="outline"
          >
            <Package className="h-6 w-6" />
            <span>My Stock</span>
          </Button>
          <Button 
            onClick={() => onNavigate('add-sale')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-success/10 hover:bg-success/20 text-success border border-success/30"
            variant="outline"
          >
            <ShoppingCart className="h-6 w-6" />
            <span>Add Sale</span>
          </Button>
          <Button 
            onClick={() => onNavigate('my-sales')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-info/10 hover:bg-info/20 text-info border border-info/30"
            variant="outline"
          >
            <TrendingUp className="h-6 w-6" />
            <span>My Sales</span>
          </Button>
          <Button 
            onClick={() => onNavigate('commission')}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30"
            variant="outline"
          >
            <Calendar className="h-6 w-6" />
            <span>Commission</span>
          </Button>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <h2 className="text-lg font-semibold text-foreground mb-4">Last 7 Days Sales</h2>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                stroke="hsl(215, 20%, 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(215, 20%, 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 8%)',
                  border: '1px solid hsl(217, 33%, 17%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 40%, 98%)'
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
