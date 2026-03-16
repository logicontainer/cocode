import * as dotenv from "dotenv";
import * as path from "path";
import * as vscode from "vscode";

import { Answer, Question, QuestionPostResult, Session } from "./types";

import { EventSource } from "eventsource";
import { ViewProvider } from "./providers/view-provider";
import { isInSession, isTakingSuggestions, StateMachineHandler } from "./statemachine";
import { EditorHandler } from "./editor-handler";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Fetch base url from env var
const baseUrl = vscode.workspace
  .getConfiguration("cocode")
  .get("serverUrl", "https://cocode.kasperskov.dev");

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

  const stateMachineHandler = new StateMachineHandler(
    { enum: 'no session', rejoinableSession: (oldSessionExists ? { id: previousId, code: previousCode } : null) },
    {
      onCreateSession: async () => {
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
      },
      onPoseQuestion: async (sessionId, question) => {
        const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/questions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...question,
            fromLine: question.range.fromLine,
            toLine: question.range.toLine,
          }),
        });

        const { id: questionId } = (await res.json()) as QuestionPostResult;
        stateMachineHandler.handleServerQuestionLoaded(questionId)
        subscribeToAnswers(sessionId, questionId);
      },
      onDeleteSuggestion: (sessionId, questionId, suggId) => {
        fetch(`${baseUrl}/api/sessions/${sessionId}/questions/${questionId}/answers/${suggId}`, {
          method: "DELETE"
        });
      },
    }
  )

  const setInSessionBool = (b: boolean) => vscode.commands.executeCommand("setContext", "cocode.inSession", b);
  stateMachineHandler.attach({
    onStateUpdate: state => {
      setInSessionBool(isInSession(state))
      sidepanelViewProvider.updateView(state)
      editorHandler?.updateEditor(state)
    },
  })

  const onChooseAnswerInPanel = (id: Answer["id"] | null) => {
    stateMachineHandler.editorSelectSuggestion(id)
  };


  const viewHtmlPath = path.join(context.extensionPath, "media", "view.html");

  const viewJsPath = path.join(
    context.extensionPath,
    "out",
    "media",
    "view.js",
  );

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
      sidepanelViewProvider,
    ),
  );

  let editorHandler: EditorHandler | null = null

  const apiPollAnswers = async () => {
    const state = stateMachineHandler.currentState()
    if (!isTakingSuggestions(state))
      return;

    const { session, question } = state

    const res = await fetch(`${baseUrl}/api/sessions/${session.id}/questions/${question.id}/answers`)
    const answers: Answer[] = (await res.json()) as Answer[]
    stateMachineHandler.handleServerSuggestionsUpdated(answers)
  };

  function subscribeToAnswers(sid: string, qid: string) {
    const url = `${baseUrl}/api/events/sessions/${sid}/questions/${qid}/answers`;
    const sse = new EventSource(url);
    // Listen for the custom 'answer-to-question' event we defined in our Next.js stream
    const eventId = `answer-to-question:${qid}`;
    sse.addEventListener(eventId, async _ => {
      apiPollAnswers().catch((err) => {
        console.error(err);
      });
    });
  }

  // register command to rejoin previous session
  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.rejoinSession", () => {
      stateMachineHandler.editorRejoinSession()
    }),
  );

  // register command to start a new  session
  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.startSession", () => {
      stateMachineHandler.editorCreateSession()
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cocode.postQuestion", () => {
      const editor = vscode.window.activeTextEditor;
      const state = stateMachineHandler.currentState()

      if (!isInSession(state)) {
        vscode.window.showWarningMessage("No active session.");
        return;
      }

      if (!editor) {
        vscode.window.showWarningMessage("No active file.");
        return;
      }

      editorHandler = new EditorHandler(editor)

      const range = editorHandler.getSelectedRange()
      if (!range) {
        console.assert(false, "This should be impossible")
        return;
      }

      const question = {
        range: range,
        content: editorHandler.getFullEditorContent(),
        language: editor.document.languageId,
      } satisfies Omit<Question, "id">

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
    vscode.commands.registerCommand('cocode.deleteSuggestion', (id: Answer["id"]) => {
      stateMachineHandler.editorDeleteSuggestion(id)
    })
  );
}

export function deactivate() { }
