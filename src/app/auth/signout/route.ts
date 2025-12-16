import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  return redirect('/')
}
