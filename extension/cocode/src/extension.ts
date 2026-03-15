import * as dotenv from "dotenv";
import * as path from "path";
import * as vscode from "vscode";

import { Answer, Question, QuestionPostResult, Session } from "./types";

import { ViewProvider } from "./providers/view-provider";
import { QuestionManager } from "./questions";
import { supabase } from "./supabase";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Fetch base url from env var
const baseUrl = vscode.workspace.getConfiguration("cocode").get("serverUrl", "https://cocode.kasperskov.dev");

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


  let answers: Answer[] = [];
  const onChooseAnswerInPanel = (id: number | null) => {
    if (id === null) {
      questionManager.chooseAnswer(null);
      return;
    }

    const idx = answers.findIndex((a) => a.id === id);
    if (idx === -1) {
      vscode.window.showErrorMessage(`Answer with id ${id} doesn't exist.`);
      return;
    }
    const answer = answers[idx]
    //vscode.window.showInformationMessage(`Chose answer ${answer}`);
    questionManager.chooseAnswer(answer)
  };


  const viewPath = path.join(
    context.extensionPath,
    "media",
    "view.html",
  );

  const sidepanelViewProvider = new ViewProvider(
    viewPath,
    oldSessionExists && previousCode || null, 
    context.extensionUri,
    onChooseAnswerInPanel,
    baseUrl
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "cocodeSidepanelView",
      sidepanelViewProvider
    ),
  );

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
    const question = questionManager.getActiveQuestion();

    if (!sessionId || !question) {
      return;
    }

    const result = await fetch(
      `${baseUrl}/api/sessions/${sessionId}/questions/${question.id}/answers`,
    );
    answers = (await result.json()) as Answer[];

    sidepanelViewProvider.updateAnswers(answers);
  };

  const _ = supabase
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

    sidepanelViewProvider.updateSessionCode(sessionCode);
    sidepanelViewProvider.updateAnswers([]);
    sidepanelViewProvider.showAnswerPage()
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

      if (questionManager.getActiveQuestion()) {
        vscode.window.showWarningMessage(
          "There is an active unanswered question",
        );
        return;
      }

      await questionManager.startQuestion(editor);
      sidepanelViewProvider.updateQuestion(questionManager.getActiveQuestion());
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.acceptSuggestion', async () => {
      if (!sessionJoined) {
        vscode.window.showWarningMessage('No active session');
        return;
      }
      if (sidepanelViewProvider.getChosenAnswerId() === null) {
        vscode.window.showWarningMessage('No suggestion chosen');
        return;
      }

      questionManager.endQuestion();
      answers = [];
      sidepanelViewProvider.updateQuestion(null);
      sidepanelViewProvider.updateAnswers([]);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.rejectSuggestions', async () => {
      if (!sessionJoined) {
        vscode.window.showWarningMessage('No active session');
        return;
      }
      await questionManager.chooseAnswer(null);
      questionManager.endQuestion();
      answers = [];
      sidepanelViewProvider.updateQuestion(null);
      sidepanelViewProvider.updateAnswers([]);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.deleteSuggestion', async (id: number) => {
      if (!sessionJoined) {
        vscode.window.showWarningMessage('No active session');
        return;
      }

      const sessionId = context.workspaceState.get("cocodeSessionId", null);
      const questionId = questionManager.getActiveQuestion()?.id;

      if (!sessionId) {
        vscode.window.showWarningMessage('No session id')
        return
      }

      if (!questionId) {
        vscode.window.showWarningMessage('No active question')
        return;
      }

      await fetch(`${baseUrl}/api/sessions/${sessionId}/questions/${questionId}/answers/${id}`, {
        method: "DELETE"
      });
    })
  );
}

export function deactivate() {}
