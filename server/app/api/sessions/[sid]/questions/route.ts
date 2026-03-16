import { NextRequest, NextResponse } from "next/server";
import { Question, questionNoIdSchema } from "@/types/api";

import { emitter } from "@/lib/eventEmitter";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sid: string }> },
) {
  try {
    const { sid } = await params;
    if (!sid) {
      return NextResponse.json(
        { error: "Missing session id" },
        { status: 400 },
      );
    }

    const parseResult = questionNoIdSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parseResult.success) {
      console.log("Invalid request body:", parseResult.error);
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.format() },
        { status: 400 },
      );
    }

    const question: Omit<Question, "id"> = parseResult.data;

    const session = await prisma.session.findUnique({ where: { id: sid } });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const created = await prisma.question.create({
      data: {
        content: question.content,
        fromLine: question.fromLine,
        toLine: question.toLine,
        language: question.language ?? null,
        session: { connect: { id: sid } },
      },
      select: { id: true, createdAt: true },
    });

    console.log(`Added question with id ${created.id} to session ${sid}`);
    emitter.emit(`update-question-for-code:${session.code}`, {
      message: "createdQuestion",
      createdAt: created.createdAt,
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error("questions POST error", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to create question", message },
      { status: 500 },
    );
  }
}
