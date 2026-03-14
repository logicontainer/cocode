"use client"
import { useState } from "react";
import { saveAnswerAction } from "../actions";
import IDE from "./ide";
import Menubar from "./menubar";
import { Database } from "@/utils/supabase/database.types";

export default function Answer({ question }: { question: Database["public"]["Tables"]["Question"]["Row"] }) {
  const [userAnswer, setUserAnswer] = useState("")

  const handleSubmit = () => {
    saveAnswerAction(userAnswer, question.id).then((res) =>
      window.alert("Answer submitted!")
    ).catch(err =>
      window.alert("An error occurred submitting your answer:(")
    )
  }
  return (
    <>
      <Menubar onSubmit={handleSubmit} />
      <div className="flex items-center justify-center p-5 h-[calc(100vh-60px)]">
        <div className="border rounded-lg w-full h-full overflow-hidden shadow-md bg-white">
          {question ?
            <IDE question={question} onChangeUserAnswer={setUserAnswer} /> :
            <div className="w-full h-full flex justify-center items-center">Waiting for the presenter to post a question ...</div>
          }
        </div >
      </div >
    </ >
  )
}
