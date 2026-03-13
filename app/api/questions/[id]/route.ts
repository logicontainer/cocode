import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: number }> }) {
  const { id } = await params
  const supabase = createClient(await cookies());

  const { error, data } = await supabase
    .from("Question")
    .select()
    .eq("id", id)

  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  return NextResponse.json(data[0])
}
