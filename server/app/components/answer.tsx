"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import IDE, { extractLineRange } from "./ide";

import { Button } from "@/components/ui/button";
import Menubar from "./menubar";
import { QuestionModel } from "@/lib/generated/prisma/models";
import { saveAnswerAction } from "../actions";
import { useState } from "react";

export default function Answer({
  code,
  question,
}: {
  code: number;
  question: QuestionModel;
}) {
  const unchangedEditableInput = extractLineRange(
    question?.content,
    question?.fromLine,
    question?.toLine,
  );
  const [userAnswer, setUserAnswer] = useState(unchangedEditableInput);
  const [latestSubmittedAnswer, setLatestSubmittedAnswer] = useState(
    unchangedEditableInput,
  );
  const [resetKey, setResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const hasChanges = unchangedEditableInput != userAnswer;
  const canSubmit =
    userAnswer != latestSubmittedAnswer && userAnswer != unchangedEditableInput;

  const handleSubmit = () => {
    setSubmitting(true);
    saveAnswerAction(userAnswer, question.id)
      .then((res) => {
        setIsOpen(true);
        setLatestSubmittedAnswer(userAnswer);
      })
      .catch((err) =>
        window.alert("An error occurred submitting your answer:("),
      )
      .finally(() => {
        setSubmitting(false);
      });
  };
  const handleReset = () => {
    setUserAnswer(unchangedEditableInput);
    setResetKey((key) => key + 1);
  };
  return (
    <div className="w-full max-w-5xl mx-auto p-2 md:p-4 flex flex-col justify-center items-stretch gap-2 md:gap-4 h-screen">
      <Menubar
        code={code}
        submitting={submitting}
        onSubmit={handleSubmit}
        onReset={handleReset}
        hasChanges={hasChanges}
        canSubmit={canSubmit}
      />
      <div className="flex items-center justify-center h-[calc(100vh-80px)] w-full">
        <div className="border border-zinc-100 rounded-xl overflow-hidden w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white">
          <p className="p-4 text-slate-400 text-center">
            Edit the code below and submit when you're done.
          </p>
          {question ? (
            <IDE
              key={resetKey}
              question={question}
              onChangeUserAnswer={setUserAnswer}
            />
          ) : (
            <div className="w-full h-full flex justify-center items-center">
              Waiting for the presenter to post a question ...
            </div>
          )}
        </div>
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Received</DialogTitle>
            <DialogDescription>
              Your submission has been sent to the presenter.
              <br />
              Feel free to post another submission.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
