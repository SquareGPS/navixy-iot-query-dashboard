import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateReportMutation, useMenuTree } from '@/hooks/use-menu-mutations';
import {
  BUSINESS_GOALS,
  DEFAULT_WIZARD_KPIS,
  OBJECT_SCOPES,
  getGoalLabel,
  getKpisForGoal,
  getScopeLabel,
} from '@/features/dashboard-wizard/catalog';
import {
  buildWizardReportSchema,
  resolveWizardTemplate,
} from '@/features/dashboard-wizard/resolver';
import { getScopeFilterLabel } from '@/features/dashboard-wizard/scopeFilter';
import type {
  BusinessGoalId,
  ObjectScopeId,
  WizardKpiId,
  WizardStep,
} from '@/features/dashboard-wizard/types';
import { toast } from 'sonner';

function WizardShell({
  children,
  step,
}: {
  children: React.ReactNode;
  step: WizardStep;
}) {
  const labels: Record<WizardStep, string> = {
    question: 'Question',
    scope: 'Objects',
    kpi: 'KPIs',
    review: 'Generate',
    creating: 'Creating',
  };
  const order: WizardStep[] = ['question', 'scope', 'kpi', 'review'];
  const idx = order.indexOf(step === 'creating' ? 'review' : step);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:var(--bg-gradient)]" />
      <header className="border-b border-[var(--border)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Dashboard Studio</p>
              <p className="text-sm text-[var(--text-muted)]">Creation wizard · Stage 2</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {order.map((s, i) => (
              <span
                key={s}
                className={i <= idx ? 'text-accent font-medium' : 'text-[var(--text-muted)]'}
              >
                {labels[s]}
                {i < order.length - 1 && <span className="mx-2 opacity-40">→</span>}
              </span>
            ))}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10 max-w-3xl">{children}</main>
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected
          ? 'border-accent bg-accent/10 shadow-sm'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-accent/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selected ? 'border-accent bg-accent' : 'border-[var(--border)]'
          }`}
        >
          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default function DashboardWizardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: menuTree } = useMenuTree();
  const createReportMutation = useCreateReportMutation();

  const [step, setStep] = useState<WizardStep>('question');
  const [goal, setGoal] = useState<BusinessGoalId | null>(null);
  const [scope, setScope] = useState<ObjectScopeId | null>(null);
  const [selectedKpis, setSelectedKpis] = useState<WizardKpiId[]>(DEFAULT_WIZARD_KPIS);

  const availableKpis = goal ? getKpisForGoal(goal) : [];

  const resolution = useMemo(() => {
    if (!goal || !scope || selectedKpis.length === 0) return null;
    return resolveWizardTemplate({ goal, scope, kpis: selectedKpis });
  }, [goal, scope, selectedKpis]);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (goal) {
      const forGoal = getKpisForGoal(goal).map((k) => k.id);
      setSelectedKpis((prev) => {
        const kept = prev.filter((id) => forGoal.includes(id));
        const defaults = DEFAULT_WIZARD_KPIS.filter((id) => forGoal.includes(id));
        return kept.length > 0 ? kept : defaults.length > 0 ? defaults : forGoal.slice(0, 4);
      });
    }
  }, [goal]);

  const toggleKpi = (id: WizardKpiId) => {
    setSelectedKpis((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!user || !goal || !scope || !resolution) return;

    if (user.role === 'viewer') {
      toast.error('Viewers cannot create dashboards. Sign in as Admin or Editor.');
      return;
    }

    setStep('creating');

    try {
      const reportSchema = buildWizardReportSchema(resolution, {
        goal,
        scope,
        kpis: selectedKpis,
      });

      let sortOrder = 1000;
      const rootReports = menuTree?.rootReports ?? [];
      if (rootReports.length > 0) {
        sortOrder = Math.max(...rootReports.map((r) => r.sortOrder)) + 1000;
      }

      const result = await createReportMutation.mutateAsync({
        title: resolution.dashboardTitle,
        sort_order: sortOrder,
        report_schema: reportSchema,
      });

      toast.success('Dashboard created from wizard');
      navigate(`/app/report/${result.id}`);
    } catch (error) {
      setStep('review');
      toast.error(error instanceof Error ? error.message : 'Failed to create dashboard');
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (step === 'creating') {
    return (
      <WizardShell step="creating">
        <div className="flex flex-col items-center py-24 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <p className="text-lg font-medium">Generating dashboard…</p>
          <p className="text-sm text-[var(--text-muted)]">
            Template: {resolution?.templateTitle}
          </p>
        </div>
      </WizardShell>
    );
  }

  if (step === 'question') {
    return (
      <WizardShell step="question">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Step 1 — What question do you want to answer?</h1>
            <p className="text-[var(--text-muted)]">
              Pick a business goal — we&apos;ll match a template and metrics without SQL.
            </p>
          </div>
          <div className="space-y-3">
            {BUSINESS_GOALS.map((g) => (
              <SelectCard
                key={g.id}
                selected={goal === g.id}
                onClick={() => setGoal(g.id)}
                title={g.label}
                description={g.description}
              />
            ))}
          </div>
          <Button
            size="lg"
            className="w-full"
            disabled={!goal}
            onClick={() => setStep('scope')}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </WizardShell>
    );
  }

  if (step === 'scope') {
    return (
      <WizardShell step="scope">
        <div className="space-y-8">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep('question')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Step 2 — How should objects be grouped?</h1>
            <p className="text-[var(--text-muted)]">
              Choose a grouping dimension. When you pick groups, departments, geozones, or garages,
              a matching filter is added to the dashboard Parameters bar and wired to panels that
              expose the same column — select values to narrow results (empty = all).
            </p>
          </div>
          <div className="space-y-3">
            {OBJECT_SCOPES.map((s) => (
              <SelectCard
                key={s.id}
                selected={scope === s.id}
                onClick={() => setScope(s.id)}
                title={s.label}
                description={s.description}
              />
            ))}
          </div>
          <Button
            size="lg"
            className="w-full"
            disabled={!scope}
            onClick={() => setStep('kpi')}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </WizardShell>
    );
  }

  if (step === 'kpi' && goal) {
    return (
      <WizardShell step="kpi">
        <div className="space-y-8">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep('scope')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Step 3 — Which KPIs do you need?</h1>
            <p className="text-[var(--text-muted)]">
              For &ldquo;{getGoalLabel(goal)}&rdquo; — select metrics. SQL queries come from the
              template.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              {availableKpis.map((kpi) => {
                const checked = selectedKpis.includes(kpi.id);
                return (
                  <label
                    key={kpi.id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      onCheckedChange={() => toggleKpi(kpi.id)}
                    />
                    <div>
                      <p className="font-medium">{kpi.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{kpi.description}</p>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>
          <Button
            size="lg"
            className="w-full"
            disabled={selectedKpis.length === 0}
            onClick={() => setStep('review')}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </WizardShell>
    );
  }

  if (step === 'review' && goal && scope && resolution) {
    return (
      <WizardShell step="review">
        <div className="space-y-8">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep('kpi')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Step 4 — Generate dashboard</h1>
            <p className="text-[var(--text-muted)]">
              Review the matched template and metrics before creating.
            </p>
          </div>

          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <CardTitle>Recommended template</CardTitle>
              </div>
              <CardDescription>
                Based on your answers, we selected a ready-made dashboard from the schema library
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[var(--text-muted)]">Business question</p>
                  <p className="font-medium">{getGoalLabel(goal)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">Objects</p>
                  <p className="font-medium">{getScopeLabel(scope)}</p>
                  {getScopeFilterLabel(scope) && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Parameters filter: {getScopeFilterLabel(scope)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">Template</p>
                  <p className="font-medium">{resolution.templateTitle}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">Dashboard name</p>
                  <p className="font-medium">{resolution.dashboardTitle}</p>
                </div>
              </div>
              <div>
                <p className="text-[var(--text-muted)] mb-2">Selected KPIs</p>
                <div className="flex flex-wrap gap-2">
                  {selectedKpis.map((id) => (
                    <span
                      key={id}
                      className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]"
                    >
                      {availableKpis.find((k) => k.id === id)?.label ?? id}
                    </span>
                  ))}
                </div>
              </div>
              {resolution.matchedKpiLabels.length > 0 && (
                <div>
                  <p className="text-[var(--text-muted)] mb-2">
                    Matched in template ({resolution.matchedMetricIds.length} panels)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resolution.matchedKpiLabels.map((label) => (
                      <span
                        key={label}
                        className="text-xs px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/30"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                SQL queries are built into the template — no manual SELECT required
              </p>
            </CardContent>
          </Card>

          <Button size="lg" className="w-full" onClick={handleGenerate}>
            Generate dashboard
            <Wand2 className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </WizardShell>
    );
  }

  return null;
}
