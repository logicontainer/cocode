import { assert } from "console";
import { Question, QuestionPostResult } from "./types";
import { MyPanelViewProvider } from "./viewproviders";
import * as vscode from 'vscode';
const { getUpdatedRanges } = require('vscode-position-tracking')

export class QuestionManager {
    private activeQuestionId: number | null;
    private activeRange: vscode.Range | null;
    private provider: MyPanelViewProvider;
    private context: vscode.ExtensionContext;

    constructor(provider:MyPanelViewProvider, context: vscode.ExtensionContext) {
        
        this.activeRange = null;
        this.activeQuestionId = null;

        this.provider = provider;
        this.context = context;

        vscode.workspace.onDidChangeTextDocument((event) => {
            if (!this.activeRange || !this.activeQuestionId) return;            
            
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
            
            this.activeRange = updatedRanges[0];
        // The function returns the updated locations
        // according to document changes,
        // under the form of a new array of ranges.
        })

        setInterval(() => this.pollAnswers(), 5000);
    }

    async startQuestion(range: vscode.Range, content: string) {
        // send post request to backend to create question.
        const sessionId = await this.context.workspaceState.get("cocodeSessionId", null);
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
        console.log(qid);
        this.activeQuestionId = qid;
        this.activeRange = range;        
    }

    async pollAnswers() {
        console.log(this.activeQuestionId);
        if (!this.activeQuestionId) return;

        const sessionId = await this.context.workspaceState.get("cocodeSessionId", null);

        const result = await fetch(`http://localhost:3000/api/sessions/${sessionId}/questions/${this.activeQuestionId}/answers`);
        console.log(result);
    }
}