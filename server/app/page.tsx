import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import IDE from "@/app/components/ide"
import { Suspense } from 'react';

export default async function Page() {
  const supabase = createClient(await cookies())
  const sessionCode = 1234; // The code you already know

  const { data: latestQuestion, error } = await supabase
    .rpc('get_latest_question_by_code', { p_code: sessionCode })
    .maybeSingle();

  if (error) {
    console.error('Error fetching question:', error);
  } else {
    console.log('Latest Question:', latestQuestion);
  }

  return (
    <><p>{JSON.stringify(latestQuestion)}</p>
      {latestQuestion ?
        <IDE question={latestQuestion}></IDE>
        : <div>Loading ...</div>}
    </>
  )
}

