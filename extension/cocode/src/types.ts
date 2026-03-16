export type Session = { id: number ; code: number }
export type QuestionPostResult = { id: number }
export type Range = { fromLine: number; toLine: number }
export type Question = { id: number ; content: string; range: Range; language: string }
export type Answer = { id: number ; text: string }
