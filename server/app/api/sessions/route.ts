import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomInt } from "crypto";

export async function POST() {
  try {
    const code = randomInt(1000, 10000);

    const { id } = await prisma.session.create({
      data: { code },
    });

    console.log(`Created new session with id ${id} and code ${code}`);

    return NextResponse.json({ id, code });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
}
