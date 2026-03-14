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
  const selectionListenerRef = useRef<{ dispose: () => void } | null>(null);
  const constrainedInstanceRef = useRef<any>(null);

  // Calculate the immutable line counts
  const initialTotalLines = question.content.split(/\r?\n/).length;
  const fromLine = Math.min(question.from_line || 1, initialTotalLines)
  const toLine = Math.min(question.to_line || 2, initialTotalLines + 1)
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
    editor.updateOptions({ minimap: { enabled: false }, scrollBeyondLastLine: false })

    const initialPosition = { lineNumber: fromLine || 1, column: 1 };
    editor.setPosition(initialPosition);
    editor.revealLineInCenter(fromLine);

    if (fromLine <= toLine) {
      editor.updateOptions({ readOnly: false });

      const endColumn = newModel.getLineMaxColumn(toLine - 1);
      const range = [fromLine, 1, toLine - 1, endColumn];

      const restrictions = [{
        range,
        allowMultiline: true,
        label: "editableRegion"
      }];

      constrainedInstance.addRestrictionsTo(newModel, restrictions);

      // --- 1. Track the editable decoration separately ---
      // By putting this in its own collection, we can query its dynamic range later
      const editableAreaDecoration = editor.createDecorationsCollection([{
        range: new monaco.Range(range[0], range[1], range[2], range[3]),
        options: {
          isWholeLine: true,
          className: "editable-area-highlight",
          marginClassName: "editable-area-margin",
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
        }
      }]);

      // --- 2. Add the Dimmed Decorations ---
      const dimmedDecorations = [];
      const lineCount = newModel.getLineCount();

      if (fromLine > 1) {
        dimmedDecorations.push({
          range: new monaco.Range(1, 1, fromLine - 1, newModel.getLineMaxColumn(fromLine - 1)),
          options: {
            isWholeLine: true,
            inlineClassName: "dimmed-code",
            marginClassName: "dimmed-margin",
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });
      }

      if (toLine <= lineCount) {
        dimmedDecorations.push({
          range: new monaco.Range(toLine, 1, lineCount, newModel.getLineMaxColumn(lineCount)),
          options: {
            isWholeLine: true,
            inlineClassName: "dimmed-code",
            marginClassName: "dimmed-margin",
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });
      }

      editor.createDecorationsCollection(dimmedDecorations);

      // --- 3. Update the Selection Listener ---
      if (selectionListenerRef.current) {
        selectionListenerRef.current.dispose();
      }

      selectionListenerRef.current = editor.onDidChangeCursorSelection(() => {
        const selections = editor.getSelections();
        // Fetch the LIVE range of the editable area
        const currentEditableRange = editableAreaDecoration.getRanges()[0];

        if (!selections || !currentEditableRange) return;

        // Compare against the dynamically updating start/end lines
        const isOutside = selections.some(
          (sel) =>
            sel.startLineNumber < currentEditableRange.startLineNumber ||
            sel.endLineNumber > currentEditableRange.endLineNumber
        );

        editor.updateOptions({ readOnly: isOutside });
      });

    } else {
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
      /> : <div>Waiting for the presenter to post a question ...</div >)
  );
}


/**
* Extracts a specific range of lines from a multi-line string.
*
* @param {string} text - The full multi-line string.
* @param {number} fromLine - The starting line number (1-indexed, inclusive).
* @param {number} toLine - The ending line number (1-indexed, exclusive).
* @returns {string} The extracted lines.
*/
export function extractLineRange(text: string, fromLine: number, toLine: number) {
  if (!text) return "";

  const lines = text.split(/\r?\n/);

  // Convert 1-based line numbers to 0-based array indices
  const startIndex = Math.max(0, fromLine - 1);
  const endIndex = Math.max(0, toLine - 1);

  // slice(start, end) includes start and excludes end
  const extractedLines = lines.slice(startIndex, endIndex);

  return extractedLines.join('\n');
}
