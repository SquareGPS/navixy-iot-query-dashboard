import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { 
  Edit, 
  Code, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  MoreVertical,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingEditMenuProps {
  isEditing: boolean;
  editMode: 'full' | 'inline';
  canEdit: boolean;
  onToggleEdit: () => void;
  onSetEditMode: (mode: 'full' | 'inline') => void;
  onDeleteReport: () => void;
  className?: string;
}

export const FloatingEditMenu = ({
  isEditing,
  editMode,
  canEdit,
  onToggleEdit,
  onSetEditMode,
  onDeleteReport,
  className
}: FloatingEditMenuProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!canEdit) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out",
      className
    )}>
      {/* Main floating button */}
      <div className="relative">
        <Button
          onClick={() => {
            if (isEditing) {
              setIsExpanded(!isExpanded);
            } else {
              onToggleEdit();
            }
          }}
          className={cn(
            "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200",
            "border-2 border-white dark:border-gray-800",
            isEditing 
              ? "bg-[#379EF9] hover:bg-[#2B7CE6] dark:bg-blue-600 dark:hover:bg-blue-700 text-white" 
              : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400"
          )}
          size="lg"
        >
          <Edit className={cn(
            "h-6 w-6",
            isEditing ? "text-white" : "text-gray-700 dark:text-gray-400"
          )} />
        </Button>

        {/* Expanded menu */}
        {isEditing && isExpanded && (
          <Card className={cn(
            "absolute bottom-16 right-0 min-w-[200px] p-3 shadow-xl",
            "bg-[var(--surface-1)] border-[var(--border)]",
            "animate-in slide-in-from-bottom-2 duration-200"
          )}>
            <div className="space-y-2">
              {/* Edit Mode Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Edit Mode
                </span>
                <Button
                  onClick={() => setIsExpanded(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Mode Selection */}
              <div className="space-y-1">
                <Button
                  onClick={() => {
                    onSetEditMode('full');
                    setIsExpanded(false);
                  }}
                  variant={editMode === 'full' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start text-xs"
                >
                  <Code className="h-3 w-3 mr-2" />
                  Full Schema
                </Button>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border-subtle)] my-2" />

              {/* Destructive Actions */}
              <Button
                onClick={() => {
                  onDeleteReport();
                  setIsExpanded(false);
                }}
                variant="destructive"
                size="sm"
                className="w-full justify-start text-xs"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete Report
              </Button>

              {/* Exit Edit Mode */}
              <Button
                onClick={() => {
                  onToggleEdit();
                  setIsExpanded(false);
                }}
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/20"
              >
                <X className="h-3 w-3 mr-2" />
                Exit Edit Mode
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Tooltip */}
      <div className={cn(
        "absolute bottom-20 right-0 px-3 py-2 rounded-lg shadow-lg",
        "bg-gray-900 text-white text-xs whitespace-nowrap",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        "pointer-events-none"
      )}>
        {isEditing ? 'Edit Mode Active' : 'Enter Edit Mode'}
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
};
