import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export type CustomerStatus = 
  | 'new_lead'
  | 'qualified_lead' 
  | 'agreement_signed'
  | 'ready_for_apply'
  | 'applied'
  | 'application_approved'
  | 'application_declined'

export type CustomerCriterion = 
  | 'זכאי-מגורים'
  | 'צבא-דרגה'
  | 'צבא-לוחם'
  | 'איזור-עבודה-שכיר'
  | 'איזור-עבודה-עצמאי'
  | 'איזור-לימודים'
  | 'מתנדב'
  | 'חקלאי-עצמאי'
  | 'חקלאי-שכיר'
  | 'חקלאי-דרגה-ראשונה'
  | 'מאבטח'
  | 'מנהל-ביטחון'

export type Customer = {
  id: string
  phone_number: string
  status: CustomerStatus
  criterion?: CustomerCriterion
  name?: string
  family_name?: string
  id_number?: number
  birth_date?: string
  address?: {
    street?: string
    city?: string
    zip_code?: string
  }
  created_at?: string
  updated_at?: string
}

export type CustomerSubmission = {
  id?: string
  customer_id: string
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
  customer_id?: string
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

export type AuthToken = {
  id?: string
  phone_number: string
  form_type: string
  token: string
  expires_at: string
  used_at?: string
  is_reusable: boolean
  created_by_admin: boolean
  created_at?: string
  updated_at?: string
}

// Batch Reminder Types
export type ReminderType = 
  | 'first_message' 
  | 'first' 
  | 'second' 
  | 'first_week' 
  | 'second_week' 
  | 'third_week' 
  | 'fourth_week'

export type BatchRecipient = {
  phoneNumber: string
  formType: string
  reminderType: ReminderType
  submission?: CustomerSubmission
}

export type BatchProgress = {
  totalCount: number
  sentCount: number
  failedCount: number
  currentRecipient?: string
  currentStatus: 'preparing' | 'sending' | 'sleeping' | 'completed' | 'failed'
  estimatedTimeRemaining?: number
  lastError?: string
}

export type BatchResult = {
  success: boolean
  totalSent: number
  totalFailed: number
  errors: Array<{ phoneNumber: string; error: string }>
  duration: number
}

export type ReminderCandidate = {
  phoneNumber: string
  formType: string
  formTypeLabel?: string
  reminderType: ReminderType
  daysSinceLastAction: number
  reminderCount: number
}