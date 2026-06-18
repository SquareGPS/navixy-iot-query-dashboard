import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Edit,
  Code,
  Trash2,
  Plus,
  Square,
  Layout,
  LibraryBig,
  X,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEditorStore } from '@/layout/state/editorStore';
import { CHART_DOCK_WIDTH_REM } from './ChartLibraryPanel';

// Shared square-button styling for the floating edit toolbar.
const TOOLBAR_BTN_BASE = "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200";
const TOOLBAR_BTN_NEUTRAL = cn(
  TOOLBAR_BTN_BASE,
  "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700",
  "hover:bg-gray-50 dark:hover:bg-gray-700"
);

interface EditToolbarProps {
  isEditing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
  onFullSchema: () => void;
  onDeleteReport: () => void;
  onNewRow: () => void;
  onNewPanel: () => void;
  onTidyUp?: () => void;
  onManageVariables?: () => void;
  className?: string;
}

export const EditToolbar = ({
  isEditing,
  canEdit,
  onToggleEdit,
  onFullSchema,
  onDeleteReport,
  onNewRow,
  onNewPanel,
  onTidyUp,
  onManageVariables,
  className
}: EditToolbarProps) => {
  const chartLibraryOpen = useEditorStore((state) => state.chartLibraryOpen);
  const toggleChartLibrary = useEditorStore((state) => state.toggleChartLibrary);

  if (!canEdit) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 transition-all duration-300 ease-in-out",
          className
        )}
        style={{
          // open: clear the dock (its width + 0.5rem gap); closed: right-6 (1.5rem)
          right: chartLibraryOpen ? `${CHART_DOCK_WIDTH_REM + 0.5}rem` : '1.5rem',
        }}
      >
        {/* Edit Toggle Button - Always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggleEdit}
              className={cn(
                TOOLBAR_BTN_BASE,
                "border-2 border-white dark:border-gray-800",
                isEditing
                  ? "bg-[#379EF9] hover:bg-[#2B7CE6] dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400"
              )}
              size="lg"
            >
              {isEditing ? (
                <X className="h-5 w-5 text-white" />
              ) : (
                <Edit className="h-5 w-5 text-gray-700 dark:text-gray-400" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{isEditing ? 'Exit Edit Mode' : 'Enter Edit Mode'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Toolbar items - Only visible when editing */}
        {isEditing && (
          <>
            {/* New Row */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onNewRow}
                  className={TOOLBAR_BTN_NEUTRAL}
                  size="lg"
                >
                  <Square className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>New Row</p>
              </TooltipContent>
            </Tooltip>

            {/* New Panel */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onNewPanel}
                  className={TOOLBAR_BTN_NEUTRAL}
                  size="lg"
                >
                  <Layout className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>New Panel</p>
              </TooltipContent>
            </Tooltip>

            {/* Chart Library (FR-11365) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleChartLibrary}
                  className={cn(
                    TOOLBAR_BTN_BASE,
                    "border-2",
                    chartLibraryOpen
                      ? "bg-[#379EF9] hover:bg-[#2B7CE6] dark:bg-blue-600 dark:hover:bg-blue-700 border-white dark:border-gray-800"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                  size="lg"
                >
                  <LibraryBig className={cn("h-5 w-5", chartLibraryOpen ? "text-white" : "text-gray-700 dark:text-gray-300")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Chart Library</p>
              </TooltipContent>
            </Tooltip>

            {/* Dashboard Filters */}
            {onManageVariables && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onManageVariables}
                    className={cn(
                      "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
                      "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700",
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                    size="lg"
                  >
                    <SlidersHorizontal className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Dashboard Filters</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <div className="h-px bg-gray-300 dark:bg-gray-600 my-1 mx-2" />

            {/* Tidy Up */}
            {onTidyUp && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onTidyUp}
                    className={cn(
                      "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
                      "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700",
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                    size="lg"
                  >
                    <Sparkles className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Tidy Up Layout</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <div className="h-px bg-gray-300 dark:bg-gray-600 my-1 mx-2" />

            {/* Full Schema */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onFullSchema}
                  className={TOOLBAR_BTN_NEUTRAL}
                  size="lg"
                >
                  <Code className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Full Schema</p>
              </TooltipContent>
            </Tooltip>

            {/* Delete Dashboard */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onDeleteReport}
                  className={cn(
                    TOOLBAR_BTN_BASE,
                    "bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-800",
                    "hover:bg-red-50 dark:hover:bg-red-900/20"
                  )}
                  size="lg"
                >
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Delete Dashboard</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

