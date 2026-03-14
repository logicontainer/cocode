"use client"
import { useState } from "react";
import { saveAnswerAction } from "../actions";
import IDE, { extractLineRange } from "./ide";
import Menubar from "./menubar";
import { Database } from "@/utils/supabase/database.types";
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function Answer({ code, question }: { code: number, question: Database["public"]["Tables"]["Question"]["Row"] }) {
  const unchangedEditableInput = extractLineRange(question?.content, question?.from_line, question?.to_line)
  const [userAnswer, setUserAnswer] = useState(unchangedEditableInput)
  const [latestSubmittedAnswer, setLatestSubmittedAnswer] = useState(unchangedEditableInput)
  const [resetKey, setResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const hasChanges = unchangedEditableInput != userAnswer
  const canSubmit = userAnswer != latestSubmittedAnswer && userAnswer != unchangedEditableInput

  const handleSubmit = () => {
    setSubmitting(true)
    saveAnswerAction(userAnswer, question.id).then((res) => {
      setIsOpen(true)
      setLatestSubmittedAnswer(userAnswer)
    }
    ).catch(err =>
      window.alert("An error occurred submitting your answer:(")
    ).finally(() => {
      setSubmitting(false)
    })
  }
  const handleReset = () => {
    console.log("Handle reset")
    setUserAnswer(unchangedEditableInput)
    setResetKey((key) => key + 1)
  }
  return (
    <>
      <Menubar code={code} submitting={submitting} onSubmit={handleSubmit} onReset={handleReset} hasChanges={hasChanges} canSubmit={canSubmit} />
      <div className="flex items-center justify-center p-5 md:p-10 md:pt-5 h-[calc(100vh-65px)]">
        <div className="border border-zinc-100 rounded-lg w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white">
          {question ?
            <IDE key={resetKey} question={question} onChangeUserAnswer={setUserAnswer} /> :
            <div className="w-full h-full flex justify-center items-center">Waiting for the presenter to post a question ...</div>
          }
        </div>
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Received</DialogTitle>
            <DialogDescription>
              Your submission has been sent to the presenter.<br />
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
    </>
  )
}
