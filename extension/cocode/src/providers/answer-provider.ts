
import * as vscode from 'vscode';
import * as fs from 'fs';
import { Answer } from '../types';


export class AnswerViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private html: string;
  private extensionUri: vscode.Uri;
  private onChooseAnswer: (id: number | null) => void; // id = null means unselecting chosen answer

  private answers: Answer[] = [];
  private sessionCode: number | null = null;
  private chosenAnswerId: number | null = null;
  private questionId: number | null = null;

  constructor(htmlPath: string, extensionUri: vscode.Uri, onChooseAnswer: (id: number | null) => void) {
	  this.html = fs.readFileSync(htmlPath, 'utf-8');
    this.extensionUri = extensionUri;
    this.onChooseAnswer = onChooseAnswer;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const codiconsUri = webviewView.webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml().replaceAll("{{CODEICONS_URI_MAGICAL_STRING}}", codiconsUri.toString());

    // Handle messages sent from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if(message.command === 'postQuestion') {
        vscode.commands.executeCommand('cocode.postQuestion');
      } else if (message.command === 'debug') {
        vscode.window.showInformationMessage(`[WEBVIEW DEBUG]: ${message.msg}`);
      } else if (message.command === 'chooseAnswer') {
        this.chosenAnswerId = message.id;
        this.onChooseAnswer(message.id)
      } else if (message.command === 'closeQuestion') {
        vscode.commands.executeCommand('cocode.closeQuestion');
      }
    });

    webviewView.onDidChangeVisibility(() => {
      this.sendSessionCodeToWebview();
      this.sendAnswersToWebview();
      this.sendQuestionIdToWebview();
    });

  }

  private sendSessionCodeToWebview(): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'setSessionCode', text: this.sessionCode });
    }
  }

  private sendAnswersToWebview(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateAnswers',
        answers: this.answers,
        chosenAnswerId: this.chosenAnswerId
      });
    }
  }

  private sendQuestionIdToWebview(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateQuestion',
        id: this.questionId
      });
    }
  }

  // Call this from anywhere in your extension to update the label
  updateSessionCode(code: number) {
    this.sessionCode = code;
    this.sendSessionCodeToWebview();
  }

  updateAnswers(answers: Answer[]) {
    this.answers = answers;
    console.log("Updating answers with current id: ", this.chosenAnswerId);
    this.sendAnswersToWebview();
  }

  updateQuestionId(id: number | null) {
    this.questionId = id;
    this.chosenAnswerId = null;
    this.sendQuestionIdToWebview();
  }

  private _getHtml(): string {
	  return this.html;
  }

  getChosenAnswerId(): number | null {
    return this.chosenAnswerId;
  }
}
