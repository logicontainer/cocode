import { createClient } from "@/utils/supabase/server";
import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createClient(await cookies());
  const code = randomInt(1000, 10000);

  const { error, data } = await supabase
    .from("Session")
    .insert({ code })
    .select("id")

  if (error !== null) {
    console.error("Supabase error", error)
    return NextResponse.json(error, { status: 500 });
  }

  const [{ id }] = data

  console.log(`Created new session with id ${id} and code ${code}`)

  return NextResponse.json({ id, code })
}
