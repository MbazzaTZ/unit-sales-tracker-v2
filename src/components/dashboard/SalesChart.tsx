import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

interface SalesChartProps {
  data?: {
    date: string;
    amount: number;
  }[];
}

export function SalesChart({ data = [] }: SalesChartProps) {
  // Transform your data format to match what the chart expects
  const chartData = data.map(item => ({
    date: item.date,
    total: item.amount,
    paid: item.amount, // You might want to adjust this based on your actual data
    unpaid: 0 // You might want to adjust this based on your actual data
  }));

  // Show placeholder if no data
  if (chartData.length === 0) {
    return (
      <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-foreground">Sales Performance</h3>
            <p className="text-sm text-muted-foreground">Last 30 days trend</p>
          </div>
        </div>
        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
          <p>No sales data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Sales Performance</h3>
          <p className="text-sm text-muted-foreground">Last 30 days trend</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Total Sales</span>
          </div>
        </div>
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="paidGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="unpaidGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(215, 20%, 55%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 8%)',
                border: '1px solid hsl(217, 33%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)'
              }}
              formatter={(value) => [`TZS ${Number(value).toLocaleString()}`, 'Sales']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fill="url(#totalGradient)"
              name="Total Sales"
            />
            {/* You can comment out paid/unpaid areas if you don't have that data */}
            {/* <Area
              type="monotone"
              dataKey="paid"
              stroke="hsl(142, 76%, 46%)"
              strokeWidth={2}
              fill="url(#paidGradient)"
              name="Paid"
            />
            <Area
              type="monotone"
              dataKey="unpaid"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              fill="url(#unpaidGradient)"
              name="Unpaid"
            /> */}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}