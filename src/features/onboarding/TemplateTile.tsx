import { ArrowRight, BarChart3, Map, Sparkles, Table2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OnboardingRoleId, OnboardingTemplate } from '@/features/onboarding/types';
import {
  CATEGORY_COLORS,
  countMetrics,
  isRecommendedTemplate,
} from '@/features/onboarding/templateCatalog';
import { getReportTypeMeta } from '@/features/onboarding/reportTypes';
import { TEMPLATE_GRADIENTS, TEMPLATE_ICONS } from '@/features/onboarding/templateIcons';

interface TemplateTileProps {
  template: OnboardingTemplate;
  roleId: OnboardingRoleId;
  onSelect: (template: OnboardingTemplate) => void;
  compact?: boolean;
}

export function TemplateTile({ template, roleId, onSelect, compact }: TemplateTileProps) {
  const Icon = TEMPLATE_ICONS[template.id] ?? BarChart3;
  const gradient = TEMPLATE_GRADIENTS[template.id] ?? 'from-accent/15 to-accent/5 border-accent/25';
  const recommended = isRecommendedTemplate(roleId, template.id);
  const metricTotal = countMetrics(template.panelCounts);
  const typeMeta = getReportTypeMeta(template.reportType);

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={`group relative text-left rounded-xl border bg-gradient-to-br transition-all hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${gradient} ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      {recommended && (
        <div className="absolute -top-2.5 right-3">
          <Badge className="bg-accent text-white shadow-sm gap-1">
            <Sparkles className="h-3 w-3" />
            Top pick
          </Badge>
        </div>
      )}

      <div className="flex items-start gap-3 mb-2">
        <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] shrink-0">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-sm">{template.title}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{template.focus}</p>
        </div>
        <ArrowRight
          className="h-4 w-4 text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {!compact && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3 line-clamp-2">
          {template.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeMeta.color}`}
        >
          {typeMeta.label}
        </span>
        {template.categories.slice(0, 2).map((cat) => (
          <span
            key={cat}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat]}`}
          >
            {cat}
          </span>
        ))}
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-1 mb-2">
          {template.kpiHighlights.slice(0, 3).map((kpi) => (
            <span
              key={kpi}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]"
            >
              {kpi}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] border-t border-[var(--border)] pt-2">
        <span className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          {metricTotal > 0 ? `${metricTotal} metrics` : `${template.panelCounts.charts} charts`}
        </span>
        <span className="flex items-center gap-1">
          <Table2 className="h-3 w-3" />
          {template.panelCounts.tables}
        </span>
        {template.panelCounts.maps > 0 && (
          <span className="flex items-center gap-1">
            <Map className="h-3 w-3" />
            map
          </span>
        )}
        <span className="ml-auto">{template.period}</span>
      </div>
    </button>
  );
}
