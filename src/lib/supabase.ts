import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export type CustomerSubmission = {
  id?: string
  phone_number: string
  form_type: string
  form_type_label: string
  submitted_fields: string[]
  status: 'new' | 'in-progress' | 'completed'
  first_sent_at?: string
  last_interaction_at?: string
  last_reminder_sent_at?: string
  reminder_count: number
  reminder_paused: boolean
  name?: string
  id_number?: number
  family_name?: string
  birth_date?: string
  address?: {
    street?: string
    city?: string
    zip_code?: string
  }
  created_at?: string
  updated_at?: string
}

export type UploadedFile = {
  id?: string
  submission_id: string
  field_slug: string
  field_name: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  created_at?: string
}

export type MessageLog = {
  id?: string
  phone_number: string
  message_type: 'form_link' | 'manual' | 'reminder_first' | 'reminder_second' | 'reminder_first_week' | 'reminder_second_week' | 'reminder_third_week' | 'reminder_fourth_week' | 'verification_code'
  message_content: string
  form_type?: string
  form_type_label?: string
  reminder_type?: string
  sent_successfully: boolean
  error_message?: string
  whatsapp_message_id?: string
  sent_at: string
  created_at?: string
}