import { Answer, Question, Session } from './types';

export type InSessionStates = { 
  session: Session
} & (
  | { enum: 'in session, idle' }
  | { 
    enum: 'in session, loading question',
    question: Omit<Question, "id">
  }
  | { 
    enum: 'in session, taking suggestions',

    question: Question;
    suggestions: Answer[];
    deletedSuggestionIds: Answer["id"][];

    selectedSuggestionId: Answer['id'] | null;
  }
)

export type State = (
  | { enum: 'no session', rejoinableSession: Session | null }
  | { enum: 'creating session' }
  | InSessionStates
)

type StateEnum = State['enum']

type Transition = (
  | { enum: 'EDITOR: create session' }
  | { enum: 'EDITOR: rejoin session' }
  | { 
    enum: 'SERVER: session created',
    session: Session
  }
  | { 
    enum: 'EDITOR: pose question',
    question: Omit<Question, 'id'>
  }
  | {
    enum: 'SERVER: question loaded',
    questionId: Question["id"]
  }
  | {
    enum: 'SERVER: suggestions updated',
    suggestions: Answer[],
  }
  | {
    enum: 'EDITOR: select suggestion',
    suggId: Answer['id'] | null // selecting null means unselecting
  }
  | {
    enum: 'EDITOR: delete suggestion',
    suggId: Answer["id"]
  }
  | {
    enum: 'EDITOR: modify question',
    newQuestion: Omit<Question, "id">,
  }
  | {
    enum: 'EDITOR: accept selected suggestion'
  }
  | {
    enum: 'EDITOR: reject suggestions'
  }
)

type TransitionEnum = Transition['enum']

type FuncForStateAndTransition<
  S extends StateEnum,
  T extends TransitionEnum,
> = 
  ((state: State & { enum: S }, t: Transition & { enum: T }) => State)

type StateMachine = {
  [S in StateEnum]: {
    [T in TransitionEnum]?: FuncForStateAndTransition<S, T>;
  };
};

// const apiCreateSession = async () => {
//   const response = await fetch("https://localhost:3000/api/sessions", { method: "POST" })
//   const json = await response.json();
//   return json as Session;
// }
//
// const apiPoseQuestion = async (sessionId: Session["id"], question: Omit<Question, "id">) => {
//   const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}/questions`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json", },
//     body: JSON.stringify(question),
//   });
//   const { id } = (await res.json()) as QuestionPostResult;
//   return { ...question, id } satisfies Question
// }

export function isInSession(state: State) {
  return state.enum.includes('in session')
}

export function isTakingSuggestions(state: State) {
  return state.enum === "in session, taking suggestions"
}

export interface StateMachineObserver {
  onStateUpdate: (state: State) => void
}

export class StateMachineHandler {
  private onCreateSession: () => void
  private onPoseQuestion: (sessionId: Session["id"], question: Omit<Question, "id">) => void
  private onDeleteSuggestion: (sessionId: Session["id"], questionId: Question["id"], suggId: Answer["id"]) => void

  private state_: State
  private observers: StateMachineObserver[]

  constructor(
    initialState: State,
    // this should be a strategy pattern
    onCreateSession: () => void, 
    onPoseQuestion: (sessionId: Session["id"], question: Omit<Question, "id">) => void,
    onDeleteSuggestion: (sessionId: Session["id"], questionId: Question["id"], suggId: Answer["id"]) => void,
  ) {
    this.state_ = initialState
    this.onCreateSession = onCreateSession;
    this.onPoseQuestion = onPoseQuestion;
    this.onDeleteSuggestion = onDeleteSuggestion
    this.observers = [];
  }

  attach(observer: StateMachineObserver) {
    this.observers.push(observer)
  }

  private notifyStateUpdate() {
    this.observers.forEach(obs => obs.onStateUpdate(this.state_))
  }

  forceUpdate() { return this.notifyStateUpdate() }

