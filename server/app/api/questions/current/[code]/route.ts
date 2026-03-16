import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code: codeString } = await params;
    if (!codeString) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const code = Number(codeString);
    if (Number.isNaN(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const latestQuestion = await prisma.question.findFirst({
      where: {
        session: {
          code,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latestQuestion) {
      return NextResponse.json(
        { error: "No question found for code", code },
        { status: 404 },
      );
    }

    return NextResponse.json(latestQuestion, { status: 200 });
  } catch (error) {
    console.error("questions/current GET error", error);
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to get latest question for code", message },
      { status: 500 },
    );
  }
}
