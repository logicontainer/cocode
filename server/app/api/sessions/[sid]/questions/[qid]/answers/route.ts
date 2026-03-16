import { NextRequest, NextResponse } from "next/server";

import { Answer } from "@/types/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ sid: string; qid: string }> },
) {
  try {
    const { sid: sessionId, qid: questionId } = await params;

    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: "Missing sessionId or questionId" },
        { status: 400 },
      );
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        sessionId: sessionId,
      },
      include: {
        answers: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found for this session" },
        { status: 404 },
      );
    }

    const answers: Answer[] = question.answers.map((a) => ({
      id: a.id,
      text: a.text ?? "",
    }));

    return NextResponse.json(answers);
  } catch (error) {
    console.error("answers GET error", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to get answers", message },
      { status: 500 },
    );
  }
}
