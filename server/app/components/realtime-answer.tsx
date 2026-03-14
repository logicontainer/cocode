// components/RealtimeAnswer.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Answer from "./answer";

export default function RealtimeAnswer({
  code,
  initialQuestion
}: {
  code: number;
  initialQuestion: any;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // 1. Create a subscription channel
    const channel = supabase
      .channel("realtime-questions")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERTs, UPDATEs, or DELETEs
          schema: "public",
          table: "Question", // <-- CHANGE THIS to your actual table name
        },
        async () => {
          console.log("Question table changed!")
          // 2. When a change happens, re-run your specific RPC 
          // to ensure we have the perfectly formatted latest data
          const { data, error } = await supabase
            .rpc("get_latest_question_by_code", { p_code: code })
            .maybeSingle();

          if (error) {
            window.alert("Error")
            setError(error.message)
          } else {
            console.log(data)
          }
          if (!error) {
            setQuestion(data);
          }
        }
      )
      .subscribe();
    console.log("Subscribing!")

    // 3. Cleanup the subscription when the user leaves the page
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, supabase]);

  if (error) {

    return <div>An error occured: {error}</div>;
  }

  return <Answer question={question} />;
}
