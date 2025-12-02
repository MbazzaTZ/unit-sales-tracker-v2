import { Button } from '@/components/ui/button';
import { 
  Package, 
  UserPlus, 
  Users, 
  BadgePlus, 
  ShoppingCart, 
  FileBarChart,
  Download
} from 'lucide-react';

export function ActionPanel() {
  return (
    <div className="glass rounded-xl p-5 border border-border/50 animate-fade-in">
      <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-xs">Assign Stock</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50">
          <UserPlus className="h-5 w-5 text-success" />
          <span className="text-xs">Create TL</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50">
          <Users className="h-5 w-5 text-info" />
          <span className="text-xs">Create Team</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50">
          <BadgePlus className="h-5 w-5 text-warning" />
          <span className="text-xs">Create DSR</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50">
          <ShoppingCart className="h-5 w-5 text-success" />
          <span className="text-xs">Add Sale</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50">
          <FileBarChart className="h-5 w-5 text-primary" />
          <span className="text-xs">Reports</span>
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50">
        <h4 className="text-sm font-medium text-foreground mb-3">Export Center</h4>
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4 mr-2" />
            Export Sales
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4 mr-2" />
            Export Stock
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4 mr-2" />
            Export Performance
          </Button>
        </div>
      </div>
    </div>
  );
}
