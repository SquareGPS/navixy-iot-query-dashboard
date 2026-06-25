import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, LayoutGrid, Sparkles, Wand2 } from 'lucide-react';

const WIZARD_OPTIONS = [
  {
    path: '/app/dashboard-wizard',
    icon: Wand2,
    title: 'Dashboard Wizard',
    tagline: 'From business question to dashboard in minutes',
    description:
      'Answer a few guided questions about what you want to monitor — equipment health, driver safety, SLA compliance, routes, or custom analytics. We match your goals to the right template, select KPIs, and pack the layout with no empty gaps.',
    bestFor: 'You have a specific operational question and want the fastest path to a working dashboard.',
    highlights: [
      'Business-goal driven (fuel, idle, utilization, harsh driving, and more)',
      'Object scope: all objects, groups, departments, geozones, or garages',
      'Auto layout — panels arranged cleanly after KPI selection',
    ],
    cta: 'Start wizard',
    variant: 'default' as const,
  },
  {
    path: '/app/onboarding',
    icon: Sparkles,
    title: 'Template Gallery',
    tagline: 'Browse proven dashboards built for your role',
    description:
      'Pick your role, explore 14 expert-built report templates grouped by report type — fleet performance, safety, trips, hardware status, and more. Choose a layout you trust, then keep only the metrics that matter to you.',
    bestFor: 'You prefer browsing curated templates and want to see what peers in your role typically use.',
    highlights: [
      'Role-based recommendations (fleet manager, dispatcher, finance, and more)',
      'Full template gallery with previews by report category',
      'Customize KPIs before the dashboard is created',
    ],
    cta: 'Browse templates',
    variant: 'outline' as const,
  },
];

const AppPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl py-4 md:py-10">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
            <LayoutGrid className="h-4 w-4" />
            Get started
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            How do you want to build your dashboard?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Both paths create a full SQL-backed report without writing queries. Choose the
            approach that fits how you think — question-first or template-first.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {WIZARD_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.path}
                className="group relative border-2 transition-all hover:border-accent/50 hover:shadow-lg"
              >
                <CardHeader className="space-y-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-accent p-3 text-white shadow-sm">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-2xl">{option.title}</CardTitle>
                      <p className="text-sm font-medium text-accent">{option.tagline}</p>
                    </div>
                  </div>
                  <CardDescription className="text-base leading-relaxed text-[var(--text-secondary)]">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Best for:</span>{' '}
                    {option.bestFor}
                  </p>
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    {option.highlights.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="lg"
                    variant={option.variant}
                    className="w-full h-12 text-base group-hover:shadow-md"
                    onClick={() => navigate(option.path)}
                  >
                    {option.cta}
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have reports? Pick one from the sidebar to open it.
        </p>
      </div>
    </AppLayout>
  );
};

export default AppPage;
