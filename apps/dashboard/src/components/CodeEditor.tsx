import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { SPLITCRAFT_DTS } from '../lib/templates';

export type EditorTheme = 'dark' | 'grey' | 'light';

export const EDITOR_THEMES: Array<{ id: EditorTheme; label: string }> = [
  { id: 'dark', label: 'Dark' },
  { id: 'grey', label: 'Grey' },
  { id: 'light', label: 'Light' },
];

// Colours from design/tokens.css. Dark is the design's code editor; grey is a softer dark;
// light uses the app's own ink on white.
const beforeMount: BeforeMount = (monaco) => {
  const darkRules = [
    { token: 'comment', foreground: '7D857A' },
    { token: 'keyword', foreground: '7FC4E8' },
    { token: 'string', foreground: 'A8D8A0' },
    { token: 'identifier', foreground: 'D8DCD5' },
    { token: 'number', foreground: 'F2B37A' },
  ];
  monaco.editor.defineTheme('splitcraft-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: darkRules,
    colors: {
      'editor.background': '#15171A',
      'editor.foreground': '#D8DCD5',
      'editorLineNumber.foreground': '#4E5652',
      'editorLineNumber.activeForeground': '#8C938A',
      'editor.lineHighlightBackground': '#1D2124',
      'editorCursor.foreground': '#F2B37A',
    },
  });
  monaco.editor.defineTheme('splitcraft-grey', {
    base: 'vs-dark',
    inherit: true,
    rules: [...darkRules, { token: 'identifier', foreground: 'E6E9E4' }],
    colors: {
      'editor.background': '#2B2F33',
      'editor.foreground': '#E6E9E4',
      'editorLineNumber.foreground': '#6F7771',
      'editorLineNumber.activeForeground': '#A3AAA1',
      'editor.lineHighlightBackground': '#33383D',
      'editorCursor.foreground': '#F2B37A',
    },
  });
  monaco.editor.defineTheme('splitcraft-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6B7368' },
      { token: 'keyword', foreground: '3B5B8C' },
      { token: 'string', foreground: '0F6B57' },
      { token: 'identifier', foreground: '15171A' },
      { token: 'number', foreground: 'B35F1C' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#15171A',
      'editorLineNumber.foreground': '#A3AAA1',
      'editorLineNumber.activeForeground': '#5F6660',
      'editor.lineHighlightBackground': '#F4F5F2',
      'editorCursor.foreground': '#D97A2B',
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
  theme?: EditorTheme;
  /** At the top or bottom of the code, let the wheel scroll the page (one-column layouts). */
  passWheel?: boolean;
  /** The Monaco editor once it has loaded, e.g. to run Format. */
  onEditor?(editor: MonacoEditor.IStandaloneCodeEditor | null): void;
}

/** Monaco editor, themed to the design. Monaco itself is loaded from a CDN on first use. */
export function CodeEditor({
  language,
  value,
  onChange,
  label,
  readOnly,
  onSave,
  fill,
  onEditor,
  theme = 'dark',
  passWheel = false,
}: Props) {
  // Monaco keeps the first command it is given, so route Cmd/Ctrl+S through a ref.
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  }, [onSave]);
  const ready = useRef(onEditor);
  useEffect(() => {
    ready.current = onEditor;
  }, [onEditor]);
  useEffect(() => () => ready.current?.(null), []);
  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save.current?.());
    ready.current?.(editor);
  };
  const editor = (
    <Editor
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme={`splitcraft-${theme}`}
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
        // Long lines wrap instead of running off the edge (no sideways scrolling).
        wordWrap: 'on',
        wrappingIndent: 'indent',
        scrollbar: { alwaysConsumeMouseWheel: !passWheel, verticalScrollbarSize: 10 },
        fixedOverflowWidgets: true,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 18, bottom: 18 },
      }}
    />
  );
  return fill ? <div style={{ position: 'absolute', inset: 0 }}>{editor}</div> : editor;
}
