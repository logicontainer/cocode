// components/RealtimeAnswer.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import Answer from "./answer";

export default function RealtimeAnswer({
  code,
  initialQuestion,
}: {
  code: number;
  initialQuestion: any;
}) {
  const prevQuestion = useRef(initialQuestion);
  const [question, setQuestion] = useState(initialQuestion);
  const [error, setError] = useState<string | null>(null);

  function subscribeToQuestions(code: number) {
    const url = `/api/events/questions/current/${code}`;
    const sse = new EventSource(url);

    // Listen for the custom 'update-question-for-code' event we defined in our Next.js stream
    sse.addEventListener(`update-question-for-code:${code}`, (event) => {
      const data = JSON.parse(event.data);
      console.log(`Received ping for session with code ${code}:`, data);

      fetch(`/api/questions/current/${code}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
          }
          const latestQuestion = await response.json();
          if (!latestQuestion) {
            console.error("Failed to fetch latest question.");
          }
          if (JSON.stringify(prevQuestion.current) != JSON.stringify(data)) {
            setQuestion(latestQuestion);
            prevQuestion.current = latestQuestion;
          }
        })
        .catch((err) => {
          setError(err.message);
        });
    });

    // Handle standard connection messages
    sse.addEventListener("connected", (event) => {
      console.log("SSE Connected:", JSON.parse(event.data));
    });

    sse.onerror = (err) => {
      console.error("SSE Error:", err);
      // EventSource will automatically attempt to reconnect, which is awesome.
    };

    return sse; // Return it so you can call sse.close() when the user closes the session
  }

  useEffect(() => {
    subscribeToQuestions(code);
  }, [code]);

  if (error) {
    return <div>An error occured: {error}</div>;
  }

  return <Answer code={code} question={question} />;
}
