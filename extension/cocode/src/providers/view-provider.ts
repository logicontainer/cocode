import * as vscode from 'vscode';
import * as fs from 'fs';
import { Answer } from '../types';
import { State } from '../statemachine';

export type ViewProviderState = State & { suggestionsVisible: boolean }

export class ViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private htmlPath: string;
  private jsPath: string
  private cocodeBaseUrl: string;
  private extensionContext: vscode.ExtensionContext
  private prevState_: State | null = null

  private onChooseAnswer: (id: Answer["id"] | null) => void; // id = null means unselecting chosen answer
  private requestUIUpdate: () => void

  constructor(
    htmlPath: string,
    jsPath: string,
    extensionContext: vscode.ExtensionContext,
    onChooseAnswer: (id: Answer["id"] | null) => void,
    cocodeBaseUrl: string,
    requestUIUpdate: () => void,
  ) {
    this.extensionContext = extensionContext
    this.requestUIUpdate = requestUIUpdate
    this.htmlPath = htmlPath
    this.jsPath = jsPath
    this.onChooseAnswer = onChooseAnswer;
    this.cocodeBaseUrl = cocodeBaseUrl;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml()

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
      } else if (command === 'toggleSuggestionsVisible') {
        this.extensionContext.workspaceState.update(
          "cocodeSuggestionsVisible", 
          !this.extensionContext.workspaceState.get<boolean>("cocodeSuggestionsVisible")
        )
        this.requestUIUpdate()
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

    webviewView.onDidChangeVisibility(() => { 
      this.prevState_ && this.updateView(this.prevState_)
    });
  }

  updateView(state: State) {
    this.prevState_ = state
    const vs = {
      ...state,
      suggestionsVisible: this.extensionContext.workspaceState.get<boolean>("cocodeSuggestionsVisible", true)
    } satisfies ViewProviderState
    this._view?.webview.postMessage({ command: 'updateState', state: vs })
  }

  private _getHtml(): string {
    if(!this._view) {
      return ""
    }

    const htmlFileContents = fs.readFileSync(this.htmlPath, 'utf-8');
    const jsFileContents = fs.readFileSync(this.jsPath, 'utf-8')
      .split('\n')
      .filter(l => !l.includes('Object.defineProperty(exports') && !l.includes('use strict')) // remove stuff that tsc generates
      .join('\n');

    const codiconsUri = this._view.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionContext.extensionUri,
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

    const html = htmlFileContents.replaceAll("{{CODEICONS_URI_MAGICAL_STRING}}", codiconsUri.toString())
      .replaceAll(
        "{{CODE_COMPLETION_STYLESHEET_MAGICAL_STRING}}",
        codeCompletionStylesheet,
      )
      .replaceAll("{{COCODE_BASE_URL}}", this.cocodeBaseUrl)
      .replaceAll(
        "{{COCODE_BASE_SHORT_URL}}",
        this.cocodeBaseUrl.replaceAll("https://", "").replaceAll("http://", ""),
      )
      .replaceAll("{{COCODE_VIEWJS_FILE_CONTENTS}}", jsFileContents);

    return html;
  }
}
