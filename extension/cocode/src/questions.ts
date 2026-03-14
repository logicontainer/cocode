import { assert } from "console";
import { Answer, Question, QuestionPostResult } from "./types";
import { MyPanelViewProvider } from "./viewproviders";
import * as vscode from 'vscode';
const { getUpdatedRanges } = require('vscode-position-tracking')


export class QuestionManager {
    private activeQuestionId: number | null;
    private activeRange: vscode.Range | null;
    private activeEditor: vscode.TextEditor | null;
    private provider: MyPanelViewProvider;
    private context: vscode.ExtensionContext;
    private decorationHandler: DecorationHandler;

    constructor(provider:MyPanelViewProvider, context: vscode.ExtensionContext) {
        this.activeRange = null;
        this.activeQuestionId = null;
        this.activeEditor = null;
        this.decorationHandler = new DecorationHandler();

        this.provider = provider;
        this.context = context;

        vscode.workspace.onDidChangeTextDocument((event) => {
            if (!this.activeRange || !this.activeQuestionId || !this.activeEditor) return;            
            
            const updatedRanges = getUpdatedRanges(
                // The locations you want to update,
                // under the form of an array of ranges.
                // It is a required argument.
                [this.activeRange],
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
            
            if (updatedRanges.length === 0) {
                // The location has been deleted, do nothing.
                vscode.window.showInformationMessage("The question's code has been deleted. Please ask a new question.");
                this.decorationHandler.clear(this.activeEditor);
                this.activeRange = null;
                this.activeQuestionId = null;
                this.activeEditor = null;
                return;
            }

            this.activeRange = updatedRanges[0];
            this.decorationHandler.updateRange(this.activeEditor, this.activeRange!);
        // The function returns the updated locations
        // according to document changes,
        // under the form of a new array of ranges.
        })
    }

    async startQuestion(editor: vscode.TextEditor) {
        // send post request to backend to create question.
        const content = editor.document.getText();
        const range = editor.selection;

        this.activeRange = range;       
        this.activeEditor = editor;
        
        this.decorationHandler.updateRange(editor, range);

        const sessionId = this.context.workspaceState.get("cocodeSessionId", null);
        const result = await fetch(`http://localhost:3000/api/sessions/${sessionId}/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                fromLine: range.start.line,
                toLine: range.end.line
            })
        });

        const { id: qid } = await result.json() as QuestionPostResult;
        this.activeQuestionId = qid;
    }

    chooseAnswer(answer: Answer) {
        if (!this.activeEditor || !this.activeRange) {
            vscode.window.showErrorMessage("No question has been asked")
            return;
        }

        const editor = this.activeEditor;
        const range = new vscode.Range(this.activeRange.start, this.activeRange.end)

        editor.edit(editBuilder => {
            editBuilder.replace(range, answer.text);
        }).then(success => {
            if (success) {
                vscode.window.showInformationMessage("Code updated with the chosen answer!");
            } else {
                vscode.window.showErrorMessage("Failed to apply the code change.");
            }
        });
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
