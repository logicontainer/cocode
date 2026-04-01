import RealtimeAnswer from "../components/realtime-answer";
import { prisma } from "@/lib/prisma";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code: codeParam } = await searchParams;

  if (!codeParam) {
    return <p>No code was provided</p>;
  }

  const code = Number(codeParam);
  if (Number.isNaN(code) || !Number.isInteger(code)) {
    return <p>Invalid code value: {codeParam}</p>;
  }

  try {
    const latestQuestion = await prisma.question.findFirst({
      where: { session: { code } },
      orderBy: { createdAt: "desc" },
    });
    if (latestQuestion) latestQuestion.isOpen = false;

    return <RealtimeAnswer code={code} initialQuestion={latestQuestion} />;
  } catch (error) {
    console.error("Error fetching latest question by code:", error);
    return <p>Failed to load question</p>;
  }
}
