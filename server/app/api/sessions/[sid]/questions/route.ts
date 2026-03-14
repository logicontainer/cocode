import { Question, questionNoIdSchema } from "@/types/api";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sid: string }> }) {
  const supabase = createClient(await cookies());
  const { sid: sidString } = await params
  const sessionId = parseInt(sidString)


  const parseResult = questionNoIdSchema.safeParse(await req.json().catch(() => null))
  if (!parseResult.success) {
    console.log("Invalid request body:", parseResult.error)
    return NextResponse.json(parseResult.error, { status: 400 })
  }

  const question: Omit<Question, "id"> = parseResult.data

  const { error, data } = await supabase
    .from("Question")
    .insert({
      content: question.content,
      from_line: question.fromLine,
      to_line: question.toLine,
      session_id: sessionId,
    })
    .select("id")

  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  const [{ id }] = data

  console.log(`Added question with id ${id} to session ${sessionId}`)

  return NextResponse.json({ id })
}
