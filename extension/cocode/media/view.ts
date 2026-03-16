import { Answer } from "../src/types";

declare const COCODE_BASE_URL: string;
declare const acquireVsCodeApi: () => { postMessage: (_: any) => void };
declare const hljs: { highlightAll: () => void };

function showPage(pageId: string) {
  document
    .getElementById("setup-page")
    ?.classList.toggle("visible", pageId === "setup-page");
  document
    .getElementById("answer-page")
    ?.classList.toggle("visible", pageId === "answer-page");
}
const vscode = acquireVsCodeApi();

function debug(msg: string) {
  vscode.postMessage({ command: "debug", msg });
}

let suggestionsVisible = false;

const buttonListeners: { [K in string]: (btn: HTMLButtonElement) => void } = {
  "#start-session-btn": (btn) => {
    btn.classList.add("loading");
    btn.textContent = "Loading...";
    vscode.postMessage({ command: "StartSession" });
  },
  "#rejoin-session-btn": () => vscode.postMessage({ command: "RejoinSession" }),
  ".divider": () =>
    vscode.postMessage({
      command: "updateSuggestionsVisible",
      visible: !suggestionsVisible,
    }),
  "#post-question-btn": (btn) => {
    vscode.postMessage({ command: "postQuestion" });
    btn.classList.add("loading");
    btn.textContent = "Loading...";
  },
  "#accept-answer-btn": () =>
    vscode.postMessage({ command: "acceptSuggestion" }),
  "#reject-answer-btn": () =>
    vscode.postMessage({ command: "rejectSuggestions" }),
};

for (const [selector, func] of Object.entries(buttonListeners)) {
  for (const btn of Array.from(
    document.querySelectorAll<HTMLButtonElement>(selector),
  )) {
    btn.addEventListener("click", () => func(btn));
  }
}

let chosenAnswerId: string | null = null;
let currentQuestionLanguage: string | null = null;
updateQuestion(null, null);

function updateQuestion(id: string | null, language: string | null) {
  currentQuestionLanguage = language;
  document.querySelector<HTMLButtonElement>("#post-question-btn")!.disabled =
    id !== null;
  document.querySelector<HTMLButtonElement>("#accept-answer-btn")!.disabled =
    id === null || chosenAnswerId === null;
  document.querySelector<HTMLButtonElement>("#reject-answer-btn")!.disabled =
    id === null;
  document.querySelector<HTMLHeadingElement>("#answers-header")!.hidden =
    id === null;
}

function updateChosenAnswer(id: string | null) {
  chosenAnswerId = id;
  const answerElements = document.querySelectorAll(".answer");
  answerElements.forEach((elm) => {
    if (chosenAnswerId !== null && elm.id === `answer-${chosenAnswerId}`) {
      elm.classList.add("chosen");
    } else {
      elm.classList.remove("chosen");
    }
  });
  document.querySelector<HTMLButtonElement>("#accept-answer-btn")!.disabled =
    chosenAnswerId === null;
}

function chooseAnswer(id: string | null) {
  if (chosenAnswerId === id) {
    id = null; // unselect if clicking the already chosen answer
  }
  updateChosenAnswer(id);
  vscode.postMessage({ command: "chooseAnswer", id });
}

window.addEventListener("message", (event) => {
  const { command, ...data } = event.data;

  switch (command) {
    case "showStartSessionPage":
      showPage("setup-page");
      break;

    case "showAnswerPage":
      showPage("answer-page");
      break;

    case "setRejoinableSessionCode":
      document.getElementById("rejoinable-session-code")!.style.display =
        "block";
      document.getElementById("rejoinable-session-code-value")!.textContent =
        data.code;
      break;

    case "setSessionCode":
      const element = document.querySelector<HTMLLinkElement>(
        "#session-code-value",
      )!;
      element.textContent = data.code;
      element.href = `${COCODE_BASE_URL}/answer?code=${data.code}`;
      break;

    case "updateQuestion":
      updateQuestion(data.id, data.language);
      break;

    case "updateSuggestionsVisible":
      const eyeElm = document.getElementById("eye-icon")!;
      suggestionsVisible = data.visible;
      document.getElementById("answer-container")!.style.display =
        suggestionsVisible ? "flex" : "none";
      if (suggestionsVisible) {
        eyeElm.classList.remove("codicon-eye-closed");
        eyeElm.classList.add("codicon-eye");
      } else {
        eyeElm.classList.remove("codicon-eye");
        eyeElm.classList.add("codicon-eye-closed");
      }
      break;

    case "updateAnswers":
      const trimAnswer = (text: string) => {
        const lines = text.split("\n");
        const minMargin = lines
          .map((l) => l.length - l.trimStart().length)
          .reduce((a, b) => Math.min(a, b));
        return lines.map((l) => l.substring(minMargin)).join("\n");
      };

      const elements = (data.answers as Answer[]).map((answer) => {
        const elm: HTMLElement = document
          .querySelector<HTMLTemplateElement>("#answer-template")!
          .content.firstElementChild!.cloneNode(true) as HTMLElement;
        elm.id = `answer-${answer.id}`;
        const codeElement = elm.querySelector(".answer-code")!;
        codeElement.textContent = trimAnswer(answer.text);
        codeElement.classList.add(`language-${currentQuestionLanguage}`);
        elm.addEventListener("click", () => chooseAnswer(answer.id));
        elm
          .querySelector(".answer-delete-icon")!
          .addEventListener("click", (e) => {
            e.stopPropagation(); // prevent triggering the chooseAnswer event
            vscode.postMessage({ command: "deleteSuggestion", id: answer.id });
          });
        return elm;
      });

      const container = document.querySelector("#answer-container")!;
      container.innerHTML = "";
      elements.forEach((elm) => container.appendChild(elm));
      updateChosenAnswer(data.chosenAnswerId);
      hljs.highlightAll();

      const answerCountElement = document.getElementById("answer-count")!;
      answerCountElement.textContent = data.answers.length.toString();

      break;

    case "enablePostQuestionButton":
      const postQuestionBtn = document.getElementById("post-question-btn")!;
      postQuestionBtn.classList.remove("loading");
      postQuestionBtn.textContent = "Collaborate on selection";
      break;

    case "enableStartSessionButton":
      const startSessionBtn = document.getElementById("start-session-btn")!;
      startSessionBtn.classList.remove("loading");
      startSessionBtn.textContent = "Create Session";
      break;
  }
});
