export type Session = { id: string ; code: number }
export type QuestionPostResult = { id: string }
export type Range = { fromLine: number; toLine: number }
export type Question = { id: string ; content: string; range: Range; language: string }
export type Answer = { id: string ; text: string }
