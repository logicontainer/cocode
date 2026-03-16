import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sid: string; qid: string; aid: string }> },
) {
  try {
    const { sid: sessionId, qid: questionId, aid: answerId } = await params;

    if (!sessionId || !questionId || !answerId) {
      return NextResponse.json(
        { error: "Missing sessionId, questionId, or answerId" },
        { status: 400 },
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, sessionId: true },
    });

    if (!question || question.sessionId !== sessionId) {
      return NextResponse.json(
        { error: "Question not found for this session" },
        { status: 404 },
      );
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: { id: true, questionId: true },
    });

    if (!answer || answer.questionId !== questionId) {
      return NextResponse.json(
        { error: "Answer not found for this question" },
        { status: 404 },
      );
    }

    await prisma.answer.delete({ where: { id: answerId } });

    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    console.error("answers DELETE error", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to delete answer", message },
      { status: 500 },
    );
  }
}
