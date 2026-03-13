import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import IDE from "@/app/components/ide"

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: number }> }) {
  const { code } = await searchParams;
  if (!code) {
    return <p>No code was provided</p>
  }

  const supabase = createClient(await cookies())

  const { data: latestQuestion, error } = await supabase
    .rpc('get_latest_question_by_code', { p_code: code })
    .maybeSingle();

  if (error) {
    console.error('Error fetching question:', error);
  } else {
    console.log('Latest Question:', latestQuestion);
  }

  return (
    <>      {latestQuestion ?
      <IDE question={latestQuestion}></IDE>
      : <div>Loading ...</div>}
    </>
  )
}

