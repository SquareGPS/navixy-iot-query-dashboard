import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Save, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

interface AnnotationEditorProps {
  open: boolean;
  onClose: () => void;
  annotation: {
    section_name?: string;
    subtitle?: string;
    text?: string;
    markdown?: boolean;
  };
  onSave: (annotation: {
    section_name?: string;
    subtitle?: string;
    text?: string;
    markdown?: boolean;
  }) => void;
}

export function AnnotationEditor({ open, onClose, annotation, onSave }: AnnotationEditorProps) {
  const [sectionName, setSectionName] = useState(annotation.section_name || '');
  const [subtitle, setSubtitle] = useState(annotation.subtitle || '');
  const [text, setText] = useState(annotation.text || '');
  const [markdown, setMarkdown] = useState(annotation.markdown || false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    try {
      const updatedAnnotation = {
        section_name: sectionName.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        text: text.trim() || undefined,
        markdown,
      };
      
      onSave(updatedAnnotation);
      onClose();
      
      toast({
        title: 'Success',
        description: 'Annotation updated successfully',
      });
    } catch (err) {
      console.error('Error saving annotation:', err);
      toast({
        title: 'Error',
        description: 'Failed to save annotation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset to original values
    setSectionName(annotation.section_name || '');
    setSubtitle(annotation.subtitle || '');
    setText(annotation.text || '');
    setMarkdown(annotation.markdown || false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 bg-[var(--surface-1)] border-[var(--border)] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] rounded-t-lg">
          <DialogTitle className="text-[var(--text-primary)]">Edit Annotation</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Modify the annotation content and formatting options
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4">
          <div className="space-y-6">
            {/* Section Name */}
            <div className="space-y-2">
              <Label htmlFor="section-name" className="text-sm font-medium text-[var(--text-primary)]">
                Section Name (Optional)
              </Label>
              <Input
                id="section-name"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Enter section name..."
                className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-sm font-medium text-[var(--text-primary)]">
                Subtitle (Optional)
              </Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Enter subtitle..."
                className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <Separator className="my-4" />

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="text-content" className="text-sm font-medium text-[var(--text-primary)]">
                  Content
                </Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="markdown-toggle" className="text-sm text-[var(--text-secondary)]">
                    Markdown
                  </Label>
                  <Switch
                    id="markdown-toggle"
                    checked={markdown}
                    onCheckedChange={setMarkdown}
                  />
                </div>
              </div>
              <Textarea
                id="text-content"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your annotation content..."
                className="min-h-[300px] bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] resize-none"
              />
              {markdown && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Markdown formatting is enabled. Use **bold**, *italic*, `code`, etc.
                </p>
              )}
            </div>

            {/* Preview */}
            {text && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--text-primary)]">
                  Preview
                </Label>
                <div className="border rounded-md p-4 bg-[var(--surface-2)] min-h-[100px]">
                  {sectionName && (
                    <h3 className="text-xl font-semibold mb-2">{sectionName}</h3>
                  )}
                  {subtitle && (
                    <p className="text-sm text-[var(--text-secondary)] mb-3">{subtitle}</p>
                  )}
                  {text && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {markdown ? (
                        <div dangerouslySetInnerHTML={{ __html: text }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{text}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0 bg-[var(--surface-1)] rounded-b-lg">
          <Button onClick={handleClose} variant="ghost" size="sm">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
