import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AppPage from "./pages/App";
import ReportView from "./pages/ReportView";
import Settings from "./pages/Settings";
import SqlEditor from "./pages/SqlEditor";
import NotFound from "./pages/NotFound";
import LineChartTest from "./pages/LineChartTest";
import CompositeReportView from "./pages/CompositeReportView";
import CompositeReportEditor from "./pages/CompositeReportEditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/app" element={<AppPage />} />
              <Route path="/app/report/:reportId" element={<ReportView />} />
              <Route path="/app/settings" element={<Settings />} />
              <Route path="/app/sql-editor" element={<SqlEditor />} />
              <Route path="/app/composite-report/:id" element={<CompositeReportView />} />
              <Route path="/app/composite-report/new" element={<CompositeReportEditor />} />
              <Route path="/app/composite-report/:id/edit" element={<CompositeReportEditor />} />
              <Route path="/test/line-chart" element={<LineChartTest />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
