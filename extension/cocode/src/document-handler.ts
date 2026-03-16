import * as vscode from 'vscode';
import { getUpdatedRanges } from 'vscode-position-tracking';
import { getQuestionOriginalRangeContent, getCurrentSuggestion as getSelectedSuggestion, isTakingSuggestions, State } from './statemachine';
import { Range } from './types';

class DynamicRange {
  private range_: vscode.Range | null;
  private onRangeChanged: (newRange: vscode.Range) => void;
  private onRangeRemoved: () => void;
  private document_: vscode.TextDocument

  constructor(range: vscode.Range, document: vscode.TextDocument, onRangeChanged: (newRange: vscode.Range) => void, onRangeRemoved: () => void) {
    this.range_ = range
    this.document_ = document
    this.onRangeChanged = onRangeChanged;
    this.onRangeRemoved = onRangeRemoved;
  }

  update(event: vscode.TextDocumentChangeEvent) {      
    if (this.range_ === null || event.document !== this.document_) {
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

export class DocumentHandler {
  private document: vscode.TextDocument
  private decorationHandler: DecorationHandler = new DecorationHandler()
  private dynamicRange: DynamicRange | null = null

  constructor(document: vscode.TextDocument, selection: vscode.Selection) {
    this.document = document

    this.handleRangeChanged(selection)

    vscode.workspace.onDidChangeTextDocument(event => {
      this.dynamicRange?.update(event)
    })

    vscode.window.onDidChangeVisibleTextEditors(editors => {
      const editor = editors.find(e => e.document.uri.toString() === this.document.uri.toString())
      if (!editor) return
      this.document = editor.document
      this.refreshRange()
    })
    
    vscode.workspace.onDidRenameFiles(async ev => {
      const renamedFile = ev.files.find(f => f.oldUri.toString() === this.document.uri.toString())
      if (!renamedFile) { return }

      this.document = await vscode.workspace.openTextDocument(renamedFile.newUri)
      this.refreshRange()
    })

    vscode.workspace.onDidSaveTextDocument(async document => {
      if (this.document.uri.scheme === 'untitled') {
        this.document = document
      }
    })
  }

  static fromEditor(editor: vscode.TextEditor) {
    return new DocumentHandler(editor.document, editor.selection)
  }

  private getActiveEditor(): vscode.TextEditor | null {
    return vscode.window.visibleTextEditors.find(e => e.document === this.document) ?? null
  }

  private getOrCreateActiveEditor(): Thenable<vscode.TextEditor> {
    const activeEditor = this.getActiveEditor()
    if (!!activeEditor) return Promise.resolve(activeEditor)
    return vscode.window.showTextDocument(this.document)
  }

  private refreshRange() {
    const range = this.dynamicRange?.getCurrentRange() ?? null
    range && this.handleRangeChanged(range)
  }

  handleRangeChanged(newRange: vscode.Range) {
    this.decorationHandler.updateRange(this.document, newRange)
    this.dynamicRange = new DynamicRange(
      newRange,
      this.document,
      this.handleRangeChanged,
      this.handleRangeRemoved,
    )
  }

  handleRangeRemoved() {
    this.decorationHandler.clear(this.document)
    this.dynamicRange = null
  }
  
  updateEditor(state: State) {
    switch (state.enum) {
      case 'no session': case 'creating session': case 'in session, idle':
        this.decorationHandler.clear(this.document);
        break;

      case 'in session, loading question': 
        this.handleRangeChanged(rangeToVsCodeRange(this.document, state.question.range))
        break;

      case 'in session, taking suggestions':
        this.updateAnswerPortion(state)
        this.handleRangeChanged(rangeToVsCodeRange(this.document, state.question.range))
        break;
    }
  }

  private updateAnswerPortion(state: State & { enum: 'in session, taking suggestions' }) {
    const replacement = getSelectedSuggestion(state)?.text ?? getQuestionOriginalRangeContent(state)

    if (!isTakingSuggestions(state)) {
        vscode.window.showErrorMessage("No question has been asked")
        return;
    }

    const range = rangeToVsCodeRange(this.document, state.question.range)

    this.getOrCreateActiveEditor().then(editor =>
      editor.edit(editBuilder => {
        this.decorationHandler.clear(this.document)
        this.dynamicRange = null
        editBuilder.replace(range, replacement);
      })
    ).then(success => {
      if (success) {       
        const lines = replacement.split(/\r?\n/);
        const lineCount = lines.length;
        const lastLineLength = lines[lineCount - 1].length;

        // The new start is the same as the old start (beginning of the line)
        const newStart = range.start;

        // The new end line is (startLine + number of new lines added)
        // The character is the length of that final string segment
        const newEnd = new vscode.Position(
          newStart.line + lineCount - 1,
          lastLineLength
        );
        this.handleRangeChanged(new vscode.Range(newStart, newEnd))
      } else {
        vscode.window.showErrorMessage("Failed to apply the code change.");
      }
    })
  }

  getSelectedRange() {
    const range = this.dynamicRange?.getCurrentRange()
    return range && vsCodeRangeToRange(range) || null
  }

  getFullEditorContent() {
    return this.document.getText()
  }
}
