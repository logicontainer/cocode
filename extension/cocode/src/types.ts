import * as vscode from 'vscode';

export type Session = { id: number ; code: number }
export type QuestionPostResult = { id: number }
export type Question = { id: number ; content: string; fromLine: number; toLine: number }
export type Answer = { id: number ; text: string }
