import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * The Lucide icon component to render
   */
  icon: LucideIcon;
  /**
   * Size of the icon in Tailwind units (e.g., 3 = h-3 w-3, 4 = h-4 w-4)
   * If not provided, size must be specified via className
   */
  size?: 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;
  /**
   * Additional className to apply
   * Note: Color classes will be merged with defaults unless explicitly overridden
   */
  className?: string;
}

/**
 * Size mapping for Tailwind classes
 * Tailwind requires full class names to be present for JIT compilation
 */
const sizeClasses: Record<NonNullable<IconProps['size']>, string> = {
  3: 'h-3 w-3',
  4: 'h-4 w-4',
  5: 'h-5 w-5',
  6: 'h-6 w-6',
  8: 'h-8 w-8',
  10: 'h-10 w-10',
  12: 'h-12 w-12',
  16: 'h-16 w-16',
  20: 'h-20 w-20',
  24: 'h-24 w-24',
};

/**
 * Icon wrapper component that ensures proper color inheritance
 * for lucide-react icons in both light and dark modes.
 * 
 * By default, applies `text-gray-700 dark:text-gray-300` to ensure
 * icons are visible in both themes. This can be overridden via className.
 * 
 * @example
 * ```tsx
 * <Icon icon={Plus} size={4} />
 * <Icon icon={Plus} className="h-4 w-4 text-blue-500" />
 * ```
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconComponent, size, className, ...props }, ref) => {
    // Default color classes that ensure visibility in both light and dark modes
    const defaultColorClasses = 'text-gray-700 dark:text-gray-300';
    
    // Get size classes if size prop is provided
    const sizeClass = size ? sizeClasses[size] : '';
    
    // Merge classes: default colors + size + user-provided className
    // User can override colors by including color classes in className
    // twMerge will handle conflicts properly (user classes override defaults)
    const mergedClassName = cn(
      sizeClass,
      defaultColorClasses,
      className
    );

    return (
      <IconComponent
        ref={ref}
        className={mergedClassName}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

