import type { MetricPanel, MetricPanelGroup } from './types';

const METRIC_PANEL_TYPES = new Set(['kpi', 'stat']);

function cleanSectionLabel(title: string): string {
  return title
    .replace(/^Block \d+\s*[–-]\s*/i, '')
    .replace(/^#+\s*/, '')
    .trim();
}

export function getMetricPanelGroups(schema: Record<string, unknown>): MetricPanelGroup[] {
  const panels = schema.panels as Array<{
    id?: number;
    type?: string;
    title?: string;
    options?: { content?: string };
  }> | undefined;

  if (!panels) return [];

  const groups: MetricPanelGroup[] = [];
  let currentLabel = 'Key metrics';

  for (const panel of panels) {
    if (panel.type === 'text') {
      const fromTitle = panel.title ? cleanSectionLabel(panel.title) : '';
      const fromContent = panel.options?.content
        ? cleanSectionLabel(panel.options.content.split('\n')[0])
        : '';
      const label = fromTitle || fromContent;
      if (label) currentLabel = label;
      continue;
    }

    if (
      panel.type &&
      METRIC_PANEL_TYPES.has(panel.type) &&
      panel.id != null
    ) {
      let group = groups.find((g) => g.label === currentLabel);
      if (!group) {
        group = { label: currentLabel, metrics: [] };
        groups.push(group);
      }
      group.metrics.push({
        id: panel.id as number,
        title: panel.title || `${panel.type} ${panel.id}`,
        type: panel.type,
      });
    }
  }

  return groups;
}

export function getMetricPanelsFromGroups(groups: MetricPanelGroup[]): MetricPanel[] {
  return groups.flatMap((g) => g.metrics);
}
