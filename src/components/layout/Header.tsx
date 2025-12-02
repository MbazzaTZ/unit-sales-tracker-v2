import { Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserRole } from '@/types/tsm';
import { cn } from '@/lib/utils';

interface HeaderProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export function Header({ role, onRoleChange }: HeaderProps) {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search..." 
            className="w-64 pl-9 bg-secondary border-border focus:border-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Switcher (Demo) */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {(['admin', 'tl', 'dsr'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => onRoleChange(r)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                role === r 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
            5
          </span>
        </Button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">David Mbazza</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
          <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    </header>
  );
}
