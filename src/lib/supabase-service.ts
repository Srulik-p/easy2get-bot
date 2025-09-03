import { supabase, CustomerSubmission, UploadedFile, MessageLog } from './supabase'

const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key'
}

export class SupabaseService {
  
  // Get or create customer submission
  static async getOrCreateSubmission(phoneNumber: string, formType: string, formTypeLabel: string): Promise<CustomerSubmission | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }
    
    try {
      console.log('Starting getOrCreateSubmission with:', { phoneNumber, formType, formTypeLabel })
      
      // Test if we can access the table at all
      const { data: testData, error: testError } = await supabase
        .from('customer_submissions')
        .select('count(*)')
        .limit(1)
      
      console.log('Table access test:', { testData, testError })
      
      // First, try to get existing submission
      const { data: existing, error: fetchError } = await supabase
        .from('customer_submissions')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('form_type', formType)
        .single()

      console.log('Fetch existing submission result:', {
        existing: existing ? 'found' : 'not found',
        fetchError,
        phoneNumber,
        formType
      })

      if (existing && !fetchError) {
        console.log('Returning existing submission:', existing.id)
        return existing
      }

      // If not found, create new submission
      const { data, error } = await supabase
        .from('customer_submissions')
        .insert({
          phone_number: phoneNumber,
          form_type: formType,
          form_type_label: formTypeLabel,
          submitted_fields: [],
          status: 'new',
          reminder_count: 0,
          reminder_paused: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating submission:', {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          errorType: typeof error,
          errorKeys: error ? Object.keys(error) : [],
          fullError: JSON.stringify(error, null, 2),
          insertData: {
            phone_number: phoneNumber,
            form_type: formType,
            form_type_label: formTypeLabel,
            submitted_fields: [],
            status: 'new',
            reminder_count: 0,
            reminder_paused: false
          }
        })
        
        // Try a fallback approach with minimal data
        console.log('Attempting fallback creation with minimal data...')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('customer_submissions')
          .insert({
            phone_number: phoneNumber,
            form_type: formType,
            form_type_label: formTypeLabel
          })
          .select()
          .single()
          
        if (fallbackError) {
          console.error('Fallback creation also failed:', fallbackError)
          return null
        }
        
        console.log('Fallback creation succeeded')
        return fallbackData
      }

      return data
    } catch (error) {
      console.error('Error in getOrCreateSubmission:', {
        error,
        phoneNumber,
        formType,
        formTypeLabel,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  // Update submitted fields
  static async updateSubmittedFields(submissionId: string, fieldSlugs: string[]): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      // Determine status based on number of fields
      let status: 'new' | 'in-progress' | 'completed' = 'new'
      if (fieldSlugs.length > 0) {
        status = 'in-progress'
      }

      const { error } = await supabase
        .from('customer_submissions')
        .update({ 
          submitted_fields: fieldSlugs,
          status: status
        })
        .eq('id', submissionId)

      if (error) {
        console.error('Error updating submitted fields:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSubmittedFields:', error)
      return false
    }
  }

  // Update submission status
  static async updateSubmissionStatus(submissionId: string, status: 'new' | 'in-progress' | 'completed'): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      const { error } = await supabase
        .from('customer_submissions')
        .update({ status: status })
        .eq('id', submissionId)

      if (error) {
        console.error('Error updating submission status:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSubmissionStatus:', error)
      return false
    }
  }

  // Update reminder tracking fields
  static async updateSubmissionReminderTracking(submissionId: string, updates: any): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      const { error } = await supabase
        .from('customer_submissions')
        .update(updates)
        .eq('id', submissionId)

      if (error) {
        console.error('Error updating reminder tracking:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSubmissionReminderTracking:', error)
      return false
    }
  }

  // Update when form was first sent
  static async updateSubmissionSentTracking(submissionId: string, sentAt: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      const { error } = await supabase
        .from('customer_submissions')
        .update({ first_sent_at: sentAt })
        .eq('id', submissionId)

      if (error) {
        console.error('Error updating sent tracking:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSubmissionSentTracking:', error)
      return false
    }
  }

  // Update last interaction time
  static async updateSubmissionInteractionTracking(submissionId: string, interactionAt: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      const { error } = await supabase
        .from('customer_submissions')
        .update({ last_interaction_at: interactionAt })
        .eq('id', submissionId)

      if (error) {
        console.error('Error updating interaction tracking:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSubmissionInteractionTracking:', error)
      return false
    }
  }

  // Pause/resume reminders
  static async updateSubmissionReminderPause(submissionId: string, paused: boolean): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      const { error } = await supabase
        .from('customer_submissions')
        .update({ reminder_paused: paused })
        .eq('id', submissionId)

      if (error) {
        console.error('Error updating reminder pause:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSubmissionReminderPause:', error)
      return false
    }
  }

  // Upload file to storage
  static async uploadFile(file: File, phoneNumber: string, fieldSlug: string): Promise<string | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${fieldSlug}-${Date.now()}.${fileExt}`
      const filePath = `${phoneNumber}/${fileName}`

      const { data, error } = await supabase.storage
        .from('customer-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Error uploading file:', error)
        return null
      }

      return data.path
    } catch (error) {
      console.error('Error in uploadFile:', error)
      return null
    }
  }

  // Save file metadata to database
  static async saveFileMetadata(
    submissionId: string,
    fieldSlug: string,
    fieldName: string,
    file: File,
    filePath: string
  ): Promise<UploadedFile | null> {
    try {
      // First, delete any existing file for this field
      await this.deleteFileForField(submissionId, fieldSlug)

      const { data, error } = await supabase
        .from('uploaded_files')
        .insert({
          submission_id: submissionId,
          field_slug: fieldSlug,
          field_name: fieldName,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving file metadata:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in saveFileMetadata:', error)
      return null
    }
  }

  // Delete file for a specific field
  static async deleteFileForField(submissionId: string, fieldSlug: string): Promise<boolean> {
    try {
      // Get existing file record
      const { data: existingFiles } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('submission_id', submissionId)
        .eq('field_slug', fieldSlug)

      if (existingFiles && existingFiles.length > 0) {
        // Delete files from storage
        const filePaths = existingFiles.map(file => file.file_path)
        await supabase.storage
          .from('customer-files')
          .remove(filePaths)

        // Delete records from database
        await supabase
          .from('uploaded_files')
          .delete()
          .eq('submission_id', submissionId)
          .eq('field_slug', fieldSlug)
      }

      return true
    } catch (error) {
      console.error('Error in deleteFileForField:', error)
      return false
    }
  }

  // Get uploaded files for submission
  static async getUploadedFiles(submissionId: string): Promise<UploadedFile[]> {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching uploaded files:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUploadedFiles:', error)
      return []
    }
  }

  // Get file download URL
  static async getFileUrl(filePath: string): Promise<string | null> {
    try {
      if (!isSupabaseConfigured()) {
        console.error('Supabase not configured')
        return null
      }

      console.log('Getting file URL for path:', filePath)

      // Clean the file path - remove any leading slashes
      const cleanFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath
      console.log('Cleaned file path:', cleanFilePath)

      // Generate a signed URL (with authentication token) instead of public URL
      // This is required for private buckets
      const { data, error } = await supabase.storage
        .from('customer-files')
        .createSignedUrl(cleanFilePath, 3600) // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error)
        return null
      }

      if (!data?.signedUrl) {
        console.error('Could not generate signed URL for file:', cleanFilePath)
        return null
      }

      console.log('Generated signed URL:', data.signedUrl)
      return data.signedUrl

    } catch (error) {
      console.error('Error getting file URL:', error)
      return null
    }
  }

  // Complete file upload process
  static async handleFileUpload(
    phoneNumber: string,
    formType: string,
    formTypeLabel: string,
    fieldSlug: string,
    fieldName: string,
    file: File
  ): Promise<{ success: boolean; submission?: CustomerSubmission; uploadedFile?: UploadedFile }> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning failure')
      return { success: false }
    }
    
    try {
      // Get or create submission
      const submission = await this.getOrCreateSubmission(phoneNumber, formType, formTypeLabel)
      if (!submission) {
        return { success: false }
      }

      // Upload file to storage
      const filePath = await this.uploadFile(file, phoneNumber, fieldSlug)
      if (!filePath) {
        return { success: false }
      }

      // Save file metadata
      const uploadedFile = await this.saveFileMetadata(submission.id!, fieldSlug, fieldName, file, filePath)
      if (!uploadedFile) {
        return { success: false }
      }

      // Mark interaction for reminder tracking
      await this.updateSubmissionInteractionTracking(submission.id!, new Date().toISOString())

      return { success: true, submission, uploadedFile }
    } catch (error) {
      console.error('Error in handleFileUpload:', error)
      return { success: false }
    }
  }

  // Admin Functions

  // Get all customer submissions
  static async getAllSubmissions(): Promise<CustomerSubmission[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }

    try {
      const { data, error } = await supabase
        .from('customer_submissions')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching all submissions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllSubmissions:', error)
      return []
    }
  }

  // Get submission by phone number
  static async getSubmissionByPhone(phoneNumber: string): Promise<{submission: CustomerSubmission | null, files: UploadedFile[]}> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return { submission: null, files: [] }
    }

    try {
      const { data: submission, error } = await supabase
        .from('customer_submissions')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error || !submission) {
        return { submission: null, files: [] }
      }

      const files = await this.getUploadedFiles(submission.id!)
      return { submission, files }
    } catch (error) {
      console.error('Error in getSubmissionByPhone:', error)
      return { submission: null, files: [] }
    }
  }

  // Get all files for all submissions by phone number
  static async getAllFilesByPhone(phoneNumber: string): Promise<UploadedFile[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }

    try {
      // First get all submissions for this phone number
      const { data: submissions, error: submissionsError } = await supabase
        .from('customer_submissions')
        .select('id')
        .eq('phone_number', phoneNumber)

      if (submissionsError || !submissions || submissions.length === 0) {
        return []
      }

      // Get all files for all submissions
      const submissionIds = submissions.map(sub => sub.id)
      const { data: files, error: filesError } = await supabase
        .from('uploaded_files')
        .select('*')
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: false })

      if (filesError) {
        console.error('Error fetching files by phone:', filesError)
        return []
      }

      return files || []
    } catch (error) {
      console.error('Error in getAllFilesByPhone:', error)
      return []
    }
  }

  // Admin upload file for customer
  static async adminUploadFile(
    phoneNumber: string,
    formType: string,
    formTypeLabel: string,
    fieldSlug: string,
    fieldName: string,
    file: File
  ): Promise<{ success: boolean; submission?: CustomerSubmission; uploadedFile?: UploadedFile }> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning failure')
      return { success: false }
    }

    try {
      // Get or create submission
      const submission = await this.getOrCreateSubmission(phoneNumber, formType, formTypeLabel)
      if (!submission) {
        return { success: false }
      }

      // Upload file to storage
      const filePath = await this.uploadFile(file, phoneNumber, fieldSlug)
      if (!filePath) {
        return { success: false }
      }

      // Save file metadata
      const uploadedFile = await this.saveFileMetadata(submission.id!, fieldSlug, fieldName, file, filePath)
      if (!uploadedFile) {
        return { success: false }
      }

      // Mark interaction for reminder tracking (admin action counts as interaction)
      await this.updateSubmissionInteractionTracking(submission.id!, new Date().toISOString())

      return { success: true, submission, uploadedFile }
    } catch (error) {
      console.error('Error in adminUploadFile:', error)
      return { success: false }
    }
  }

  // Update customer personal details for all their submissions
  static async updateCustomerDetails(phoneNumber: string, details: {
    name?: string | null
    family_name?: string | null
    id_number?: number | null
    birth_date?: string | null
    address?: object | null
  }): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }

    try {
      // Update all submissions for this phone number with the new details
      const { error } = await supabase
        .from('customer_submissions')
        .update({
          name: details.name,
          family_name: details.family_name,
          id_number: details.id_number,
          birth_date: details.birth_date,
          address: details.address,
          updated_at: new Date().toISOString()
        })
        .eq('phone_number', phoneNumber)

      if (error) {
        console.error('Error updating customer details:', error)
        return false
      }

      console.log('Customer details updated successfully for phone:', phoneNumber)
      return true
    } catch (error) {
      console.error('Error in updateCustomerDetails:', error)
      return false
    }
  }

  // Message Logging Functions

  // Log a sent message
  static async logMessage(messageData: {
    phone_number: string
    message_type: MessageLog['message_type']
    message_content: string
    form_type?: string
    form_type_label?: string
    reminder_type?: string
    sent_successfully: boolean
    error_message?: string
    whatsapp_message_id?: string
  }): Promise<MessageLog | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping message log')
      return null
    }

    try {
      console.log('Logging message:', {
        phone: messageData.phone_number,
        type: messageData.message_type,
        success: messageData.sent_successfully
      })

      const { data, error } = await supabase
        .from('message_logs')
        .insert({
          ...messageData,
          sent_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error logging message:', {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          messageData: {
            phone: messageData.phone_number,
            type: messageData.message_type
          }
        })
        
        // If the table doesn't exist, just warn and continue
        if (error?.message?.includes('relation') && error?.message?.includes('does not exist')) {
          console.warn('message_logs table does not exist - create it in Supabase to enable message logging')
        }
        return null
      }

      console.log('Message logged successfully:', data?.id)
      return data
    } catch (error) {
      console.error('Exception in logMessage:', {
        error,
        messageData: {
          phone: messageData.phone_number,
          type: messageData.message_type
        },
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  // Get message history for a phone number
  static async getMessageHistory(phoneNumber: string): Promise<MessageLog[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }

    try {
      console.log('Fetching message history for phone:', phoneNumber)
      
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('sent_at', { ascending: false })

      console.log('Message history query result:', { data, error })

      if (error) {
        console.error('Error fetching message history:', {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          phoneNumber
        })
        return []
      }

      console.log(`Found ${data?.length || 0} messages for phone ${phoneNumber}`)
      return data || []
    } catch (error) {
      console.error('Exception in getMessageHistory:', {
        error,
        phoneNumber,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  // Get recent message activity across all customers
  static async getRecentMessages(limit: number = 50): Promise<MessageLog[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }

    try {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching recent messages:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getRecentMessages:', error)
      return []
    }
  }
}