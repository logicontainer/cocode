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
    enum: 'EDITOR: end session'
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

type MachineBase = Record<StateEnum, any>

type ValidMachine<M extends MachineBase> = {
  [S in StateEnum]: {
    [T in keyof M[S]]: T extends TransitionEnum ? FuncForStateAndTransition<S, T> : never
  }
}

type RemainingMachine<M extends MachineBase> = {
  [S in StateEnum]: {
    [T in Exclude<TransitionEnum, keyof M[S]>]: FuncForStateAndTransition<S, T>
  }
}

function createStateMachine<M extends MachineBase>(
  machine: M & ValidMachine<M>
) {
  return machine;
}

function completeMachine<M extends MachineBase>(
  machine: M & ValidMachine<M>,
  remainder: RemainingMachine<M>
): StateMachine {
  let fullMachine = {}
  const stateEnums: readonly StateEnum[] = Object.keys(machine) as readonly StateEnum[]
  for (const s of stateEnums) {
    fullMachine = {
      ...fullMachine,
      [s]: {
        ...machine[s],
        ...remainder[s]
      }
    }
  }
  return fullMachine as M & RemainingMachine<M>
}

type StateMachine = {
  [S in StateEnum]: {
    [T in TransitionEnum]: FuncForStateAndTransition<S, T>;
  }
}

export function isInSession(state: State) {
  return 'in session, idle' === state.enum ||
         'in session, loading question' === state.enum ||
         'in session, taking suggestions' === state.enum

}

export function isTakingSuggestions(state: State) {
  return state.enum === "in session, taking suggestions"
}

export function getQuestionOriginalRangeContent(state: State & { question: Omit<Question, "id"> }): string {
  return state.question.content
    .split('\n')
    .slice(state.question.range.fromLine - 1, state.question.range.toLine - 1)
    .join('\n')
}

export function getCurrentSuggestion(state: State): Answer | null {
  if (state.enum !== "in session, taking suggestions" || state.selectedSuggestionId === null) {
    return null;
  }

  const sugg = state.suggestions.find(sugg => sugg.id === state.selectedSuggestionId)
  return sugg ?? null
}

export interface StateMachineObserver {
  onStateUpdate: (state: State) => void
}

export interface ApiStrategy {
  onCreateSession: () => void;
  onPoseQuestion: (sessionId: Session["id"], question: Omit<Question, "id">) => void;
  onDeleteSuggestion: (sessionId: Session["id"], questinoId: Question["id"], suggId: Answer["id"]) => void;
}


export class StateMachineHandler {
  private apiStrategy: ApiStrategy

  private state_: State
  private observers: StateMachineObserver[]

