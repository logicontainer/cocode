// app/actions.ts
'use server'

// Adjust this import based on how you initialize Supabase in your project 
// (e.g., using @supabase/ssr or @supabase/supabase-js)
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function saveAnswerAction(text: string, questionId: number) {
  const supabase = createClient(await cookies())


  // Example: Insert the content into a 'snippets' table
  const { data, error } = await supabase
    .from('Answer')
    .insert({ question_id: questionId, text })
    .select()

  if (error) {
    console.error("Supabase Error:", error)
    throw new Error('Failed to save data')
  }

  // You can optionally return data back to the client
  return { success: true, data }
}
