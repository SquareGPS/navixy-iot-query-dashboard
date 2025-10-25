import React, { useState } from 'react';
import { Settings, Database } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { MenuEditor } from '@/components/menu/MenuEditor';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [useNewMenuEditor, setUseNewMenuEditor] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar variant="inset">
      <SidebarContent>
        {/* Main Menu Content */}
        {useNewMenuEditor ? (
          <MenuEditor />
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/')}
                    isActive={isActive('/')}
                  >
                    <Database className="h-4 w-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/sql-editor')}
                    isActive={isActive('/sql-editor')}
                  >
                    <Database className="h-4 w-4" />
                    <span>SQL Editor</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate('/settings')}
                  isActive={isActive('/settings')}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with toggle for development */}
      {process.env.NODE_ENV === 'development' && (
        <SidebarFooter>
          <div className="p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseNewMenuEditor(!useNewMenuEditor)}
              className="w-full"
            >
              {useNewMenuEditor ? 'Use Old Sidebar' : 'Use New Menu Editor'}
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
