import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, params: Promise<{ sid: number; qid: number }>) {
  const supabase = createClient(await cookies())
  const { sid: sessionId, qid: questionId } = await params

  const { error, data } = await supabase
    .from("Answer")
    .select(`id, Question ( *, Answer ( * ) )`)
    .eq("id", sessionId)
    .eq("Question.id", questionId)
    .select()

  return NextResponse.json(data)
}
