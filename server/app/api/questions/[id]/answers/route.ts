import { Answer, answerNoIdSchema } from "@/types/api";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient(await cookies());
  const { id: idString } = await params
  const id = parseInt(idString)

  const parseResult = answerNoIdSchema.safeParse(await req.json())
  if (!parseResult.success) {
    return NextResponse.json(parseResult.error, { status: 400 })
  }

  const answer: Omit<Answer, "id"> = parseResult.data

  const { error, data } = await supabase
    .from("Answer")
    .insert({
      question_id: id,
      text: answer.text
    })

  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  return NextResponse.json({})
}
