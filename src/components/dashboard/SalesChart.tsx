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
import { salesTrendData } from '@/data/mockData';

export function SalesChart() {
  return (
    <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Sales Performance</h3>
          <p className="text-sm text-muted-foreground">Last 7 days trend</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Unpaid</span>
          </div>
        </div>
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={salesTrendData}>
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
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fill="url(#totalGradient)"
            />
            <Area
              type="monotone"
              dataKey="paid"
              stroke="hsl(142, 76%, 46%)"
              strokeWidth={2}
              fill="url(#paidGradient)"
            />
            <Area
              type="monotone"
              dataKey="unpaid"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              fill="url(#unpaidGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
