import { emitter } from "@/lib/eventEmitter";

// Force Next.js to never cache this route
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sid: string; qid: string }> },
) {
  const { sid, qid } = await params;
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
      const encoder = new TextEncoder();

      // 1. Send an initial ping to establish connection
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: {"status": "listening to session ${sid}, question ${qid}"}\n\n`,
        ),
      );

      // 2. Define the callback that fires when an answer arrives
      const onUpdate = (data: { message: string }) => {
        const payload = JSON.stringify(data);
        controller.enqueue(
          encoder.encode(
            `event: answer-to-question:${qid}\ndata: ${payload}\n\n`,
          ),
        );
      };

      // 3. Listen only to events for this specific session id
      const eventId = `answer-to-question:${qid}`;
      emitter.on(eventId, onUpdate);

      // 4. Handle client disconnects to prevent memory leaks
      request.signal.addEventListener("abort", () => {
        emitter.off(eventId, onUpdate);
        console.log(
          `Client disconnected from listening for answers on question ${qid}`,
        );
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
