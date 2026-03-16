// app/actions.ts
"use server";

import { emitter } from "@/lib/eventEmitter";
import { prisma } from "@/lib/prisma";

export async function saveAnswerAction(text: string, questionId: string) {
  try {
    if (!questionId) {
      throw new Error("Missing questionId");
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });

    if (!question) {
      return { success: false, error: "Question not found" };
    }

    const created = await prisma.answer.create({
      data: {
        text: text?.trim() || null,
        question: { connect: { id: questionId } },
      },
      select: { id: true, text: true, questionId: true, createdAt: true },
    });

    const eventId = `answer-to-question:${question.id}`
    console.log(eventId)
    emitter.emit(eventId, {
      message: "createdAnswer",
      createdAt: created.createdAt,
    })

    return { success: true, data: created };
  } catch (error) {
    console.error("saveAnswerAction error", error);
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return { success: false, error: message };
  }
}
