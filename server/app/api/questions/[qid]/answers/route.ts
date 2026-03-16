import { Answer, answerNoIdSchema } from "@/types/api";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { emitter } from "@/lib/eventEmitter";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ qid: string }> },
) {
  try {
    const { qid: questionId } = await params;
    if (!questionId) {
      return NextResponse.json(
        { error: "Missing question id" },
        { status: 400 },
      );
    }

    const parsed = answerNoIdSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const answer: Omit<Answer, "id"> = parsed.data;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    const created = await prisma.answer.create({
      data: {
        text: answer.text ?? null,
        question: { connect: { id: questionId } },
      },
      select: { id: true, createdAt: true },
    });


    const eventId = `answer-to-question:${question.id}`
    console.log(eventId)
    emitter.emit(eventId, {
      message: "createdAnswer",
      createdAt: created.createdAt,
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error("answers POST error", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to create answer", message },
      { status: 500 },
    );
  }
}
