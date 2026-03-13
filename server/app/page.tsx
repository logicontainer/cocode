"use client";
import { useRef } from 'react';

import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { constrainedEditor } from 'constrained-editor-plugin';
// The initial code loaded into the editor
const defaultCode = [
  "// --- READ ONLY ---",
  "function processData(data) {",
  "  // Write your logic below:",
  "  ",
  "}",
  "// --- READ ONLY ---"
].join('\n');

export default function App() {
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.setValue(defaultCode)
    const constrainedInstance = constrainedEditor(monaco);
    const model = editor.getModel();
    constrainedInstance.initializeIn(editor);
    restrictions.push({
      range: [1, 1, 2, 10],
      allowMultiline: true
    });
    constrainedInstance.addRestrictionsTo(model, restrictions);
  }

  function showValue() {
    if (editorRef.current && editorRef.current) {
      alert(editorRef.current.getValue());
    }
  }

  return (
    <>
      <button onClick={showValue}>Show value</button>
      <Editor
        height="90vh"
        defaultLanguage="javascript"
        onMount={handleEditorDidMount}
      />
    </>
  );
}
