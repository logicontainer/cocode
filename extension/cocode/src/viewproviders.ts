
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Answer } from './types';

export class StartSessionViewProvider implements vscode.TreeDataProvider<string> {
  getTreeItem(element: string): vscode.TreeItem {
    return new vscode.TreeItem(element);
  }

  getChildren(): Thenable<string[]> {
    return Promise.resolve([]);
  }
}

type OnChooseAnswerClbk = (id: number) => void

export class MyPanelViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private html: string;
  private extensionUri: vscode.Uri;
  private onChooseAnswer: OnChooseAnswerClbk;

  constructor(htmlPath: string, extensionUri: vscode.Uri, onChooseAnswer: OnChooseAnswerClbk) {
	  this.html = fs.readFileSync(htmlPath, 'utf-8');
    this.extensionUri = extensionUri;
    this.onChooseAnswer = onChooseAnswer
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const codiconsUri = webviewView.webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml().replaceAll("{{CODEICONS_URI_MAGICAL_STRING}}", codiconsUri.toString());

    // Handle messages sent from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'debug') {
        vscode.window.showInformationMessage(`[WEBVIEW DEBUG]: ${message.msg}`);
      } else if (message.command === 'chooseAnswer') {
        this.onChooseAnswer(message.id)
      }
    });
  }

  // Call this from anywhere in your extension to update the label
  updateLabel(text: string) {
    this._view?.webview.postMessage({ command: 'updateLabel', text });
  }

  updateAnswers(answers: Answer[]) {
    this._view?.webview.postMessage({ command: 'updateAnswers', answers })
  }

  private _getHtml(): string {
	  return this.html;
  }
}