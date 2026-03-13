import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: number }> }) {
  const supabase = createClient(await cookies())
  const { code } = await params

  const { error, data } = await supabase.rpc("get_latest_question_by_code", { p_code: code }).select("id")
  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  const [{ id }] = data

  return NextResponse.json({ id })
}
