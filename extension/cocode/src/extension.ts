import * as dotenv from "dotenv";
import * as path from "path";
// This method is called when your extension is deactivated
import * as vscode from "vscode";

import { Answer, Question, QuestionPostResult, Session } from "./types";

import { AnswerViewProvider } from "./providers/answer-provider";
import { QuestionManager } from "./questions";
import { StartSessionViewProvider } from "./providers/start-provider";
import { supabase } from "./supabase";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Fetch base url from env var
const baseUrl = process.env.COCODE_API_BASE_URL || "http://localhost:3000";

export async function activate(context: vscode.ExtensionContext) {
  console.log("CoCode started");

  const previousId = context.workspaceState.get("cocodeSessionId", null);
  const previousCode = context.workspaceState.get("cocodeSessionCode", null);

  const oldSessionExists = previousId !== null && previousCode !== null;
  vscode.commands.executeCommand(
    "setContext",
    "cocode.showRejoin",
    oldSessionExists,
  );

  const startViewPath = path.join(
    context.extensionPath,
    "media",
    "startView.html",
  );
  const startSessionProvider = new StartSessionViewProvider(
    startViewPath,
    oldSessionExists ? previousCode : null,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "cocodeCreateSession",
      startSessionProvider,
    ),
  );

  const answerViewPath = path.join(
    context.extensionPath,
    "media",
    "answerView.html",
  );

  let answers: Answer[] = [];
  const onChooseAnswerInPanel = (id: number | null) => {
    if (id === null) {
      questionManager.chooseAnswer(null);
      return;
    }

    const idx = answers.findIndex((a) => a.id == id);
    if (idx === -1) {
      vscode.window.showErrorMessage(`Answer with id ${id} doesn't exist.`);
      return;
    }
    const answer = answers[idx]
    //vscode.window.showInformationMessage(`Chose answer ${answer}`);
    questionManager.chooseAnswer(answer)
  }


  const provider = new AnswerViewProvider(answerViewPath, context.extensionUri, onChooseAnswerInPanel);
  const apiPostQuestion = async (question: Omit<Question, "id">) => {
    const sessionId = context.workspaceState.get("cocodeSessionId", null);
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(question),
    });
    return (await res.json()) as QuestionPostResult;
  };

  const questionManager = new QuestionManager(apiPostQuestion);

  const apiPollAnswers = async () => {
    const sessionId = context.workspaceState.get("cocodeSessionId", null);
    const questionId = questionManager.getActiveQuestionId();

    if (!sessionId || !questionId) {
      return;
    }

    const result = await fetch(
      `${baseUrl}/api/sessions/${sessionId}/questions/${questionId}/answers`,
    );
    answers = (await result.json()) as Answer[];

    provider.updateAnswers(answers);
  };

  const channel = supabase
    .channel("realtime-answers")
    .on(
      "postgres_changes",
      {
        event: "*", // Listen for INSERTs, UPDATEs, or DELETEs
        schema: "public",
        table: "Answer",
      },
      async () => {
        console.log("Answer table updated");
        await apiPollAnswers();
      },
    )
    .subscribe();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("cocodeAnswers", provider),
  );
  let sessionJoined = false; // FIX: do better
  let joinSession = async (sessionId: number, sessionCode: number) => {
    sessionJoined = true;

    // store the session id in workspace state
    await vscode.commands.executeCommand(
      "setContext",
      "cocode.inSession",
      true,
    );
    await context.workspaceState.update("cocodeSessionId", sessionId);
    await context.workspaceState.update("cocodeSessionCode", sessionCode);

    provider.updateSessionCode(sessionCode);
    provider.updateAnswers([])
  };

  // register command to rejoin previous session
  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.rejoinSession", () => {
      const sessionId = context.workspaceState.get("cocodeSessionId", null);
      const sessionCode = context.workspaceState.get("cocodeSessionCode", null);

      if (sessionId && sessionCode) {
        joinSession(sessionId, sessionCode);
      } else {
        vscode.window.showErrorMessage("No previous session found.");
      }
    }),
  );

  // register command to start a new  session
  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.startSession", async () => {
      // call end point to get code, and sessionid
      const result = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const { id: sessionId, code: sessionCode } =
        (await result.json()) as Session;
      console.log(sessionId, sessionCode);
      joinSession(sessionId, sessionCode);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.postQuestion", async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("No active file.");
        return;
      }

      if (!sessionJoined) {
        vscode.window.showWarningMessage("No active session");
        return;
      }

      if (questionManager.getActiveQuestionId() !== null) {
        vscode.window.showWarningMessage(
          "There is an active unanswered question",
        );
        return;
      }

      await questionManager.startQuestion(editor);
      provider.updateQuestionId(questionManager.getActiveQuestionId());
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.closeQuestion', async () => {
      if (!sessionJoined) {
        vscode.window.showWarningMessage('No active session')
        return;
      }
 
      if (questionManager.getActiveQuestionId() === null) {
        vscode.window.showWarningMessage('No active question to end.')
        return;
      }

      questionManager.endQuestion()
      answers = [];
      provider.updateQuestionId(questionManager.getActiveQuestionId())
      provider.updateAnswers([]);
    })
  );

}

export function deactivate() {}
