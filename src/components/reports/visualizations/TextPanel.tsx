import { marked } from 'marked';
import type { Panel } from '@/types/dashboard-types';

interface TextPanelProps {
  panel: Panel;
}

/**
 * Text Panel Component
 * Renders text panels with support for markdown, HTML, and plain text modes
 * 
 * According to the Navixy dashboard format:
 * - options.mode: 'markdown' | 'html' | 'text'
 * - options.content: The content string
 */
export function TextPanel({ panel }: TextPanelProps) {
  // Support both formats:
  // 1. Standard format: options.mode and options.content
  // 2. x-navixy format: x-navixy.text.format and x-navixy.text.content
  const navixyText = panel['x-navixy']?.text;
  const mode = panel.options?.mode || navixyText?.format || 'markdown';
  const content = panel.options?.content || navixyText?.content || '';

  // Configure marked options for safe rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  const renderContent = () => {
    if (!content) {
      return (
        <div className="text-muted-foreground text-sm italic">
          No content provided
        </div>
      );
    }

    switch (mode) {
      case 'markdown': {
        try {
          const html = marked.parse(content);
          return (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (error) {
          console.error('Error parsing markdown:', error);
          return (
            <div className="text-destructive text-sm">
              Error rendering markdown: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          );
        }
      }
      
      case 'html': {
        return (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      }
      
      case 'text':
      default: {
        return (
          <div className="whitespace-pre-wrap text-sm">
            {content}
          </div>
        );
      }
    }
  };

  return (
    <div className="h-full w-full p-4 overflow-auto">
      {renderContent()}
    </div>
  );
}

