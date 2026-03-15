import * as vscode from 'vscode';
import * as fs from 'fs';
import { Answer, Question } from '../types';

export class ViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private html: string;
  private extensionUri: vscode.Uri;
  private cocodeBaseUrl: string;
  private onChooseAnswer: (id: number | null) => void; // id = null means unselecting chosen answer

  private rejoinableSessionCode: number | null = null;
  private answers: Answer[] = [];
  private sessionCode: number | null = null;
  private chosenAnswerId: number | null = null;
  private question: Question | null = null;

  constructor(
    htmlPath: string, 
    rejoinableSessionCode: number | null,
    extensionUri: vscode.Uri, 
    onChooseAnswer: (id: number | null) => void,
    cocodeBaseUrl: string,
  ) {
    this.html = fs.readFileSync(htmlPath, 'utf-8');
    this.extensionUri = extensionUri;
    this.onChooseAnswer = onChooseAnswer;
    this.rejoinableSessionCode = rejoinableSessionCode;
    this.cocodeBaseUrl = cocodeBaseUrl;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const codiconsUri = webviewView.webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    let codeCompletionStylesheet = null;
    if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark) {
      codeCompletionStylesheet = "atom-one-dark";
    } else if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light) {
      codeCompletionStylesheet = "atom-one-light";
    } else {
      codeCompletionStylesheet = "atom-one-dark";
    }

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml()      
      .replaceAll("{{CODEICONS_URI_MAGICAL_STRING}}", codiconsUri.toString())
      .replaceAll("{{CODE_COMPLETION_STYLESHEET_MAGICAL_STRING}}", codeCompletionStylesheet)
      .replaceAll("{{COCODE_BASE_URL}}", this.cocodeBaseUrl);

    // Handle messages sent from the webview
    webviewView.webview.onDidReceiveMessage(({ command, ...data }) => {
      if (command === 'StartSession') {
        vscode.commands.executeCommand('cocode.startSession');
      } else if (command === 'RejoinSession') {
        vscode.commands.executeCommand('cocode.rejoinSession');
      } else if(command === 'postQuestion') {
        vscode.commands.executeCommand('cocode.postQuestion');
      } else if (command === 'debug') {
        vscode.window.showInformationMessage(`[WEBVIEW DEBUG]: ${data.msg}`);
      } else if (command === 'chooseAnswer') {
        this.chosenAnswerId = data.id;
        this.onChooseAnswer(data.id)
      } else if (command === 'acceptSuggestion') {
        vscode.commands.executeCommand('cocode.acceptSuggestion');
      } else if (command === 'rejectSuggestions') {
        vscode.commands.executeCommand('cocode.rejectSuggestions');
      } else if (command === 'deleteSuggestion') {
        vscode.commands.executeCommand('cocode.deleteSuggestion', data.id)
      }
    });

    webviewView.onDidChangeVisibility(() => {
      this.updateView()
    });

    this.updateView()
  }

  private updateView() {
    this.sendRejoinableSessionCodeToWebview();
    this.sendSessionCodeToWebview();
    this.sendAnswersToWebview();
    this.sendQuestionIdToWebview();
  }

  private sendRejoinableSessionCodeToWebview(): void {
    this._view?.webview?.postMessage({ command: 'setRejoinableSessionCode', code: this.rejoinableSessionCode })
  }

  private sendSessionCodeToWebview(): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'setSessionCode', code: this.sessionCode });
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
        id: this.question?.id || null,
        language: this.question?.language || "javascript"
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
    console.log("Updating answers with currently chosen answer id: ", this.chosenAnswerId);
    this.sendAnswersToWebview();
  }

  updateQuestion(question: Question | null) {
    this.question = question;
    this.chosenAnswerId = null;
    this.sendQuestionIdToWebview();
  }

  showAnswerPage() {
    if (this._view) {
      this._view.webview.postMessage({ command: 'showAnswerPage' });
    }
  }

  showStartSessionPage() {
    if (this._view) {
      this._view.webview.postMessage({ command: 'showStartSessionPage' });
    }
  }

  private _getHtml(): string {
	  return this.html;
  }

  getChosenAnswerId(): number | null {
    return this.chosenAnswerId;
  }
}
