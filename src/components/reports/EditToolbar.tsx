import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  Edit, 
  Code, 
  Trash2, 
  Plus,
  Square,
  Layout,
  X,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EditToolbarProps {
  isEditing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
  onFullSchema: () => void;
  onDeleteReport: () => void;
  onNewRow: () => void;
  onNewPanel: () => void;
  onTidyUp?: () => void;
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
  className
}: EditToolbarProps) => {
  if (!canEdit) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        "fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 transition-all duration-300 ease-in-out",
        className
      )}>
        {/* Edit Toggle Button - Always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggleEdit}
              className={cn(
                "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
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
                  className={cn(
                    "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
                    "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
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
                  className={cn(
                    "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
                    "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                  size="lg"
                >
                  <Layout className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>New Panel</p>
              </TooltipContent>
            </Tooltip>

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
                  className={cn(
                    "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
                    "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                  size="lg"
                >
                  <Code className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Full Schema</p>
              </TooltipContent>
            </Tooltip>

            {/* Delete Report */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onDeleteReport}
                  className={cn(
                    "h-12 w-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200",
                    "bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-800",
                    "hover:bg-red-50 dark:hover:bg-red-900/20"
                  )}
                  size="lg"
                >
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Delete Report</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