  constructor(
    initialState: State,
    apiStrategy: ApiStrategy
  ) {
    this.state_ = initialState
    this.apiStrategy = apiStrategy
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
  editorRejoinSession() { this.doTransition({ enum: 'EDITOR: rejoin session' }) }
  editorPoseQuestion(question: Omit<Question, "id">) { this.doTransition({ enum: 'EDITOR: pose question', question }) }
  editorModifyQuestion(question: Omit<Question, "id">) { this.doTransition({ enum: 'EDITOR: modify question', newQuestion: question })}
  editorSelectSuggestion(suggId: Answer["id"] | null) { this.doTransition({ enum: 'EDITOR: select suggestion', suggId }) }
  editorAcceptSelectedSuggestion() { this.doTransition({ enum: 'EDITOR: accept selected suggestion' }) }
  editorRejectSuggestions() { this.doTransition({ enum: 'EDITOR: reject suggestions' }) }
  editorDeleteSuggestion(suggId: Answer["id"]) { this.doTransition({ enum: 'EDITOR: delete suggestion', suggId }) }
  editorEndSession() { this.doTransition({ enum: 'EDITOR: end session' }) }

  handleServerQuestionLoaded(questionId: Question["id"]) { this.doTransition({ enum: 'SERVER: question loaded', questionId }) }
  handleServerSessionCreated(session: Session) { this.doTransition({ enum: 'SERVER: session created', session }) }
  handleServerSuggestionsUpdated(suggestions: Answer[]) { this.doTransition({ enum: 'SERVER: suggestions updated', suggestions }) }

  private doTransition (transition: Transition) {
    const happyPathStateMachine = createStateMachine({
      'no session': {
        'EDITOR: create session': () => {
          this.apiStrategy.onCreateSession();
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
        },
        'EDITOR: end session': ({ rejoinableSession }, _) => ({ enum: 'no session', rejoinableSession })
      },

      'creating session': {
        'SERVER: session created': (_, { session }) => {
          return {
            enum: 'in session, idle',
            session
          }
        },
      },

      'in session, idle': {
        'EDITOR: pose question': (state, { question }) => {
          this.apiStrategy.onPoseQuestion(state.session.id, question)
          return {
            ...state,
            enum: 'in session, loading question',
            question,
          }
        },
        'EDITOR: end session': ({ session }, _) => ({ enum: 'no session', rejoinableSession: session })
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
        },
        'EDITOR: end session': ({ session }, _) => ({ enum: 'no session', rejoinableSession: session })
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

        'EDITOR: select suggestion': (state, { suggId }) => {
          const { selectedSuggestionId } = state
          return {
            ...state,
            selectedSuggestionId: suggId === selectedSuggestionId ? null : suggId
          };
        },

        'EDITOR: delete suggestion': (state, { suggId }) => {
          this.apiStrategy.onDeleteSuggestion(state.session.id, state.question.id, suggId)
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

        'EDITOR: end session': ({ session }, _) => ({ enum: 'no session', rejoinableSession: session })
      }
    } as const)

    function genericErrorMessage(state: State, trans: Transition) {
      console.warn(`Not defined: '${state.enum}' + '${trans.enum}' -> ???`)
      return state
    }

    // TODO: fill this out with actually nice error messages
    const fullStateMachine = completeMachine(happyPathStateMachine, {
        'in session, idle': {
          'EDITOR: create session': genericErrorMessage,
          "EDITOR: accept selected suggestion": genericErrorMessage,
          "EDITOR: delete suggestion": genericErrorMessage,
          "EDITOR: modify question": genericErrorMessage,
          "EDITOR: reject suggestions": genericErrorMessage,
          "EDITOR: rejoin session": genericErrorMessage,
          "EDITOR: select suggestion": genericErrorMessage,
          "SERVER: question loaded": genericErrorMessage,
          "SERVER: session created": genericErrorMessage,
          "SERVER: suggestions updated": genericErrorMessage,
        },
        'in session, loading question': {
          "SERVER: suggestions updated": genericErrorMessage,
          "SERVER: session created": genericErrorMessage,
          "EDITOR: create session": genericErrorMessage,
          "EDITOR: pose question": genericErrorMessage,
          "EDITOR: select suggestion": genericErrorMessage,
          "EDITOR: rejoin session": genericErrorMessage,
          "EDITOR: reject suggestions": genericErrorMessage,
          "EDITOR: modify question": genericErrorMessage,
          "EDITOR: delete suggestion": genericErrorMessage,
          "EDITOR: accept selected suggestion": genericErrorMessage,
        },
        'in session, taking suggestions': {
          "EDITOR: rejoin session": genericErrorMessage,
          "SERVER: session created": genericErrorMessage,
          "SERVER: question loaded": genericErrorMessage,
          "EDITOR: create session": genericErrorMessage,
          "EDITOR: pose question": genericErrorMessage
        },
        'no session': {
          "EDITOR: accept selected suggestion": genericErrorMessage,
          "EDITOR: delete suggestion": genericErrorMessage,
          "EDITOR: modify question": genericErrorMessage,
          "EDITOR: reject suggestions": genericErrorMessage,
          "EDITOR: select suggestion": genericErrorMessage,
          "SERVER: question loaded": genericErrorMessage,
          "SERVER: session created": genericErrorMessage,
          "SERVER: suggestions updated": genericErrorMessage,
          "EDITOR: pose question": genericErrorMessage,
        },
        'creating session': {
          "EDITOR: accept selected suggestion": genericErrorMessage,
          "EDITOR: delete suggestion": genericErrorMessage,
          "EDITOR: modify question": genericErrorMessage,
          "EDITOR: reject suggestions": genericErrorMessage,
          "EDITOR: select suggestion": genericErrorMessage,
          "SERVER: question loaded": genericErrorMessage,
          "SERVER: suggestions updated": genericErrorMessage,
          "EDITOR: pose question": genericErrorMessage,
          "EDITOR: create session": genericErrorMessage,
          "EDITOR: rejoin session": genericErrorMessage,
          "EDITOR: end session": genericErrorMessage
        }
    })

    const func = fullStateMachine[this.state_.enum][transition.enum] as FuncForStateAndTransition<typeof this.state_.enum, typeof transition.enum>
    this.state_ = func(this.state_, transition)
    this.notifyStateUpdate()
  }

  currentState() { return this.state_ }
}
