
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Answer } from './types';

export class StartSessionViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private html: string;
  private sessionCode: number | null;
  constructor(htmlPath: string, sessionCode: number | null) {
    this.html = fs.readFileSync(htmlPath, 'utf-8');
    this.sessionCode = sessionCode;
  }  

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    console.log(`Session code: ${this.sessionCode}`);

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml();

    webviewView.onDidChangeVisibility(() => this.sendSessionCodeToWebview());
    this.sendSessionCodeToWebview();

    // Handle messages sent from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'StartSession') {
        console.log(`Tried to start sessoin`);
        vscode.commands.executeCommand('cocode.startSession');
      }
      else if (message.command === 'RejoinSession') {
        vscode.commands.executeCommand('cocode.rejoinSession');
      }
    });
    
  }

  private sendSessionCodeToWebview(): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'setSessionCode', text: this.sessionCode });
    } 
  }

  private _getHtml(): string {
    return this.html;
  }

}

export class MyPanelViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private html: string;
  private extensionUri: vscode.Uri;
  constructor(htmlPath: string, extensionUri: vscode.Uri) {
	  this.html = fs.readFileSync(htmlPath, 'utf-8');
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const codiconsUri = webviewView.webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml().replaceAll("{{CODEICONS_URI_MAGICAL_STRING}}", codiconsUri.toString());

    // Handle messages sent from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'StartSession') {
        vscode.window.showInformationMessage(`Input: ${message.value}`);
      } else if (message.command === 'debug') {
        vscode.window.showInformationMessage(`[WEBVIEW DEBUG]: ${message.msg}`);
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