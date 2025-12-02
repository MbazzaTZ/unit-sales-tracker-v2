import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  UserCheck, 
  ShoppingCart, 
  BarChart3, 
  Settings,
  Target,
  MapPin,
  CheckSquare,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@/types/tsm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SidebarProps {
  role: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const adminMenuItems = [
  { id: 'general', label: 'General Overview', icon: BarChart3 },
  { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { id: 'regions', label: 'Regions & Territories', icon: MapPin },
  { id: 'stock', label: 'Stock Management', icon: Package },
  { id: 'assign', label: 'Assign Stock', icon: Target },
  { id: 'tls', label: 'TL Management', icon: UserCheck },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: Settings },
];

const tlMenuItems = [
  { id: 'general', label: 'General Overview', icon: BarChart3 },
  { id: 'dashboard', label: 'TL Dashboard', icon: LayoutDashboard },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'dsrs', label: 'DSRs', icon: UserCheck },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'verification', label: 'Sales Verification', icon: CheckSquare },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: Settings },
];

const dsrMenuItems = [
  { id: 'dashboard', label: 'DSR Dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'My Stock', icon: Package },
  { id: 'add-sale', label: 'Add Sale', icon: ShoppingCart },
  { id: 'my-sales', label: 'My Sales', icon: BarChart3 },
  { id: 'commission', label: 'Commission', icon: Target },
  { id: 'profile', label: 'Profile', icon: Settings },
];

const managerMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock Overview', icon: Package },
  { id: 'sales-team', label: 'Sales Team', icon: Users },
  { id: 'profile', label: 'Profile', icon: Settings },
];

export function Sidebar({ role, activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const menuItems = role === 'admin' 
    ? adminMenuItems 
    : role === 'tl' 
      ? tlMenuItems 
      : role === 'manager'
        ? managerMenuItems
        : dsrMenuItems;

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: 'Logged out successfully',
        description: 'See you next time!',
      });
      
      navigate('/auth');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to logout',
      });
    }
  }

  return (
    <div className={cn(
      'h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">TSM</span>
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground text-sm">TSM Operations</h1>
              <p className="text-xs text-muted-foreground capitalize">{role} Panel</p>
            </div>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
              activeTab === item.id 
                ? 'bg-sidebar-accent text-sidebar-primary' 
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <item.icon className={cn('h-5 w-5 flex-shrink-0', activeTab === item.id && 'text-sidebar-primary')} />
            {!collapsed && (
              <span className="text-sm font-medium">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
}
