import { Progress } from '@/components/ui/progress';
import { ArrowRight } from 'lucide-react';

// Default empty data structure
const defaultStockFlowData = [
  { name: 'Admin Stock', value: 0 },
  { name: 'TL Assigned', value: 0 },
  { name: 'Team Assigned', value: 0 },
  { name: 'DSR Stock', value: 0 },
  { name: 'Sold', value: 0 }
];

interface StockFlowChartProps {
  data?: Array<{ name: string; value: number }>;
}

export function StockFlowChart({ data = defaultStockFlowData }: StockFlowChartProps = {}) {
  const stockFlowData = data.length > 0 ? data : defaultStockFlowData;
  const maxValue = Math.max(...stockFlowData.map(item => item.value), 1);

  return (
    <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
      <div className="mb-6">
        <h3 className="font-semibold text-foreground">Stock Movement Flow</h3>
        <p className="text-sm text-muted-foreground">Admin → TL → Team → DSR → Sale</p>
      </div>

      <div className="space-y-4">
        {stockFlowData.map((item, index) => (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {index > 0 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {item.value.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={(item.value / maxValue) * 100} 
                className="h-3"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Conversion Rate</span>
          <span className="font-bold text-success">
            {stockFlowData[0].value > 0 
              ? Math.round((stockFlowData[4].value / stockFlowData[0].value) * 100)
              : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}
