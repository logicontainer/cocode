"use client"
import { useState } from "react";
import { saveAnswerAction } from "../actions";
import IDE, { extractLineRange } from "./ide";
import Menubar from "./menubar";
import { Database } from "@/utils/supabase/database.types";

export default function Answer({ code, question }: { code: number, question: Database["public"]["Tables"]["Question"]["Row"] }) {
  const unchangedEditableInput = extractLineRange(question.content, question.from_line, question.to_line)
  const [userAnswer, setUserAnswer] = useState("")
  const [resetKey, setResetKey] = useState(0)

  const hasChanges = unchangedEditableInput != userAnswer

  const handleSubmit = () => {
    saveAnswerAction(userAnswer, question.id).then((res) =>
      window.alert("Answer submitted!")
    ).catch(err =>
      window.alert("An error occurred submitting your answer:(")
    )
  }
  const handleReset = () => {
    console.log("Handle reset")
    setUserAnswer(unchangedEditableInput)
    setResetKey((key) => key + 1)
  }
  return (
    <>
      <Menubar code={code} onSubmit={handleSubmit} onReset={handleReset} hasChanges={hasChanges} />
      <div className="flex items-center justify-center p-5 md:p-10 md:pt-10 h-[calc(100vh-65px)]">
        <div className="border border-zinc-100 rounded-lg w-full h-full overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white">
          {question ?
            <IDE key={resetKey} question={question} onChangeUserAnswer={setUserAnswer} /> :
            <div className="w-full h-full flex justify-center items-center">Waiting for the presenter to post a question ...</div>
          }
        </div>
      </div>
    </>
  )
}
