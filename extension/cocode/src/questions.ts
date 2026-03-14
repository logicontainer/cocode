import { assert } from "console";
import { Answer, Question, QuestionPostResult } from "./types";
import { AnswerViewProvider } from "./providers/answer-provider";
import * as vscode from 'vscode';
const { getUpdatedRanges } = require('vscode-position-tracking')


class DynamicRange {
    private range_: vscode.Range;
    private onRangeRemoved: () => void;

    constructor(range: vscode.Range, onRangeRemoved: () => void) {
        this.range_ = range
        this.onRangeRemoved = onRangeRemoved;
    }

    internalRange() { return this.range_; }

    update(event: vscode.TextDocumentChangeEvent) {            
        const updatedRanges = getUpdatedRanges(
            // The locations you want to update,
            // under the form of an array of ranges.
            // It is a required argument.
            [this.range_],
            // Array of document changes.
            // It is a required argument.
            event.contentChanges,
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
        }

        this.range_ = updatedRanges[0]
    }
}

export class QuestionManager {
    private activeQuestionId: number | null;
    private activeRange: DynamicRange | null;
    private activeEditor: vscode.TextEditor | null;
    private decorationHandler: DecorationHandler;
    private apiPostQuestion: (question: Omit<Question, "id">) => Promise<QuestionPostResult>

    constructor(apiPostQuestion: (question: Omit<Question, "id">) => Promise<QuestionPostResult>) {
        this.activeRange = null;
        this.activeQuestionId = null;
        this.activeEditor = null;
        this.decorationHandler = new DecorationHandler();

        this.apiPostQuestion = apiPostQuestion

        vscode.workspace.onDidChangeTextDocument(event => {
            if (!this.activeRange) return
            this.activeRange.update(event)
        })
    }

    onRangeRemoved() {
        vscode.window.showWarningMessage("Range removed. Pose a new question")
        this.endQuestion()
    }

    async startQuestion(editor: vscode.TextEditor) {
        // send post request to backend to create question.
        const content = editor.document.getText();
        const range = editor.selection;

        this.activeEditor = editor;
        this.activeRange = new DynamicRange(
            new vscode.Range(
                editor.document.lineAt(range.start.line).range.start,
                editor.document.lineAt(range.end.line).range.end
            ), 
            this.onRangeRemoved
        );
        this.decorationHandler.updateRange(editor, range);

        const { id: qid } = await this.apiPostQuestion({
            content,
            fromLine: range.start.line + 1, // 1-indexing
            toLine: range.end.line + 2 // exclusive end line
        })

        this.activeQuestionId = qid;
    }

    chooseAnswer(answer: Answer) {
        if (!this.activeEditor || !this.activeRange) {
            vscode.window.showErrorMessage("No question has been asked")
            return;
        }

        const range = this.activeRange.internalRange()
        const editor = this.activeEditor;

        this.activeEditor.edit(editBuilder => {
            this.decorationHandler.clear(editor)
            this.activeRange = null;
            editBuilder.replace(range, answer.text);
        }).then(success => {
            if (success && this.activeEditor) {       
                const lines = answer.text.split(/\r?\n/);
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

                this.activeRange = new DynamicRange(new vscode.Range(newStart, newEnd), this.onRangeRemoved); 
                this.decorationHandler.updateRange(this.activeEditor, this.activeRange.internalRange())   
                vscode.window.showInformationMessage("Code updated with the chosen answer!");
            } else {
                vscode.window.showErrorMessage("Failed to apply the code change.");
            }
        });
    }

    endQuestion() {
        this.activeRange = null;
        this.activeQuestionId = null;
        this.activeEditor = null;
        if (this.activeEditor) 
            this.decorationHandler.clear(this.activeEditor)
    }

    getActiveQuestionId(): number | null {
        return this.activeQuestionId ?? null
    }
}

class DecorationHandler {
    private decoration: vscode.TextEditorDecorationType;
    constructor() {
        this.decoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: 'rgba(164, 37, 15, 0.3)'
        });
    }

    clear(editor: vscode.TextEditor) {
        editor.setDecorations(this.decoration, []);
    }

    updateRange(editor: vscode.TextEditor, range: vscode.Range) {
        editor.setDecorations(this.decoration, [range]);
    }
}
