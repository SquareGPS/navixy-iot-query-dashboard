/**
 * BI Dashboard Color Palette
 * 
 * A curated set of 16 colors designed for modern BI dashboards.
 * Optimized for both light and dark themes with accessible contrast levels.
 * 
 * Usage:
 * - Pie/Donut charts: Use colors in order (descending values)
 * - Bar/Line charts: Cycle through array using modulo
 * - Dark mode: Colors work well as-is, but can apply slight brightness adjustments if needed
 */

export const chartColors = {
  /**
   * Primary palette - 15 distinct colors for data visualization
   * Colors are ordered by visual harmony, with the first 5-6 being especially distinct
   */
  primary: [
    '#3B82F6', // Blue - Primary accent, modern and trustworthy
    '#14B8A6', // Teal - Secondary accent, fresh and modern
    '#8B5CF6', // Purple - Tertiary accent, creative and distinct
    '#10B981', // Green - Success/positive metrics
    '#F59E0B', // Amber - Warning/attention metrics
    '#EC4899', // Pink - Highlight/emphasis
    '#6366F1', // Indigo - Deep accent, professional
    '#06B6D4', // Cyan - Bright accent, modern tech feel
    '#22C55E', // Emerald - Fresh green, growth metrics
    '#F97316', // Orange - Energy/activity metrics
    '#A855F7', // Violet - Rich purple, premium feel
    '#0EA5E9', // Sky Blue - Light accent, airy feel
    '#84CC16', // Lime - Vibrant green, high visibility
    '#EF4444', // Red - Alert/negative metrics
    '#EAB308', // Yellow - Bright highlight, attention-grabbing
  ],

  /**
   * Neutral color for backgrounds, "Other" segments, or secondary elements
   * Light gray that works on both light and dark backgrounds
   */
  neutral: '#E5E7EB',

  /**
   * Get color by index with automatic cycling
   * Useful for bar/line charts that need to cycle through colors
   * 
   * @param index - The index of the color to retrieve
   * @returns Color hex code
   */
  getColor: (index: number): string => {
    return chartColors.primary[index % chartColors.primary.length];
  },

  /**
   * Get all colors including neutral
   * Useful when you need the full palette including the neutral color
   * 
   * @returns Array of all 16 colors (15 primary + 1 neutral)
   */
  getAll: (): string[] => {
    return [...chartColors.primary, chartColors.neutral];
  },

  /**
   * Get colors for a specific count
   * Returns the first N colors from the palette
   * 
   * @param count - Number of colors needed
   * @param includeNeutral - Whether to include neutral color (default: false)
   * @returns Array of color hex codes
   */
  getColors: (count: number, includeNeutral: boolean = false): string[] => {
    const colors = chartColors.primary.slice(0, Math.min(count, chartColors.primary.length));
    if (includeNeutral && colors.length < count) {
      colors.push(chartColors.neutral);
    }
    return colors;
  },

  /**
   * Get color palette by name
   * Returns colors based on the palette type
   * 
   * @param palette - Palette name: 'classic', 'modern', 'pastel', or 'vibrant'
   * @returns Array of color hex codes
   */
  getPalette: (palette: 'classic' | 'modern' | 'pastel' | 'vibrant'): string[] => {
    switch (palette) {
      case 'classic':
        // Classic blue-based palette
        return [
          '#3B82F6', // Blue
          '#14B8A6', // Teal
          '#8B5CF6', // Purple
          '#10B981', // Green
          '#F59E0B', // Amber
          '#EC4899', // Pink
          '#6366F1', // Indigo
          '#06B6D4', // Cyan
        ];
      case 'modern':
        // Modern vibrant palette
        return [
          '#3B82F6', // Blue
          '#10B981', // Green
          '#F59E0B', // Amber
          '#EC4899', // Pink
          '#8B5CF6', // Purple
          '#06B6D4', // Cyan
          '#F97316', // Orange
          '#6366F1', // Indigo
        ];
      case 'pastel':
        // Pastel soft colors
        return [
          '#93C5FD', // Light Blue
          '#6EE7B7', // Light Green
          '#FCD34D', // Light Yellow
          '#F9A8D4', // Light Pink
          '#C4B5FD', // Light Purple
          '#7DD3FC', // Light Cyan
          '#FBBF24', // Light Amber
          '#A78BFA', // Light Indigo
        ];
      case 'vibrant':
        // High contrast vibrant colors
        return [
          '#EF4444', // Red
          '#F59E0B', // Amber
          '#EAB308', // Yellow
          '#84CC16', // Lime
          '#22C55E', // Emerald
          '#06B6D4', // Cyan
          '#3B82F6', // Blue
          '#8B5CF6', // Purple
        ];
      default:
        return chartColors.primary;
    }
  },
} as const;

/**
 * Type for chart color palette
 */
export type ChartColorPalette = typeof chartColors;

/**
 * Default export for convenience
 */
export default chartColors;

