"use client";

import IDE, { extractLineRange } from "./ide";

import Menubar from "./menubar";
import { QuestionModel } from "@/lib/generated/prisma/models";
import { useState } from "react";
import { toast } from "sonner";

export default function Answer({
  code,
  question,
}: {
  code: number;
  question: QuestionModel;
}) {
  let hintMessage = "Edit the code below and submit when you're done.";
  if (question && !question.isOpen) {
    hintMessage = "The question is currently not open for answers.";
  }

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

  const hasChanges = unchangedEditableInput != userAnswer;
  const canSubmit =
    userAnswer != latestSubmittedAnswer && userAnswer != unchangedEditableInput;

  const handleSubmit = () => {
    setSubmitting(true);
    fetch(`/api/questions/${question.id}/answers`, {
      method: "POST",
      body: JSON.stringify({ text: userAnswer }),
    })
      .then((res) => {
        toast.success("Your submission has been sent to the presenter.", {
          description: "Feel free to post another submission.",
        });
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
    <div className="flex flex-col items-stretch justify-center w-full h-screen max-w-5xl gap-2 p-2 mx-auto md:p-4 md:gap-4">
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
          <p className="p-4 text-center border-b text-slate-400">
            {hintMessage}
          </p>
          {question ? (
            <IDE
              key={resetKey}
              question={question}
              onChangeUserAnswer={setUserAnswer}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <p className="text-slate-400">
                Waiting for the presenter to post a question ...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
