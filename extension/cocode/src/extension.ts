import * as dotenv from "dotenv";
import * as path from "path";
import * as vscode from "vscode";

import { Answer, Question, QuestionPostResult, Session } from "./types";

import { ViewProvider } from "./providers/view-provider";
import { QuestionManager } from "./questions";
import { supabase } from "./supabase";
import { isInSession, isTakingSuggestions, State, StateMachineHandler } from "./statemachine";

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

  const handleCreateSession: () => void = async () => {
    // call end point to get code, and sessionid
    const result = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const session = (await result.json()) as Session;
    context.workspaceState.update("cocodeSessionId", session.id)
    context.workspaceState.update("cocodeSessionCode", session.code)
    stateMachineHandler.handleServerSessionCreated(session)
  }

  const handlePoseQuestion: (sessionId: Session["id"], question: Omit<Question, "id">) => void = async (sessionId, question) => {
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(question),
    });

    const { id } = (await res.json()) as QuestionPostResult;
    stateMachineHandler.handleServerQuestionLoaded(id)
  }

  const handleDeleteSuggestion: (sessionId: Session["id"], questionId: Question["id"], suggId: Answer["id"]) => void = 
    (sessionId, questionId, suggId) => {
      fetch(`${baseUrl}/api/sessions/${sessionId}/questions/${questionId}/answers/${suggId}`, {
        method: "DELETE"
      });
    }

  const stateMachineHandler = new StateMachineHandler(
    { enum: 'no session', rejoinableSession: (oldSessionExists ? { id: previousId, code: previousCode } : null) },
    handleCreateSession,
    handlePoseQuestion,
    handleDeleteSuggestion,
  )

  const setInSessionBool = (b: boolean) => vscode.commands.executeCommand( "setContext", "cocode.inSession", true);

  stateMachineHandler.attach({
    onStateUpdate(state) {
      setInSessionBool(isInSession(state))
      sidepanelViewProvider.updateView(state)
      if (state.enum === "in session, taking suggestions") {
        questionManager.chooseAnswer(state.suggestions.find(s => s.id === state.selectedSuggestionId) ?? null)
      }
    },
  })

  const onChooseAnswerInPanel = (id: number | null) => {
    stateMachineHandler.editorSelectSuggestion(id)
  };

  const viewHtmlPath = path.join(
    context.extensionPath,
    "media",
    "view.html",
  );

  const viewJsPath = path.join(
    context.extensionPath,
    "out",
    "media",
    "view.js"
  )

  const sidepanelViewProvider = new ViewProvider(
    viewHtmlPath,
    viewJsPath,
    context.extensionUri,
    onChooseAnswerInPanel,
    baseUrl,
    () => stateMachineHandler.forceUpdate()
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "cocodeSidepanelView",
      sidepanelViewProvider
    ),
  );

  const questionManager = new QuestionManager();

  const apiPollAnswers = async () => {
    const state = stateMachineHandler.currentState()
    if (!isTakingSuggestions(state))
      return;

    const { session, question } = state

    const result = await fetch(
      `${baseUrl}/api/sessions/${session.id}/questions/${question.id}/answers`,
    );

    stateMachineHandler.handleServerSuggestionsUpdated((await result.json()) as Answer[])
  };

  supabase.channel("realtime-answers")
    .on(
      "postgres_changes",
      {
        event: "*", // Listen for INSERTs, UPDATEs, or DELETEs
        schema: "public",
        table: "Answer",
      },
      async () => {
        await apiPollAnswers();
      },
    )
    .subscribe();

  // register command to rejoin previous session
  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.rejoinSession", () => {
      const id = context.workspaceState.get("cocodeSessionId", null);
      const code = context.workspaceState.get("cocodeSessionCode", null);
      if (!!id && !!code) {
        stateMachineHandler.editorRejoinSession({ id,code })
      } else {
        vscode.window.showErrorMessage("No previous session found.");
      }
    }),
  );

  // register command to start a new  session
  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.startSession", (callback) => {
      stateMachineHandler.editorCreateSession()
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.postQuestion", () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("No active file.");
        return;
      }

      const question = questionManager.initializeQuestionAndPrepareOrWhatever(editor);
      stateMachineHandler.editorPoseQuestion(question)
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.acceptSuggestion', () => {
      stateMachineHandler.editorAcceptSelectedSuggestion()
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.rejectSuggestions', () => {
      stateMachineHandler.editorRejectSuggestions()
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cocode.deleteSuggestion', (id: number) => {
      stateMachineHandler.editorDeleteSuggestion(id)
    })
  );
}

export function deactivate() {}
