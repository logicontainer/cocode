import * as vscode from 'vscode';
import * as fs from 'fs';

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