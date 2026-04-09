import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = typeof window !== 'undefined' && supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null as any

export type Message = {
  id: number
  from_phone: string
  role: 'user' | 'assistant'
  content: string
  message_type: string
  created_at: string
}

export type KnowledgeRecord = {
  id: number
  source_phone: string
  action: string
  timing: string
  plot: string
  variety: string
  materials: string
  supplier: string
  cost: string
  nuances: string
  approved: boolean
  created_at: string
}

export type Insight = {
  id: number
  source_phone: string
  topic: string
  avik_method: string
  alternative: string
  reviewed: boolean
  created_at: string
}

export const USERS: Record<string, { name: string; role: string }> = {
  'whatsapp:+972523385558': { name: 'אביק', role: 'source' },
  'whatsapp:+972543300964': { name: 'תומר', role: 'manager' },
  'whatsapp:+972545682772': { name: 'שחר', role: 'manager' },
}

export function getUserName(phone: string): string {
  return USERS[phone]?.name || phone
}
