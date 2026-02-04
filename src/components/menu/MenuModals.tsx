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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRenameSectionMutation, useRenameReportMutation, useDeleteSectionMutation, useDeleteReportMutation, useCreateSectionMutation, useCreateReportMutation, useMenuTree } from '@/hooks/use-menu-mutations';

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
        const currentSection = (menuTree?.sections || []).find(s => s.id === item.id);
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
        let currentReport = (menuTree?.rootReports || []).find(r => r.id === item.id);
        if (!currentReport) {
          // Look in section reports
          for (const sectionReports of Object.values(menuTree?.sectionReports || {})) {
            currentReport = sectionReports.find(r => r.id === item.id);
            if (currentReport) break;
          }
        }
        
        if (!currentReport) {
          toast.error('Dashboard not found');
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
          <DialogTitle>Rename {item.type === 'section' ? 'Section' : 'Dashboard'}</DialogTitle>
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
          <DialogTitle>Delete {item.type === 'section' ? 'Section' : 'Dashboard'}</DialogTitle>
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

// Create Section Modal Component
interface CreateSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSectionModal({ isOpen, onClose }: CreateSectionModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSectionMutation = useCreateSectionMutation();
  const { data: menuTree } = useMenuTree();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Section name cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate sort order - add to the end
      const maxSortOrder = Math.max(...((menuTree?.sections || []).map(s => s.sortOrder) || [0]));
      const sortOrder = maxSortOrder + 1000;

      await createSectionMutation.mutateAsync({
        name: name.trim(),
        sortOrder,
      });
      
      setName('');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Section</DialogTitle>
          <DialogDescription>
            Create a new section to organize your reports.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section-name" className="text-right">
                Name
              </Label>
              <Input
                id="section-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="col-span-3"
                placeholder="Enter section name..."
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
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Report Modal Component
interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateReportModal({ isOpen, onClose }: CreateReportModalProps) {
  const [title, setTitle] = useState('');
  const [parentSectionId, setParentSectionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createReportMutation = useCreateReportMutation();
  const { data: menuTree } = useMenuTree();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Dashboard title cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate sort order
      let sortOrder = 1000;
      if (parentSectionId) {
        const sectionReports = menuTree?.sectionReports?.[parentSectionId] || [];
        if (sectionReports.length > 0) {
          const maxSortOrder = Math.max(...sectionReports.map(r => r.sortOrder));
          sortOrder = maxSortOrder + 1000;
        }
      } else {
        const rootReports = menuTree?.rootReports || [];
        if (rootReports.length > 0) {
          const maxSortOrder = Math.max(...rootReports.map(r => r.sortOrder));
          sortOrder = maxSortOrder + 1000;
        }
      }

      // Create a basic Grafana dashboard schema
      const reportSchema = {
        dashboard: {
          uid: `report_${Date.now()}`,
          title: title.trim(),
          description: `Dashboard: ${title.trim()}`,
          tags: [],
          timezone: 'UTC',
          refresh: '30s',
          time: {
            from: 'now-24h',
            to: 'now'
          },
          templating: {
            list: []
          },
          panels: []
        },
        'x-navixy': {
          schemaVersion: '1.0.0',
          execution: {
            endpoint: '/api/sql-new/execute',
            dialect: 'postgresql',
            timeoutMs: 30000,
            maxRows: 10000,
            readOnly: true,
            allowedSchemas: ['public']
          }
        }
      };

      await createReportMutation.mutateAsync({
        title: title.trim(),
        section_id: parentSectionId,
        sort_order: sortOrder,
        report_schema: reportSchema,
      });
      
      setTitle('');
      setParentSectionId(null);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Dashboard</DialogTitle>
          <DialogDescription>
            Create a new dashboard. You can choose which section it belongs to or leave it in the root.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="report-title" className="text-right">
                Title
              </Label>
              <Input
                id="report-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="col-span-3"
                placeholder="Enter report title..."
                maxLength={120}
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parent-section" className="text-right">
                Section
              </Label>
              <Select value={parentSectionId || 'root'} onValueChange={(value) => setParentSectionId(value === 'root' ? null : value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select section (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root (no section)</SelectItem>
                  {(menuTree?.sections || []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Dashboard'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
