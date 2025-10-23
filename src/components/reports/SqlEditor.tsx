import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  height?: string;
  readOnly?: boolean;
}

export function SqlEditor({ value, onChange, onExecute, height = '300px', readOnly = false }: SqlEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Add Ctrl/Cmd+Enter to execute
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        if (onExecute) {
          onExecute();
        }
      }
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Editor
        height={height}
        language="sql"
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          readOnly,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
