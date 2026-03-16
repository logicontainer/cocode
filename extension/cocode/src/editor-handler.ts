import * as vscode from 'vscode';
import { getUpdatedRanges } from 'vscode-position-tracking';
import { State } from './statemachine';
import { Range } from './types';

class DynamicRange {
  private range_: vscode.Range | null;
  private onRangeChanged: (newRange: vscode.Range) => void;
  private onRangeRemoved: () => void;

  constructor(range: vscode.Range, onRangeChanged: (newRange: vscode.Range) => void, onRangeRemoved: () => void) {
    this.range_ = range
    this.onRangeChanged = onRangeChanged;
    this.onRangeRemoved = onRangeRemoved;
  }

  update(event: vscode.TextDocumentChangeEvent) {      
    if (this.range_ === null) {
      return;
    }

    const updatedRanges = getUpdatedRanges(
      // The locations you want to update,
      // under the form of an array of ranges.
      // It is a required argument.
      [this.range_],
      // Array of document changes.
      // It is a required argument.
      event.contentChanges.slice(),
      // An object with various options.
      // It is not a required argument,
      // nor any of its options.
      { 
        onDeletion: 'shrink',
        onAddition: 'extend'
      }
    )

    if (updatedRanges.length == 0) {
      this.onRangeRemoved();
      return;
    }

    console.assert(updatedRanges.length == 1); // if not, the library is bugged

    const oldRange = this.range_
    this.range_ = updatedRanges[0]
    if (!this.range_.isEqual(oldRange)) {
      this.onRangeChanged(this.range_)
    }
  }

  getCurrentRange() {
    return this.range_;
  }
}

class DecorationHandler {
  private decoration: vscode.TextEditorDecorationType;
  constructor() {
    this.decoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(34, 170, 34, 0.1)'
    });
  }

  clear(document: vscode.TextDocument) {
    vscode.window.visibleTextEditors.forEach(e => {
      if (e.document === document) {
        e.setDecorations(this.decoration, [])
      }
    })
  }

  updateRange(document: vscode.TextDocument, range: vscode.Range) {
    vscode.window.visibleTextEditors.forEach(e => {
      if (e.document === document) {
        e.setDecorations(this.decoration, [range])
      }
    })
  }
}

function rangeToVsCodeRange(document: vscode.TextDocument, range: Range) {
  return new vscode.Range(
    document.lineAt(range.fromLine - 1).range.start,
    document.lineAt(range.toLine - 2).range.end
  )
}

function vsCodeRangeToRange(range: vscode.Range) {
  return { 
    fromLine: range.start.line + 1,
    toLine: range.end.line + 2,
  } satisfies Range
}

export class EditorHandler {
  private editor: vscode.TextEditor
  private decorationHandler: DecorationHandler = new DecorationHandler()
  private dynamicRange: DynamicRange | null = null

  constructor(editor: vscode.TextEditor) {
    this.editor = editor
    this.decorationHandler

    this.handleRangeChanged(editor.selection)

    vscode.workspace.onDidChangeTextDocument(event => {
      this.dynamicRange?.update(event)
    })
  }

  handleRangeChanged(newRange: vscode.Range) {
    this.decorationHandler.updateRange(this.editor.document, newRange)
    this.dynamicRange = new DynamicRange(
      newRange,
      this.handleRangeChanged,
      this.handleRangeRemoved,
    )
  }

  handleRangeRemoved() {
    this.decorationHandler.clear(this.editor.document)
    this.dynamicRange = null
  }
  
  updateEditor(state: State) {
    switch (state.enum) {
      case 'no session': case 'creating session': case 'in session, idle':
        this.decorationHandler.clear(this.editor.document);
        break;

      case 'in session, loading question': case 'in session, taking suggestions':
        const range = rangeToVsCodeRange(this.editor.document, state.question.range) 
        this.handleRangeChanged(range)
        break;
    }
  }

  getSelectedRange() {
    const range = this.dynamicRange?.getCurrentRange()
    return range && vsCodeRangeToRange(range) || null
  }

  getFullEditorContent() {
    return this.editor.document.getText()
  }
}
