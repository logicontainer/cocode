import { Answer } from "../src/types";
import { State } from "../src/statemachine"

declare const COCODE_BASE_URL: string
declare const acquireVsCodeApi: () => { postMessage: (_: any) => void }
declare const hljs: { highlightAll: () => void }

function showPage(pageId: string) {
  document.getElementById('setup-page')?.classList.toggle('visible', pageId === 'setup-page');
  document.getElementById('answer-page')?.classList.toggle('visible', pageId === 'answer-page');
}
const vscode = acquireVsCodeApi();

function debug(msg: string) {
  vscode.postMessage({ command: 'debug', msg })
}

let suggestionsVisible = false;

const buttonListeners: { [K in string]: (btn: HTMLButtonElement) => void } = {
'#start-session-btn': () => vscode.postMessage({ command: 'StartSession' }),
'#rejoin-session-btn': () => vscode.postMessage({ command: 'RejoinSession' }),
'.divider': () => vscode.postMessage( { command: 'updateSuggestionsVisible', visible: !suggestionsVisible }),
'#post-question-btn': () => vscode.postMessage({ command: 'postQuestion' }),
'#accept-answer-btn': () => vscode.postMessage({ command: 'acceptSuggestion' }),
'#reject-answer-btn': () => vscode.postMessage({ command: 'rejectSuggestions' }),
}

for (const [selector, func] of Object.entries(buttonListeners)) {
for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>(selector))) {
    btn.addEventListener('click', () => func(btn))
  }
}

// let chosenAnswerId: number | null = null
// let currentQuestionLanguage: string | null = null;
// updateQuestion(null, null);
//
// function updateQuestion(id: number | null, language: string | null) {
//   currentQuestionLanguage = language 
// }
//
// function updateChosenAnswer(id: number | null) {
//   chosenAnswerId = id;
//   const answerElements = document.querySelectorAll('.answer');
//   answerElements.forEach(elm => {
//     if (chosenAnswerId !== null && elm.id === `answer-${chosenAnswerId}`) {
//       elm.classList.add('chosen');
//     } else {
//       elm.classList.remove('chosen');
//     }
//   });
//   document.querySelector<HTMLButtonElement>('#accept-answer-btn')!.disabled = chosenAnswerId === null
// }
//
//

function chooseAnswer(id: number | null) { vscode.postMessage({ command: 'chooseAnswer', id }) }

function disableStartSessionButton() {
  const btn = document.getElementById('start-session-btn')!;
  btn.classList.add('loading');
  btn.textContent = "Loading...";
}

function enableStartSessionButton() {
  const btn = document.getElementById('start-session-btn')!;
  btn.classList.remove('loading');
  btn.textContent = "Create session";
}

function enablePostQuestionButton() {
  const btn = document.getElementById('post-question-btn')!;
  btn.classList.remove('loading');
  btn.textContent = "Collaborate on selection";
}

function disablePostQuestionButton() {
  const btn = document.getElementById('post-question-btn')!;
  btn.classList.add('loading');
  btn.textContent = "Loading...";
}



function setSessionCodeValue(code: number | null) {
  const element = document.querySelector<HTMLLinkElement>('#session-code-value')!;
  element.textContent = code?.toString() ?? "NULL";
  element.href = `${COCODE_BASE_URL}/answer?code=${code}`;
}


window.addEventListener('message', (event) => {
  const { command, ...data } = event.data

  const startSessionBtn = document.getElementById('start-session-btn')!;
  const postQuestionBtn = document.getElementById('post-question-btn')!;
  if (command === 'updateState') {
    const state = data.state as State

    // CLEAN up
    document.querySelector<HTMLButtonElement>('#post-question-btn')!.disabled = true
    document.querySelector<HTMLButtonElement>('#accept-answer-btn')!.disabled = true
    document.querySelector<HTMLButtonElement>('#reject-answer-btn')!.disabled = true
    document.querySelector<HTMLHeadingElement>('#answers-header')!.hidden = true

    switch (state.enum) {
      case 'no session':
        showPage('setup-page');
        enableStartSessionButton();
        disablePostQuestionButton();

        if (state.rejoinableSession !== null) {
          document.getElementById('rejoinable-session-code')!.style.display = 'block';
          document.getElementById('rejoinable-session-code-value')!.textContent = state.rejoinableSession.code.toString();
        }

        break;

      case 'creating session':
        showPage('setup-page');
        disablePostQuestionButton();
        disableStartSessionButton();
        break

      case 'in session, idle':
        showPage('answer-page');
        document.querySelector<HTMLButtonElement>('#post-question-btn')!.disabled = false
        setSessionCodeValue(state.session.code)
        disableStartSessionButton();
        enablePostQuestionButton();
        break;

      case 'in session, taking suggestions':
        showPage('answer-page');
        setSessionCodeValue(state.session.code)
        disableStartSessionButton();
        disablePostQuestionButton();

        document.querySelector<HTMLButtonElement>('#accept-answer-btn')!.disabled = state.selectedSuggestionId !== null
        document.querySelector<HTMLButtonElement>('#reject-answer-btn')!.disabled = false
        document.querySelector<HTMLHeadingElement>('#answers-header')!.hidden = false

        const trimAnswer = (text: string) => {
          const lines = text.split('\n')
          const minMargin = lines.map(l => l.length - l.trimStart().length)
                                 .reduce((a, b) => Math.min(a, b))
          return lines.map(l => l.substring(minMargin)).join("\n")
        }

        const elements = state.suggestions.map(answer => {
          const elm: HTMLElement = document.querySelector<HTMLTemplateElement>('#answer-template')!.content.firstElementChild!.cloneNode(true) as HTMLElement
          elm.id = `answer-${answer.id}`
          const codeElement = elm.querySelector('.answer-code')!;
          codeElement.textContent = trimAnswer(answer.text);
          codeElement.classList.add(`language-${state.question.language}`);
          elm.addEventListener('click', () => chooseAnswer(answer.id))
          elm.querySelector('.answer-delete-icon')!.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent triggering the chooseAnswer event
            vscode.postMessage({ command: 'deleteSuggestion', id: answer.id })
          })
          return elm
        })

        const container = document.querySelector('#answer-container')!
        container.innerHTML = ""
        elements.forEach(elm => container.appendChild(elm))
        hljs.highlightAll();

        const answerCountElement = document.getElementById('answer-count')!;
        answerCountElement.textContent = data.answers.length.toString();

        break;
    }

  } else {
    debug(`Unknown command ${command}`)
  }
  //   case 'updateSuggestionsVisible':
  //     const eyeElm = document.getElementById('eye-icon')!;
  //     suggestionsVisible = data.visible;
  //     document.getElementById('answer-container')!
  //             .style.display = suggestionsVisible ? 'flex' : 'none';
  //     if (suggestionsVisible) {
  //       eyeElm.classList.remove('codicon-eye-closed');
  //       eyeElm.classList.add('codicon-eye');
  //     } else {
  //       eyeElm.classList.remove('codicon-eye');
  //       eyeElm.classList.add('codicon-eye-closed');
  //     }
  //     break;
});


vscode.postMessage({ command: 'requestUIUpdate' })
