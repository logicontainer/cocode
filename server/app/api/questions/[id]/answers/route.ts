import { Answer } from "@/types/api";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: number }> }) {
  const supabase = createClient(await cookies());
  const { id } = await params

  const { error, data } = await supabase
    .from("Question")
    .select("id, Answer ( * )")
    .eq("id", id)
    
  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  const answers: Answer[] = data
    .flatMap(ls => ls.Answer)
    .map(answer => ({ 
      id: answer.id,
      text: answer.text ?? ""
    }))

  return NextResponse.json(answers)
}
