import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { SPLITCRAFT_DTS } from '../lib/templates';

// Colours from design/tokens.css (code editor, dark).
const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('splitcraft-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7D857A' },
      { token: 'keyword', foreground: '7FC4E8' },
      { token: 'string', foreground: 'A8D8A0' },
      { token: 'identifier', foreground: 'D8DCD5' },
      { token: 'number', foreground: 'F2B37A' },
    ],
    colors: {
      'editor.background': '#15171A',
      'editor.foreground': '#D8DCD5',
      'editorLineNumber.foreground': '#4E5652',
      'editorLineNumber.activeForeground': '#8C938A',
      'editor.lineHighlightBackground': '#1D2124',
      'editorCursor.foreground': '#F2B37A',
    },
  });
  monaco.languages.typescript.javascriptDefaults.addExtraLib(SPLITCRAFT_DTS, 'splitcraft.d.ts');
};

interface Props {
  language: 'javascript' | 'css';
  value: string;
  onChange(value: string): void;
  label: string;
  readOnly?: boolean;
  onSave?(): void;
  /**
   * Fill a positioned parent that only has a min-height. Monaco sizes itself to 100% of
   * its parent's height, which a min-height alone leaves undefined (it collapses to 5 px).
   */
  fill?: boolean;
}

/** Monaco editor, themed to the design. Monaco itself is loaded from a CDN on first use. */
export function CodeEditor({ language, value, onChange, label, readOnly, onSave, fill }: Props) {
  // Monaco keeps the first command it is given, so route Cmd/Ctrl+S through a ref.
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  }, [onSave]);
  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save.current?.());
  };
  const editor = (
    <Editor
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme="splitcraft-dark"
      beforeMount={beforeMount}
      onMount={onMount}
      loading={<span style={{ color: '#8C938A', padding: 20 }}>Loading editor…</span>}
      options={{
        ariaLabel: label,
        readOnly,
        minimap: { enabled: false },
        fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
        fontSize: 13,
        lineHeight: 24,
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 18, bottom: 18 },
      }}
    />
  );
  return fill ? <div style={{ position: 'absolute', inset: 0 }}>{editor}</div> : editor;
}
