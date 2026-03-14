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
      const range = [question.from_line, 1, question.to_line - 1, endColumn]
      const restrictions = [
        {
          // range format: [startLine, startColumn, endLine, endColumn]
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

      // // Top dimmed region: Line 1 down to the line just before from_line
      // if (question.from_line > 1) {
      //   const topEndLine = question.from_line - 1;
      //   decorations.push({
      //     range: new monaco.Range(1, 1, topEndLine, model.getLineMaxColumn(topEndLine)),
      //     options: {
      //       className: "dimmed-text",
      //       isWholeLine: true,
      //       marginClassName: "",
      //       stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      //     }
      //   });
      // }
      //
      // // Bottom dimmed region: From to_line down to the very end of the file
      // if (question.to_line <= totalLines) {
      //   decorations.push({
      //     range: new monaco.Range(question.to_line, 1, totalLines, model.getLineMaxColumn(totalLines)),
      //     options: {
      //       className: "dimmed-text",
      //       isWholeLine: true,
      //       marginClassName: "",
      //       stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      //     }
      //   });
      // }

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
  // (Splitting by /\r?\n/ safely handles Windows and Mac/Unix line endings)
  const initialTotalLines = question.content.split(/\r?\n/).length;

  // E.g., if from_line is 4, the top 3 lines are forever read-only
  const topReadonlyCount = question.from_line - 1;

  // E.g., if total is 10 and to_line is 8, lines 8, 9, 10 are forever read-only (count = 3)
  const bottomReadonlyCount = Math.max(0, initialTotalLines - question.to_line + 1);

  const extractUserAnswer = () => {
    if (!editorRef.current) return;

    // 2. Get the current state of the entire editor
    const currentCode = editorRef.current.getValue();
    const currentLines = currentCode.split(/\r?\n/);

    // 3. Slice the array to exclude the exact number of top and bottom read-only lines
    const userCodeLines = currentLines.slice(
      topReadonlyCount,
      currentLines.length - bottomReadonlyCount
    );

    // 4. Join the array back into a pristine string
    const extractedCode = userCodeLines.join('\n');

    console.log("Securely extracted user code:\n", extractedCode);
    // TODO: Send `extractedCode` to your backend or evaluator
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
