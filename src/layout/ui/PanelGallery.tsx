/**
 * PanelGallery component - modal for selecting panel type and size
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, PieChart, Table, TrendingUp, Info, Circle } from 'lucide-react';
import { SIZE_PRESETS, DEFAULT_SIZE_PRESET, resolvePresetSize, type SizePresetLabel } from './sizePresets';
import type { PanelType } from '@/types/dashboard-types';

export interface PanelTypeOption {
  type: PanelType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PANEL_TYPES: PanelTypeOption[] = [
  {
    type: 'stat',
    label: 'Stat',
    description: 'Display a single metric value',
    icon: TrendingUp,
  },
  {
    type: 'barchart',
    label: 'Bar Chart',
    description: 'Display data as bars',
    icon: BarChart3,
  },
  {
    type: 'piechart',
    label: 'Pie Chart',
    description: 'Display data as a pie chart',
    icon: PieChart,
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Display data in a table format',
    icon: Table,
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Display markdown or plain text',
    icon: Info,
  },
  {
    type: 'geomap',
    label: 'Map',
    description: 'Display GPS coordinates on a map',
    icon: Circle,
  },
];

interface PanelGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: string, size: { w: number; h: number }) => void;
}

export const PanelGallery: React.FC<PanelGalleryProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizePresetLabel>(DEFAULT_SIZE_PRESET);

  const handleConfirm = () => {
    if (!selectedType) return;

    // Honour the size preset the user picked. The dropdown shows each preset's
    // exact dimensions (e.g. "Large (24×8)"), so the created panel must match
    // them — previously the type default silently overrode Medium/Large (DO-306).
    onSelect(selectedType, resolvePresetSize(selectedSize));
    setSelectedType(null);
    setSelectedSize(DEFAULT_SIZE_PRESET);
    onClose();
  };

  const handleCancel = () => {
    setSelectedType(null);
    setSelectedSize(DEFAULT_SIZE_PRESET);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Panel</DialogTitle>
          <DialogDescription>
            Choose a panel type and size to add to your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Panel Type Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Panel Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PANEL_TYPES.map((panelType) => {
                const IconComponent = panelType.icon;
                const isSelected = selectedType === panelType.type;
                return (
                  <Card
                    key={panelType.type}
                    className={`p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'hover:border-blue-300 hover:shadow-md'
                    }`}
                    onClick={() => setSelectedType(panelType.type)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{panelType.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          {panelType.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Size Preset Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Size Preset</Label>
            <Select value={selectedSize} onValueChange={(value) => setSelectedSize(value as typeof selectedSize)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_PRESETS.map((preset) => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label} ({preset.w}×{preset.h})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedType}>
              Add Panel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

