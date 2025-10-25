import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useRenameSectionMutation, useRenameReportMutation, useDeleteSectionMutation, useDeleteReportMutation, useMenuTree } from '@/hooks/use-menu-mutations';

// Rename Modal Component
interface RenameModalProps {
  item: { id: string; type: 'section' | 'report'; name: string } | null;
  onClose: () => void;
}

export function RenameModal({ item, onClose }: RenameModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const renameSectionMutation = useRenameSectionMutation();
  const renameReportMutation = useRenameReportMutation();
  const { data: menuTree } = useMenuTree();

  useEffect(() => {
    if (item) {
      setName(item.name);
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!item || !name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    if (name.trim() === item.name) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      if (item.type === 'section') {
        // Find the current section to get its version
        const currentSection = menuTree?.sections.find(s => s.id === item.id);
        if (!currentSection) {
          toast.error('Section not found');
          return;
        }
        
        await renameSectionMutation.mutateAsync({
          id: item.id,
          name: name.trim(),
          version: currentSection.version,
        });
      } else {
        // Find the current report to get its version
        let currentReport = menuTree?.rootReports.find(r => r.id === item.id);
        if (!currentReport) {
          // Look in section reports
          for (const sectionReports of Object.values(menuTree?.sectionReports || {})) {
            currentReport = sectionReports.find(r => r.id === item.id);
            if (currentReport) break;
          }
        }
        
        if (!currentReport) {
          toast.error('Report not found');
          return;
        }
        
        await renameReportMutation.mutateAsync({
          id: item.id,
          name: name.trim(),
          version: currentReport.version,
        });
      }
      
      onClose();
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename {item.type === 'section' ? 'Section' : 'Report'}</DialogTitle>
          <DialogDescription>
            Enter a new name for this {item.type}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="col-span-3"
                placeholder={`Enter ${item.type} name...`}
                maxLength={120}
                autoFocus
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !name.trim() || name.trim() === item.name}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Delete Modal Component
interface DeleteModalProps {
  item: { id: string; type: 'section' | 'report'; name: string } | null;
  strategy: 'move_children_to_root' | 'delete_children' | null;
  onClose: () => void;
  onStrategyChange: (strategy: 'move_children_to_root' | 'delete_children') => void;
}

export function DeleteModal({ item, strategy, onClose, onStrategyChange }: DeleteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deleteSectionMutation = useDeleteSectionMutation();
  const deleteReportMutation = useDeleteReportMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!item) return;

    setIsSubmitting(true);

    try {
      if (item.type === 'section' && strategy) {
        await deleteSectionMutation.mutateAsync({
          id: item.id,
          strategy,
        });
      } else if (item.type === 'report') {
        await deleteReportMutation.mutateAsync(item.id);
      }
      
      onClose();
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete {item.type === 'section' ? 'Section' : 'Report'}</DialogTitle>
          <DialogDescription>
            {item.type === 'section' 
              ? 'Deleting a section will affect its reports. Choose what to do with the reports in this section.'
              : 'Are you sure you want to delete this report? This action cannot be undone.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {item.type === 'section' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">What should happen to the reports in this section?</Label>
                <RadioGroup value={strategy || ''} onValueChange={onStrategyChange}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="move_children_to_root" id="move-to-root" />
                    <Label htmlFor="move-to-root" className="text-sm">
                      Move all reports to Root (recommended)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delete_children" id="delete-children" />
                    <Label htmlFor="delete-children" className="text-sm">
                      Delete all reports
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>{item.name}</strong> will be moved to trash and can be restored later.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={isSubmitting || (item.type === 'section' && !strategy)}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
