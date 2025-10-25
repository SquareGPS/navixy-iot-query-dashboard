import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, BarChart3, PieChart, Table, Square, FileText } from 'lucide-react';
import type { Row } from '@/types/report-schema';

interface AddRowButtonProps {
  onAddRow: (rowType: Row['type'], insertAfterIndex?: number) => void;
  insertAfterIndex?: number;
  canEdit?: boolean;
  isEditing?: boolean;
}

const ROW_TYPES = [
  {
    type: 'tiles' as const,
    label: 'Tiles',
    description: 'Display key metrics as individual tiles',
    icon: Square,
    color: 'text-blue-600'
  },
  {
    type: 'table' as const,
    label: 'Table',
    description: 'Display data in a structured table format',
    icon: Table,
    color: 'text-green-600'
  },
  {
    type: 'charts' as const,
    label: 'Charts',
    description: 'Display data as bar charts, pie charts, etc.',
    icon: BarChart3,
    color: 'text-purple-600'
  },
  {
    type: 'annotation' as const,
    label: 'Annotation',
    description: 'Add text, markdown, or section headers',
    icon: FileText,
    color: 'text-orange-600'
  }
];

export function AddRowButton({ onAddRow, insertAfterIndex, canEdit = false, isEditing = false }: AddRowButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  if (!canEdit || !isEditing) {
    return null;
  }

  const handleRowTypeSelect = (rowType: Row['type']) => {
    onAddRow(rowType, insertAfterIndex);
    setShowDialog(false);
  };

  return (
    <>
      <div className="flex justify-center py-4">
        <Button
          onClick={() => setShowDialog(true)}
          variant="outline"
          size="sm"
          className="border-dashed border-2 border-[var(--border)] hover:border-[var(--border-hover)] bg-transparent hover:bg-[var(--surface-2)] transition-all duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Row</DialogTitle>
            <DialogDescription>
              Choose the type of content you want to add to your report.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {ROW_TYPES.map((rowType) => {
              const IconComponent = rowType.icon;
              return (
                <Card
                  key={rowType.type}
                  className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-[var(--border-hover)]"
                  onClick={() => handleRowTypeSelect(rowType.type)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-[var(--surface-2)] ${rowType.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                        {rowType.label}
                      </h3>
                      <p className="text-sm text-[var(--text-muted)]">
                        {rowType.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

