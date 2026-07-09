import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { DemoBanner } from './DemoBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      {/*
        Cap the app shell at the viewport height (h-svh) and clip its overflow so the
        document/body never scrolls — <main> below is the single scroll container
        (overflow-auto). This keeps react-remove-scroll a no-op for every modal Radix
        layer app-wide: with no document scrollbar to remove on open, a Dialog or menu
        can't reclaim scrollbar width and shift the page. Do not restore min-h-screen
        here, or the height chain uncaps and the document owns the scrollbar again
        (FR-11509 / FR-11275).
      */}
      <div className="relative h-svh overflow-hidden flex flex-col w-full bg-[var(--surface-1)] text-[var(--text-primary)]">
        <DemoBanner />
        <div className="flex flex-1 min-h-0">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:var(--bg-gradient)]" />
          
          <AppSidebar />
          <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-1)] pt-[56px]">
            <AppHeader />
            <main className="flex-1 overflow-auto bg-[var(--bg)]">
              <div className="container mx-auto px-6 py-8 max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
