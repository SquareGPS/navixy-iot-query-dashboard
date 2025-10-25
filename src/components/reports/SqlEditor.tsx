import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  height?: string;
  readOnly?: boolean;
  language?: string;
}

export function SqlEditor({ value, onChange, onExecute, height = '300px', readOnly = false, language = 'sql' }: SqlEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Define custom themes that match the application's design system
    const lightTheme = {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3AA3FF', fontStyle: 'bold' },
        { token: 'string', foreground: 'DC2626' },
        { token: 'number', foreground: '16A34A' },
        { token: 'regexp', foreground: 'D97706' },
        { token: 'operator', foreground: '334155' },
        { token: 'namespace', foreground: '06B6D4' },
        { token: 'type', foreground: '7C3AED' },
        { token: 'struct', foreground: '7C3AED' },
        { token: 'class', foreground: '7C3AED' },
        { token: 'interface', foreground: '7C3AED' },
        { token: 'parameter', foreground: '0F172A' },
        { token: 'variable', foreground: '0F172A' },
        { token: 'function', foreground: '3AA3FF' },
        { token: 'property', foreground: '3AA3FF' },
        { token: 'json.key', foreground: '3AA3FF' },
        { token: 'json.string', foreground: 'DC2626' },
        { token: 'json.number', foreground: '16A34A' },
        { token: 'json.boolean', foreground: '7C3AED' },
        { token: 'json.null', foreground: '64748B' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#0F172A',
        'editorLineNumber.foreground': '#64748B',
        'editorLineNumber.activeForeground': '#334155',
        'editor.selectionBackground': '#D8EEFF',
        'editor.selectionHighlightBackground': '#F3F6FB',
        'editorCursor.foreground': '#3AA3FF',
        'editorWhitespace.foreground': '#E2E8F0',
        'editorIndentGuide.background': '#E2E8F0',
        'editorIndentGuide.activeBackground': '#334155',
        'editorBracketMatch.background': '#D8EEFF',
        'editorBracketMatch.border': '#3AA3FF',
      }
    };

    const darkTheme = {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6D7B92', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3AA3FF', fontStyle: 'bold' },
        { token: 'string', foreground: 'EF4444' },
        { token: 'number', foreground: '22C55E' },
        { token: 'regexp', foreground: 'F59E0B' },
        { token: 'operator', foreground: 'A9B6CC' },
        { token: 'namespace', foreground: '22D3EE' },
        { token: 'type', foreground: 'A855F7' },
        { token: 'struct', foreground: 'A855F7' },
        { token: 'class', foreground: 'A855F7' },
        { token: 'interface', foreground: 'A855F7' },
        { token: 'parameter', foreground: 'E9F1FF' },
        { token: 'variable', foreground: 'E9F1FF' },
        { token: 'function', foreground: '3AA3FF' },
        { token: 'property', foreground: '3AA3FF' },
        { token: 'json.key', foreground: '3AA3FF' },
        { token: 'json.string', foreground: 'EF4444' },
        { token: 'json.number', foreground: '22C55E' },
        { token: 'json.boolean', foreground: 'A855F7' },
        { token: 'json.null', foreground: '6D7B92' },
      ],
      colors: {
        'editor.background': '#0D131F',
        'editor.foreground': '#E9F1FF',
        'editorLineNumber.foreground': '#6D7B92',
        'editorLineNumber.activeForeground': '#A9B6CC',
        'editor.selectionBackground': '#112538',
        'editor.selectionHighlightBackground': '#111A2B',
        'editorCursor.foreground': '#3AA3FF',
        'editorWhitespace.foreground': '#22314B',
        'editorIndentGuide.background': '#22314B',
        'editorIndentGuide.activeBackground': '#A9B6CC',
        'editorBracketMatch.background': '#112538',
        'editorBracketMatch.border': '#3AA3FF',
      }
    };

    // Register the custom themes
    monaco.editor.defineTheme('app-light', lightTheme);
    monaco.editor.defineTheme('app-dark', darkTheme);

    // Set the theme based on the current theme
    const currentTheme = theme === 'dark' ? 'app-dark' : 'app-light';
    monaco.editor.setTheme(currentTheme);

    // Add Ctrl/Cmd+Enter to execute
    if (onExecute) {
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => {
          onExecute();
        }
      );
    }
  };

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current) {
      const currentTheme = theme === 'dark' ? 'app-dark' : 'app-light';
      editorRef.current.updateOptions({ theme: currentTheme });
    }
  }, [theme]);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden h-full bg-[var(--surface-1)]">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount}
        theme={theme === 'dark' ? 'app-dark' : 'app-light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          readOnly,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          formatOnPaste: true,
          formatOnType: true,
          insertSpaces: true,
          detectIndentation: false,
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
          },
        }}
      />
    </div>
  );
}
