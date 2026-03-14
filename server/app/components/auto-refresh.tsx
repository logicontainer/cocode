// components/AutoRefresh.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh({ interval = 5000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalId = setInterval(() => {
      // This tells Next.js to re-fetch the Server Component data in the background
      // without losing client-side state or doing a hard reload.
      router.refresh();
    }, interval);

    return () => clearInterval(intervalId);
  }, [router, interval]);

  return null; // This component renders nothing visually
}
