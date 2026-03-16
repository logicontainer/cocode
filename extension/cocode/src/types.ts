import * as vscode from "vscode";

export type Session = { id: string; code: number };
export type QuestionPostResult = { id: string };
export type Question = {
  id: string;
  content: string;
  fromLine: number;
  toLine: number;
  language: string;
};
export type Answer = { id: string; text: string };
