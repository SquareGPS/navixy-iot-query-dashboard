import { MenuEditor } from '@/components/menu/MenuEditor';
import { DemoBadge } from './DemoBanner';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarContent>
        {/* Main Menu Content */}
        <MenuEditor />
      </SidebarContent>
      <SidebarFooter className="p-3">
        <DemoBadge />
      </SidebarFooter>
    </Sidebar>
  );
}