// This method is called when your extension is deactivated
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { QuestionManager } from './questions';

import {StartSessionViewProvider, MyPanelViewProvider} from './viewproviders';
import { Answer, Session } from './types';

const ANSWER_POLL_TIMEOUT = 5000;

export function activate(context: vscode.ExtensionContext) {
  console.log("CoCode started");

  const previousId = context.workspaceState.get("cocodeSessionId", null);
  vscode.commands.executeCommand('setContext', 'cocode.showRejoin', previousId !== null); 
  
  const startSessionProvider = new StartSessionViewProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('cocodeCreateSession', startSessionProvider)
  );

  const htmlPath = path.join(context.extensionPath, 'media', 'view.html');


  let answers: Answer[] = []
  const onChooseAnswerInPanel = (id: number) => {
    const idx = answers.findIndex(a => a.id == id)
    if (idx === -1) {
      vscode.window.showErrorMessage(`Answer with id ${id} doesn't exist.`);
      return
    }
    const answer = answers[idx]
    vscode.window.showInformationMessage(`Chose answer ${answer}`);
    questionManager.chooseAnswer(answer)
  }

  const provider = new MyPanelViewProvider(htmlPath, context.extensionUri, onChooseAnswerInPanel);
  const questionManager = new QuestionManager(provider, context);


  const pollAnswers = async () => {
    const sessionId = await context.workspaceState.get("cocodeSessionId", null);
    const questionId = questionManager.getActiveQuestionId()

    if (!sessionId || !questionId) {
      return
    }

    const result = await fetch(`http://localhost:3000/api/sessions/${sessionId}/questions/${questionId}/answers`);
    answers = (await result.json()) as Answer[] 

    provider.updateAnswers(answers)
  }
  setInterval(pollAnswers, ANSWER_POLL_TIMEOUT)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cocodeAnswers', provider)
  )

  let joinSession = async (sessionId: number, sessionCode: number) => {
    
    // store the session id in workspace state
    await vscode.commands.executeCommand('setContext', 'cocode.inSession', true);
    await context.workspaceState.update("cocodeSessionId", sessionId);
    await context.workspaceState.update("cocodeSessionCode", sessionCode);
    
    provider.updateLabel(`Joining session with code: ${sessionCode}`);
    provider.updateAnswers([])
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