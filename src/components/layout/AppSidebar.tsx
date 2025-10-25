import { MenuEditor } from '@/components/menu/MenuEditor';
import {
  Sidebar,
  SidebarContent,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarContent>
        {/* Main Menu Content */}
        <MenuEditor />
      </SidebarContent>
    </Sidebar>
  );
}