// page.tsx
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import RealtimeAnswer from '../components/realtime-answer'; // <-- Import the new component

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: number }> }) {
  const { code } = await searchParams;

  if (!code) {
    return <p>No code was provided</p>
  }

  const supabase = createClient(await cookies())

  // Fetch the initial state for an instant page load
  const { data: initialQuestion, error } = await supabase
    .rpc('get_latest_question_by_code', { p_code: code })
    .maybeSingle();

  if (error) {
    console.error('Error fetching question:', error);
  }

  return (
    <>
      <RealtimeAnswer
        code={code}
        initialQuestion={initialQuestion}
      />
    </>
  )
}
