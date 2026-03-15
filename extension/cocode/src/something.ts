import { Answer, Question, QuestionPostResult, Session } from './types';

type InSessionStates = { 
  sessionId: Session["id"],
  sessionCode: Session["code"]
} & (
  | { enum: 'in session, idle' }
  | { 
    enum: 'in session, taking suggestions',

    question: Question;
    suggestions: Answer[];

    inspectedSuggestionId: Answer['id'] | null;
  }
)

type State = (
  | { 
    enum: 'no session'
  }
  | InSessionStates
)

type StateEnum = State['enum']

type Transition = (
  | { enum: 'start session' }
  | { enum: 'rejoin session', sessionCode: number }
  | { 
    enum: 'pose question',
    question: Omit<Question, 'id'>
  }
  | {
    enum: 'submit suggestion',
    questionId: Question['id'],
    answer: Answer,
  }
  | {
    enum: 'inspect suggestion',
    answerId: Answer['id']
  }
  | {
    enum: 'modify question',
    newQuestion: Question,
  }
  | {
    enum: 'accept inspected suggestion'
  }
  | {
    enum: 'reject suggestions'
  }
)

type TransitionEnum = Transition['enum']

type FuncForStateAndTransition<
  S extends StateEnum,
  T extends TransitionEnum,
> = 
  ((state: State & { enum: S }, t: Transition & { enum: T }) => State) |
  ((state: State & { enum: S }, t: Transition & { enum: T }) => Promise<State>);

type StateMachine = {
  [S in StateEnum]: {
    [T in TransitionEnum]?: FuncForStateAndTransition<S, T>;
  };
};

const apiStartSession = async () => {
  const response = await fetch("https://localhost:3000/api/sessions", { method: "POST" })
  const json = await response.json();
  return json as Session;
}

const stateMachine: StateMachine = {
  'no session': {
    'start session': async () => {
      const session = await apiStartSession();
      return { 
        enum: 'in session, idle',
        sessionId: session.id,
        sessionCode: session.code,
      }
    }
  },

  'in session, idle': {
    'pose question': async (state, { question }) => {
      const res = await fetch(`http://localhost:3000/api/sessions/${state.sessionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(question),
      });
      const { id } = (await res.json()) as QuestionPostResult;
      return {
        ...state,
        enum: 'in session, taking suggestions',
        question: { ...question, id },
        suggestions: [],
        inspectedSuggestionId: null,
      } satisfies State
    },
  },

  'in session, taking suggestions': {
    'submit suggestion': (state, trans) => {
      if (trans.questionId !== state.question.id) {
        // do nothing...
        return state;
      }

      return {
        ...state,
        suggestions: [...state.suggestions]
      };
    },

    'modify question': (state, { newQuestion }) => {
      return { 
        ...state, 
        question: newQuestion
      }
    },

    'inspect suggestion': (state, trans) => {
      return {
        ...state,
        inspectedSuggestionId: trans.answerId
      };
    },

    'accept inspected suggestion': (state, _) => {
      return {
        ...state,
        enum: 'in session, idle'
      };
    }
  },
}

const doTransition = async (state: State, transition: Transition) => {
  const func = stateMachine[state.enum]?.[transition.enum] as | FuncForStateAndTransition<typeof state.enum, typeof transition.enum> | undefined;
  if (!func) {
    console.warn(`Transition undefined for ${state} + ${transition}`)
    return state;
  }

  return await func(state, transition)
}
