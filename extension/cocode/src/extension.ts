// This method is called when your extension is deactivated
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { QuestionManager } from './questions';

import {StartSessionViewProvider, MyPanelViewProvider} from './viewproviders';
import { Session } from './types';

export function activate(context: vscode.ExtensionContext) {
  console.log("CoCode started");

  const previousId = context.workspaceState.get("cocodeSessionId", null);
  vscode.commands.executeCommand('setContext', 'cocode.showRejoin', previousId !== null); 
  
    
  const startSessionProvider = new StartSessionViewProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('cocodeCreateSession', startSessionProvider)
  );


  const htmlPath = path.join(context.extensionPath, 'media', 'view.html');
  const provider = new MyPanelViewProvider(htmlPath);

  const questionManager = new QuestionManager(provider, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cocodeAnswers', provider)
  )

  let joinSession = async (sessionId: number, sessionCode: number) => {
    
    // store the session id in workspace state
    await vscode.commands.executeCommand('setContext', 'cocode.inSession', true);
    await context.workspaceState.update("cocodeSessionId", sessionId);
    await context.workspaceState.update("cocodeSessionCode", sessionCode);
    
    provider.updateLabel(`Joining session with code: ${sessionCode}`);
    
  };

  // register command to rejoin previous session
  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.rejoinSession', () => {
      const sessionId = context.workspaceState.get("cocodeSessionId", null);
      const sessionCode = context.workspaceState.get("cocodeSessionCode", null);



      if (sessionId && sessionCode) {
        joinSession(sessionId, sessionCode);
      } else {
        vscode.window.showErrorMessage("No previous session found.");
      }
    })
  );
  
  // register command to start a new  session
  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.startSession', async () => {
      // call end point to get code, and sessionid
      const result = await fetch('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const { id: sessionId, code: sessionCode } = await result.json() as Session;
      console.log(sessionId, sessionCode);
      joinSession(sessionId, sessionCode);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.postQuestion', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage('No active file.');
        return;
      }

      await questionManager.startQuestion(editor);

    })
  );

}

export function deactivate() {}