  editorCreateSession() { this.doTransition({ enum: 'EDITOR: create session' }) }
  editorRejoinSession(session: Session) { this.doTransition({ enum: 'EDITOR: rejoin session' }) }
  editorPoseQuestion(question: Omit<Question, "id">) { this.doTransition({ enum: 'EDITOR: pose question', question }) }
  editorModifyQuestion(question: Omit<Question, "id">) { this.doTransition({ enum: 'EDITOR: modify question', newQuestion: question })}
  editorSelectSuggestion(suggId: Answer["id"] | null) { this.doTransition({ enum: 'EDITOR: select suggestion', suggId }) }
  editorAcceptSelectedSuggestion() { this.doTransition({ enum: 'EDITOR: accept selected suggestion' }) }
  editorRejectSuggestions() { this.doTransition({ enum: 'EDITOR: reject suggestions' }) }
  editorDeleteSuggestion(suggId: Answer["id"]) { this.doTransition({ enum: 'EDITOR: delete suggestion', suggId }) }

  handleServerQuestionLoaded(questionId: Question["id"]) { this.doTransition({ enum: 'SERVER: question loaded', questionId }) }
  handleServerSessionCreated(session: Session) { this.doTransition({ enum: 'SERVER: session created', session }) }
  handleServerSuggestionsUpdated(suggestions: Answer[]) { this.doTransition({ enum: 'SERVER: suggestions updated', suggestions }) }

  private doTransition (transition: Transition) {
    const stateMachine: StateMachine = {
      'no session': {
        'EDITOR: create session': () => {
          this.onCreateSession();
          return { enum: 'creating session' }
        },
        'EDITOR: rejoin session': (state, _) => {
          if (!state.rejoinableSession) {
            console.error("No rejoinable session")
            return state;
          }

          return {
            enum: 'in session, idle',
            session: state.rejoinableSession,
          }
        }
      },

      'creating session': {
        'SERVER: session created': (_, { session }) => {
          return {
            enum: 'in session, idle',
            session
          }
        }
      },

      'in session, idle': {
        'EDITOR: pose question': (state, { question }) => {
          this.onPoseQuestion(state.session.id, question)
          return {
            ...state,
            enum: 'in session, loading question',
            question,
          }
        },
      },

      'in session, loading question': {
        'SERVER: question loaded': (state, { questionId }) => {
          return {
            ...state,
            enum: 'in session, taking suggestions',
            suggestions: [],
            deletedSuggestionIds: [],
            selectedSuggestionId: null,
            question: { ...state.question, id: questionId }
          }
        }
      },

      'in session, taking suggestions': {
        'SERVER: suggestions updated': (state, { suggestions }) => {
          const effectiveSuggestions = suggestions.filter(sugg => !state.deletedSuggestionIds.includes(sugg.id))
          const selectedGone = !effectiveSuggestions.some(sugg => sugg.id === state.selectedSuggestionId)
          return {
            ...state,
            suggestions: effectiveSuggestions,
            selectedSuggestionId: selectedGone ? null : state.selectedSuggestionId
          };
        },

        'EDITOR: modify question': (state, { newQuestion }) => {
          return { 
            ...state, 
            question: { ...newQuestion, id: state.question.id }
          }
        },

        'EDITOR: select suggestion': (state, trans) => {
          return {
            ...state,
            selectedSuggestionId: trans.suggId
          };
        },

        'EDITOR: delete suggestion': (state, { suggId }) => {
          this.onDeleteSuggestion(state.session.id, state.question.id, suggId)
          return {
            ...state,
            deletedSuggestionIds: [suggId, ...state.deletedSuggestionIds],
          }
        },

        'EDITOR: accept selected suggestion': (state, _) => {
          return {
            ...state,
            enum: 'in session, idle'
          };
        },

        'EDITOR: reject suggestions': (state, _) => {
          return { ...state, enum: 'in session, idle' }
        },
      }
    }

    const func = stateMachine[this.state_.enum]?.[transition.enum] as | FuncForStateAndTransition<typeof this.state_.enum, typeof transition.enum> | undefined;
    if (!func) {
      console.warn(`Transition undefined for ${this.state_} + ${transition}`)
      return;
    }

    const prevState = this.state_
    this.state_ = func(this.state_, transition)
    console.log(prevState, "+", transition, " -> ", this.state_)

    this.notifyStateUpdate()
  }

  currentState() { return this.state_ }
}
