import { Answer } from "@/types/api";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { text } from "stream/consumers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ sid: string; qid: string }> }) {
  const supabase = createClient(await cookies())
  const { sid: sessionIdString, qid: questionIdString } = await params
  const sessionId = parseInt(sessionIdString)
  const questionId = parseInt(questionIdString)

  console.log(`Getting answers for session ${sessionId}, question ${questionId}`)

  const { error, data } = await supabase
    .from("Session")
    .select(`id, Question ( *, Answer ( * ) )`)
    .eq("id", sessionId)
    .eq("Question.id", questionId)

  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  const answers: Answer[] =
    data.flatMap(s => s.Question)
      .flatMap(s => s.Answer)
      .flatMap(a => ({
        id: a.id,
        text: a.text ?? "",
      }))

  return NextResponse.json(answers)
}
