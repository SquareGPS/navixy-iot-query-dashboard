import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/Button';
import { LogOut, Moon, Sun, Settings, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/ui/SearchInput';

export function AppHeader() {
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-border bg-surface-1 sticky top-0 z-50">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="hover:bg-surface-3 transition-colors" />
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-text-primary">Navixy Reports</h1>
          </div>
        </div>
        
        {/* Global search bar */}
        <div className="flex-1 max-w-md mx-8">
          <SearchInput />
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="hover:bg-surface-3 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-3 px-3 py-2 hover:bg-surface-3 transition-colors">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-accent-hover text-white flex items-center justify-center font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-text-primary">{user?.email}</div>
                  <div className="text-xs text-text-muted capitalize">{user?.role}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-surface-2 border-border">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-text-primary">{user?.email}</span>
                  <span className="text-xs text-text-muted capitalize">{user?.role}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.role === 'admin' && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/app/settings')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/app/sql-editor')} className="cursor-pointer">
                    <Database className="mr-2 h-4 w-4" />
                    SQL Editor
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={signOut} className="text-danger cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
