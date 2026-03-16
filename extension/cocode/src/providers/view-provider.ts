import * as vscode from 'vscode';
import * as fs from 'fs';
import { Answer } from '../types';
import { State } from '../statemachine';

export class ViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private html: string;
  private extensionUri: vscode.Uri;
  private cocodeBaseUrl: string;
  private jsFileContents: string

  private onChooseAnswer: (id: Answer["id"] | null) => void; // id = null means unselecting chosen answer
  private requestUIUpdate: () => void

  constructor(
    htmlPath: string,
    jsPath: string,
    extensionUri: vscode.Uri, 
    onChooseAnswer: (id: Answer["id"] | null) => void,
    cocodeBaseUrl: string,
    requestUIUpdate: () => void,
  ) {
    this.requestUIUpdate = requestUIUpdate
    this.html = fs.readFileSync(htmlPath, 'utf-8');
    this.jsFileContents = fs.readFileSync(jsPath, 'utf-8')
      .split('\n')
      .filter(l => !l.includes('Object.defineProperty(exports') && !l.includes('use strict')) // remove stuff that tsc generates
      .join('\n');
    this.extensionUri = extensionUri;
    this.onChooseAnswer = onChooseAnswer;
    this.cocodeBaseUrl = cocodeBaseUrl;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const codiconsUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "node_modules",
        "@vscode/codicons",
        "dist",
        "codicon.css",
      ),
    );

    let codeCompletionStylesheet = null;
    if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark) {
      codeCompletionStylesheet = "atom-one-dark";
    } else if (
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
    ) {
      codeCompletionStylesheet = "atom-one-light";
    } else {
      codeCompletionStylesheet = "atom-one-dark";
    }

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml()
      .replaceAll("{{CODEICONS_URI_MAGICAL_STRING}}", codiconsUri.toString())
      .replaceAll(
        "{{CODE_COMPLETION_STYLESHEET_MAGICAL_STRING}}",
        codeCompletionStylesheet,
      )
      .replaceAll("{{COCODE_BASE_URL}}", this.cocodeBaseUrl)
      .replaceAll(
        "{{COCODE_BASE_SHORT_URL}}",
        this.cocodeBaseUrl.replaceAll("https://", "").replaceAll("http://", ""),
      )
      .replaceAll("{{COCODE_VIEWJS_FILE_CONTENTS}}", this.jsFileContents);

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
      } else if (command === 'updateSuggestionsVisible') {
        vscode.commands.executeCommand('updateSuggestionsVisible', data.visible)
      } else if (command === 'chooseAnswer') {
        this.onChooseAnswer(data.id)
      } else if (command === 'acceptSuggestion') {
        vscode.commands.executeCommand('cocode.acceptSuggestion');
      } else if (command === 'rejectSuggestions') {
        vscode.commands.executeCommand('cocode.rejectSuggestions');
      } else if (command === 'deleteSuggestion') {
        vscode.commands.executeCommand('cocode.deleteSuggestion', data.id)
      } else if (command === 'requestUIUpdate') {
        this.requestUIUpdate()
      }
    });

    webviewView.onDidChangeVisibility(() => { throw new Error("TODO") }); // TODO
  }

  updateView(state: State) {
    this._view?.webview.postMessage({ command: 'updateState', state })
  }

  private _getHtml(): string {
    return this.html;
  }
}
