// This method is called when your extension is deactivated
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { QuestionManager } from './questions';

import { StartSessionViewProvider } from './providers/start-provider';
import { AnswerViewProvider } from './providers/answer-provider';
import { Answer, Question, QuestionPostResult, Session } from './types';

const ANSWER_POLL_TIMEOUT = 5000;

export function activate(context: vscode.ExtensionContext) {
  console.log("CoCode started");

  const previousId = context.workspaceState.get("cocodeSessionId", null);
  const previousCode = context.workspaceState.get("cocodeSessionCode", null);

  const oldSessionExists = previousId !== null && previousCode !== null;
  vscode.commands.executeCommand('setContext', 'cocode.showRejoin', oldSessionExists); 

  const startViewPath = path.join(context.extensionPath, 'media', 'startView.html');
  const startSessionProvider = new StartSessionViewProvider(startViewPath, oldSessionExists ? previousCode : null);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cocodeCreateSession', startSessionProvider)
  );

  const answerViewPath = path.join(context.extensionPath, 'media', 'answerView.html');

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

  const provider = new AnswerViewProvider(answerViewPath, context.extensionUri, onChooseAnswerInPanel);
  const apiPostQuestion = async (question: Omit<Question, "id">) => {
    const sessionId = context.workspaceState.get("cocodeSessionId", null);
    const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}/questions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(question)
    });
    return (await res.json()) as QuestionPostResult
  }
  
  const questionManager = new QuestionManager(apiPostQuestion);

  const apiPollAnswers = async () => {
    const sessionId = context.workspaceState.get("cocodeSessionId", null);
    const questionId = questionManager.getActiveQuestionId()

    if (!sessionId || !questionId) {
      return
    }

    const result = await fetch(`http://localhost:3000/api/sessions/${sessionId}/questions/${questionId}/answers`);
    answers = (await result.json()) as Answer[] 

    provider.updateAnswers(answers)
  }
  
  setInterval(apiPollAnswers, ANSWER_POLL_TIMEOUT)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cocodeAnswers', provider)
  )

  let joinSession = async (sessionId: number, sessionCode: number) => {
    
    // store the session id in workspace state
    await vscode.commands.executeCommand('setContext', 'cocode.inSession', true);
    await context.workspaceState.update("cocodeSessionId", sessionId);
    await context.workspaceState.update("cocodeSessionCode", sessionCode);
    
    provider.updateSessionCode(sessionCode);
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