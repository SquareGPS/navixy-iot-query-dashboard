import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateReportMutation, useMenuTree } from '@/hooks/use-menu-mutations';
import { markOnboardingCompleted } from '@/features/onboarding/onboardingStorage';
import { ROLE_COLORS, ROLE_ICONS } from '@/features/onboarding/roleIcons';
import { REPORT_TYPES } from '@/features/onboarding/reportTypes';
import {
  ROLE_QUESTIONS,
  getRecommendedTemplatesForRole,
  getTemplatesForRole,
  getTemplatesGroupedByReportType,
} from '@/features/onboarding/templateCatalog';
import { TemplateTile } from '@/features/onboarding/TemplateTile';
import {
  filterSchemaMetrics,
  getMetricGroups,
  getMetricPanels,
  getTemplateSchema,
  ONBOARDING_ROLES,
  wrapReportSchema,
} from '@/features/onboarding/templates';
import { repackFlatReportSchema } from '@/features/onboarding/repackSchema';
import type {
  OnboardingRoleId,
  OnboardingStep,
  OnboardingTemplate,
  ReportTypeId,
} from '@/features/onboarding/types';
import { toast } from 'sonner';

function OnboardingShell({
  children,
  step,
}: {
  children: React.ReactNode;
  step: OnboardingStep;
}) {
  const steps: { key: OnboardingStep; label: string }[] = [
    { key: 'role', label: 'Role' },
    { key: 'goal', label: 'Template' },
    { key: 'kpi', label: 'Metrics' },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:var(--bg-gradient)]" />
      <header className="border-b border-[var(--border)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4 max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Dashboard Studio</p>
              <p className="text-sm text-[var(--text-muted)]">Onboarding · Variant 1</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {steps.map((s, i) => (
              <span
                key={s.key}
                className={
                  i <= stepIndex ? 'text-accent font-medium' : 'text-[var(--text-muted)]'
                }
              >
                {s.label}
                {i < steps.length - 1 && <span className="mx-2 opacity-40">→</span>}
              </span>
            ))}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10 max-w-6xl">{children}</main>
    </div>
  );
}

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: menuTree } = useMenuTree();
  const createReportMutation = useCreateReportMutation();

  const [step, setStep] = useState<OnboardingStep>('role');
  const [selectedRoleId, setSelectedRoleId] = useState<OnboardingRoleId | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);
  const [templateSchema, setTemplateSchema] = useState<Record<string, unknown> | null>(null);
  const [selectedMetricIds, setSelectedMetricIds] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<ReportTypeId | 'all'>('all');

  const metricPanels = useMemo(
    () => (templateSchema ? getMetricPanels(templateSchema) : []),
    [templateSchema]
  );

  const metricGroups = useMemo(
    () => (templateSchema ? getMetricGroups(templateSchema) : []),
    [templateSchema]
  );

  const recommendedTemplates =
    selectedRoleId ? getRecommendedTemplatesForRole(selectedRoleId) : [];

  const groupedTemplates =
    selectedRoleId
      ? getTemplatesGroupedByReportType(selectedRoleId, typeFilter)
      : [];

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleSelectRole = (roleId: OnboardingRoleId) => {
    setSelectedRoleId(roleId);
    setSelectedTemplate(null);
    setTemplateSchema(null);
    setTypeFilter('all');
    setStep('goal');
  };

  const handleSelectTemplate = (template: OnboardingTemplate) => {
    setSelectedTemplate(template);
    try {
      const schema = getTemplateSchema(template.id);
      setTemplateSchema(schema);
      setSelectedMetricIds(getMetricPanels(schema).map((m) => m.id));
      setStep('kpi');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load template');
    }
  };

  const toggleMetric = (id: number) => {
    setSelectedMetricIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleStartWorking = async () => {
    if (!user || !selectedTemplate || !templateSchema) return;

    if (user.role === 'viewer') {
      toast.error('Viewers cannot create dashboards. Sign in as Admin or Editor.');
      return;
    }

    if (metricPanels.length > 0 && selectedMetricIds.length === 0) {
      toast.error('Select at least one metric to continue');
      return;
    }

    setStep('creating');

    try {
      const filtered =
        metricPanels.length > 0
          ? filterSchemaMetrics(templateSchema, selectedMetricIds)
          : templateSchema;
      const originalCount = (templateSchema.panels as unknown[] | undefined)?.length ?? 0;
      const filteredCount = (filtered.panels as unknown[] | undefined)?.length ?? 0;
      const laidOut =
        filteredCount < originalCount ? repackFlatReportSchema(filtered) : filtered;
      const reportSchema = wrapReportSchema(laidOut, selectedTemplate.dashboardTitle);

      let sortOrder = 1000;
      const rootReports = menuTree?.rootReports ?? [];
      if (rootReports.length > 0) {
        sortOrder = Math.max(...rootReports.map((r) => r.sortOrder)) + 1000;
      }

      const result = await createReportMutation.mutateAsync({
        title: selectedTemplate.dashboardTitle,
        sort_order: sortOrder,
        report_schema: reportSchema,
      });

      markOnboardingCompleted(user.id);
      toast.success('Dashboard created from template');
      navigate(`/app/report/${result.id}`);
    } catch (error) {
      setStep('kpi');
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
      <OnboardingShell step="kpi">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <p className="text-lg font-medium">Creating your dashboard…</p>
          <p className="text-sm text-[var(--text-muted)]">
            Applying &ldquo;{selectedTemplate?.title}&rdquo;
            {metricPanels.length > 0 && ` with ${selectedMetricIds.length} metrics`}
          </p>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 'role') {
    return (
      <OnboardingShell step="role">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Choose your role</h1>
            <p className="text-[var(--text-muted)] text-lg">
              14 dashboard templates across 8 report types — we&apos;ll prioritize the best
              matches for your role.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ONBOARDING_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id];
              const color = ROLE_COLORS[role.id];
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  className={`group text-left rounded-xl border bg-gradient-to-br p-5 transition-all hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${color}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-base">{role.title}</p>
                      <p className="text-sm text-[var(--text-muted)] leading-snug">
                        {role.description}
                      </p>
                      <p className="text-xs text-accent font-medium pt-1">
                        14 templates · 8 report types
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 'goal' && selectedRoleId) {
    const role = ONBOARDING_ROLES.find((r) => r.id === selectedRoleId);
    const question = ROLE_QUESTIONS[selectedRoleId];

    return (
      <OnboardingShell step="goal">
        <div className="space-y-8">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => {
              setStep('role');
              setSelectedRoleId(null);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to roles
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-medium text-accent uppercase tracking-wide">
              {role?.title}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{question}</h1>
            <p className="text-[var(--text-muted)] text-lg max-w-3xl">
              {getTemplatesForRole(selectedRoleId).length} templates from the schema library —
              grouped by report type. Pick one to configure metrics and create your dashboard.
            </p>
          </div>

          {/* Recommended */}
          {typeFilter === 'all' && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Top picks for {role?.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedTemplates.map((template) => (
                  <TemplateTile
                    key={template.id}
                    template={template}
                    roleId={selectedRoleId}
                    onSelect={handleSelectTemplate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Type filter */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-[var(--text-muted)]">
              Filter by dashboard type
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-accent text-white border-accent'
                    : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-accent/40'
                }`}
              >
                All types
              </button>
              {REPORT_TYPES.map((rt) => {
                const Icon = rt.icon;
                const count = getTemplatesForRole(selectedRoleId).filter(
                  (t) => t.reportType === rt.id
                ).length;
                if (count === 0) return null;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setTypeFilter(rt.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                      typeFilter === rt.id
                        ? 'bg-accent text-white border-accent'
                        : `${rt.color} hover:opacity-90`
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {rt.label}
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grouped by type */}
          <div className="space-y-8">
            {groupedTemplates.map(({ type, templates }) => (
              <section key={type.id} className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border ${type.color}`}>
                    <type.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{type.label}</h2>
                    <p className="text-sm text-[var(--text-muted)]">{type.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <TemplateTile
                      key={template.id}
                      template={template}
                      roleId={selectedRoleId}
                      onSelect={handleSelectTemplate}
                      compact={typeFilter !== 'all'}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 'kpi' && selectedTemplate && templateSchema) {
    const hasOnlyStats = metricPanels.length > 0 && metricPanels.every((m) => m.type === 'stat');
    const metricLabel = hasOnlyStats ? 'Summary metrics' : 'KPI & metric panels';

    return (
      <OnboardingShell step="kpi">
        <div className="space-y-8 max-w-3xl">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => setStep('goal')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to templates
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-medium text-accent uppercase tracking-wide">
              Configure metrics
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {selectedTemplate.dashboardTitle}
            </h1>
            <p className="text-[var(--text-muted)]">
              {selectedTemplate.panelCounts.total} panels total
              {metricPanels.length > 0 &&
                ` · ${metricPanels.length} selectable metrics grouped by dashboard section`}
            </p>
          </div>

          {metricPanels.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-[var(--text-muted)]">
                  This template uses charts, tables, and maps — no separate KPI/stat tiles.
                  Click &ldquo;Start working&rdquo; to create the full dashboard.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {metricGroups.map((group) => (
                <Card key={group.label}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{group.label}</CardTitle>
                    <CardDescription>
                      {group.metrics.filter((m) => selectedMetricIds.includes(m.id)).length} of{' '}
                      {group.metrics.length} selected
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {group.metrics.map((metric) => {
                      const checked = selectedMetricIds.includes(metric.id);
                      return (
                        <label
                          key={metric.id}
                          className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--surface-2)]"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleMetric(metric.id)}
                          />
                          <span className="flex-1 text-sm font-medium">{metric.title}</span>
                          {metric.type === 'stat' && (
                            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                              stat
                            </span>
                          )}
                          {checked && (
                            <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="sm:flex-1"
              onClick={handleStartWorking}
              disabled={metricPanels.length > 0 && selectedMetricIds.length === 0}
            >
              Start working
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            {metricPanels.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setSelectedMetricIds(metricPanels.map((m) => m.id))}
              >
                Select all
              </Button>
            )}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return null;
}
