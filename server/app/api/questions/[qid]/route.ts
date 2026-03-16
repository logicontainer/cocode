import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ qid: string }> },
) {
  try {
    const { qid } = await params;
    if (!qid) {
      return NextResponse.json(
        { error: "Missing question id" },
        { status: 400 },
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: qid },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error("question GET error", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to get question", message },
      { status: 500 },
    );
  }
}
