"use client"; import { useEffect, useRef, useState } from 'react';

import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { Database } from '@/utils/supabase/database.types';
/* @ts-ignore */
import { constrainedEditor } from 'constrained-editor-plugin';
import "./editor-styles.css";
import { Button } from '@/components/ui/button';

export default function IDE({ question }: { question: Database["public"]["Tables"]["Question"]["Row"] }) {
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const [userAnswer, setUserAnswer] = useState<string>("");

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.setValue(question.content)
    setUserAnswer(extractUserAnswer() || "")
    const constrainedInstance = constrainedEditor(monaco);
    const model = editor.getModel();
    constrainedInstance.initializeIn(editor);

    if (model == null) {
      return
    }

    const totalLines = model.getLineCount();
    if (question.from_line <= question.to_line) {
      const endColumn = model.getLineMaxColumn(question.to_line - 1);
      // range format: [startLine, startColumn, endLine, endColumn]
      const range = [question.from_line, 1, question.to_line - 1, endColumn]
      const restrictions = [
        {
          range,
          allowMultiline: true, // Allows the user to press Enter and add new lines
          label: "editableRegion"
        }
      ];

      // Apply restrictions to the model
      constrainedInstance.addRestrictionsTo(model, restrictions);

      const decorations = [
        {
          // Editable area
          range: new monaco.Range(...range),
          options: {
            isWholeLine: true,
            className: "editable-area-highlight",
            marginClassName: "editable-area-margin",
            stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
          }
        }
      ];
      editor.createDecorationsCollection(decorations);
    } else {
      // Fallback: If lineFrom and lineTo are adjacent, make the whole editor read-only
      editor.updateOptions({ readOnly: true });
    }
  }

  function handleChange() {
    setUserAnswer(extractUserAnswer() || "")
  }
  // 1. Calculate the immutable line counts once 
  const initialTotalLines = question.content.split(/\r?\n/).length;

  const topReadonlyCount = question.from_line - 1;

  const bottomReadonlyCount = Math.max(0, initialTotalLines - question.to_line + 1);

  const extractUserAnswer = () => {
    if (!editorRef.current) return;

    const currentCode = editorRef.current.getValue();
    const currentLines = currentCode.split(/\r?\n/);

    const userCodeLines = currentLines.slice(
      topReadonlyCount,
      currentLines.length - bottomReadonlyCount
    );

    const extractedCode = userCodeLines.join('\n');

    return extractedCode
  };

  const handleSubmit = () => {
    window.alert(userAnswer)
  }

  return (
    <>
      <Button className='cursor-pointer' onClick={handleSubmit}>Submit</Button>
      <Editor
        height="90vh"
        defaultLanguage="javascript"
        onMount={handleEditorDidMount}
        onChange={handleChange}
      />
    </>
  );
}
