"use client";
import { useEffect, useRef } from 'react';

import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { Database } from '@/utils/supabase/database.types';
/* @ts-ignore */
import { constrainedEditor } from 'constrained-editor-plugin';
import "./editor-styles.css";

type QuestionRow = Database["public"]["Tables"]["Question"]["Row"];

export default function IDE({
  question,
  onChangeUserAnswer
}: {
  question: QuestionRow;
  onChangeUserAnswer: (answer: string) => void;
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const constrainedInstanceRef = useRef<any>(null);

  // Calculate the immutable line counts
  const initialTotalLines = question.content.split(/\r?\n/).length;
  const fromLine = Math.min(question.from_line || 1, initialTotalLines)
  const toLine = Math.min(question.to_line || 2, initialTotalLines)
  console.log(fromLine, toLine)
  const topReadonlyCount = fromLine - 1;
  const bottomReadonlyCount = Math.max(0, initialTotalLines - toLine + 1);

  const extractUserAnswer = () => {
    if (!editorRef.current) return "";

    const currentCode = editorRef.current.getValue();
    const currentLines = currentCode.split(/\r?\n/);

    const userCodeLines = currentLines.slice(
      topReadonlyCount,
      currentLines.length - bottomReadonlyCount
    );

    return userCodeLines.join('\n');
  };

  const setupEditorForQuestion = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const constrainedInstance = constrainedInstanceRef.current;

    if (!editor || !monaco || !constrainedInstance) return;

    // Destroy the old model
    const oldModel = editor.getModel();
    if (oldModel) {
      oldModel.dispose();
    }

    const newModel = monaco.editor.createModel(question.content, "javascript");
    editor.setModel(newModel);

    constrainedInstance.initializeIn(editor);
    editor.focus();

    const initialPosition = { lineNumber: fromLine || 1, column: 1 };
    editor.setPosition(initialPosition);
    editor.revealLineInCenter(fromLine);

    if (fromLine <= toLine) {
      editor.updateOptions({ readOnly: false }); // Reset to editable just in case

      const endColumn = newModel.getLineMaxColumn(toLine - 1);
      const range = [fromLine, 1, toLine - 1, endColumn];

      const restrictions = [{
        range,
        allowMultiline: true,
        label: "editableRegion"
      }];

      constrainedInstance.addRestrictionsTo(newModel, restrictions);

      const decorations = [{
        range: new monaco.Range(range[0], range[1], range[2], range[3]),
        options: {
          isWholeLine: true,
          className: "editable-area-highlight",
          marginClassName: "editable-area-margin",
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
        }
      }];
      editor.createDecorationsCollection(decorations);
    } else {
      // Fallback: make the whole editor read-only
      editor.updateOptions({ readOnly: true });
    }

    // Ping the parent with the initial extracted answer
    onChangeUserAnswer(extractUserAnswer());
  };

  // Run setup whenever the question prop changes
  useEffect(() => {
    setupEditorForQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  // Initial mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    constrainedInstanceRef.current = constrainedEditor(monaco);

    setupEditorForQuestion();
  };

  function handleChange() {
    onChangeUserAnswer(extractUserAnswer());
  }

  return (
    (question ?
      <MonacoEditor
        defaultLanguage="javascript"
        onMount={handleEditorDidMount}
        onChange={handleChange}
      /> : <div>Waiting for the presenter to post a question ...</div>)
  );
}
