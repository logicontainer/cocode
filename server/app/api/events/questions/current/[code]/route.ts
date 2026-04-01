import { emitter } from "@/lib/eventEmitter";

// Force Next.js to never cache this route
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }, // Next.js 15+ async params
) {
  const { code } = await params;
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
      const encoder = new TextEncoder();

      // 1. Send an initial ping to establish connection
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: {"status": "will notify you, when the current question changes for session with code: ${code}"}\n\n`,
        ),
      );

      // 2. Define the callback that fires when this session is updated
      const onUpdate = (data: { message: string }) => {
        const payload = JSON.stringify(data);
        controller.enqueue(
          encoder.encode(
            `event: update-question-for-code:${code}\ndata: ${payload}\n\n`,
          ),
        );
      };

      // 3. Listen only to events for this specific session id
      const eventName = `update-question-for-code:${code}`;
      emitter.on(eventName, onUpdate);

      // 4. Handle client disconnects to prevent memory leaks
      request.signal.addEventListener("abort", () => {
        emitter.off(eventName, onUpdate);
        console.log(`Client disconnected from session ${code}`);
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
