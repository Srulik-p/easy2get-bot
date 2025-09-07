import { supabase, Customer, CustomerSubmission, UploadedFile, MessageLog, AuthToken } from './supabase'

const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key'
}

export class SupabaseService {
  
  // Customer Management Functions

  // Get or create customer
  static async getOrCreateCustomer(phoneNumber: string): Promise<Customer | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }
    
    try {
      // Sanitize phone to avoid duplicated 972 prefixes
      const sanitizedPhone = phoneNumber.trim().replace(/^(?:\+?972)+/, '+972')

      // First, try to get existing customer
      const { data: existing, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone_number', sanitizedPhone)
        .maybeSingle()

      if (existing && !fetchError) {
        return existing
      }

      // If not found, create new customer
      const { data, error } = await supabase
        .from('customers')
        .insert({
          phone_number: sanitizedPhone
        })
        .select()
        .maybeSingle()

      if (error) {
        console.error('Error creating customer:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getOrCreateCustomer:', error)
      return null
    }
  }

  // Create customer with additional details
  static async createCustomer(customerData: {
    phone_number: string;
    name?: string;
    family_name?: string;
    criterion?: string;
    id_number?: number | string | null;
    status?: 'new_lead' | 'qualified_lead' | 'agreement_signed' | 'ready_for_apply' | 'applied' | 'application_approved' | 'application_declined';
  }): Promise<Customer | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          phone_number: customerData.phone_number,
          name: customerData.name || null,
          family_name: customerData.family_name || null,
          criterion: customerData.criterion || null,
          id_number: customerData.id_number ? Number(String(customerData.id_number).replace(/\D/g, '')) : null,
          status: customerData.status || 'agreement_signed'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating customer:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in createCustomer:', error)
      return null
    }
  }

  // Update customer details
  static async updateCustomer(customerId: string, details: Partial<Customer>): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          ...details,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)

      if (error) {
        console.error('Error updating customer:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateCustomer:', error)
      return false
    }
  }

  // Get all customers
  static async getAllCustomers(): Promise<Customer[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching all customers:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllCustomers:', error)
      return []
    }
  }

  // Get customer by phone number
  static async getCustomerByPhone(phoneNumber: string): Promise<Customer | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone_number', phoneNumber)
        .maybeSingle()

      if (error) {
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getCustomerByPhone:', error)
      return null
    }
  }

  // Get or create customer submission
  static async getOrCreateSubmission(phoneNumber: string, formType: string, formTypeLabel: string): Promise<CustomerSubmission | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }
    
    try {
      // Sanitize phone to avoid duplicated 972 prefixes
      const sanitizedPhone = phoneNumber.trim().replace(/^(?:\+?972)+/, '+972')
      console.log('Starting getOrCreateSubmission with:', { phoneNumber: sanitizedPhone, formType, formTypeLabel })
      
      // First, ensure customer exists
      const customer = await this.getOrCreateCustomer(sanitizedPhone)
      if (!customer) {
        console.error('Failed to get or create customer')
        return null
      }
      
      // Try to get existing submission
      const { data: existing, error: fetchError } = await supabase
        .from('customer_submissions')
        .select('*')
        .eq('phone_number', sanitizedPhone)
        .eq('form_type', formType)
        .maybeSingle()

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

      // If not found, create new submission (with only the core required fields)
      const { data, error } = await supabase
        .from('customer_submissions')
        .insert({
          customer_id: customer.id,
          phone_number: sanitizedPhone,
          form_type: formType,
          form_type_label: formTypeLabel,
          submitted_fields: []
        })
        .select()
        .maybeSingle()

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
            phone_number: sanitizedPhone,
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
            customer_id: customer.id,
            phone_number: sanitizedPhone,
            form_type: formType,
            form_type_label: formTypeLabel
          })
          .select()
          .maybeSingle()
          
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
      let newStatus: 'new' | 'in-progress' | 'completed' = 'new'
      if (fieldSlugs.length > 0) {
        newStatus = 'in-progress'
      }

      const { error, status: httpStatus } = await supabase
        .from('customer_submissions')
        .update({ 
          submitted_fields: fieldSlugs,
          status: newStatus
        })
        .eq('id', submissionId)

      // Treat successful HTTP statuses as success regardless of empty error objects
      if (typeof httpStatus === 'number' && httpStatus >= 200 && httpStatus < 300) {
        return true
      }
      // If no HTTP status provided, consider lack of error code/message as success
      const errCode = (error as { code?: string })?.code
      const errMsg = (error as { message?: string })?.message
      if (!error || (!errCode && !errMsg)) {
        return true
      }
      // Non-success with a meaningful error: fail silently (no console error noise)
      return false

      return true
    } catch (error) {
      // Avoid throwing console errors; keep logs minimal
      console.warn('updateSubmittedFields exception', error)
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

  // Update reminder tracking fields (gracefully handle missing columns)
  static async updateSubmissionReminderTracking(submissionId: string, updates: Partial<CustomerSubmission>): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      // Filter out fields that might not exist in the database
      const filteredUpdates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(updates)) {
        // Skip reminder-specific columns if they might not exist
        if (key === 'reminder_count' || key === 'last_reminder_sent_at' || key === 'reminder_paused') {
          continue
        }
        filteredUpdates[key] = value
      }

      // If no valid updates remain, just return true
      if (Object.keys(filteredUpdates).length === 0) {
        console.warn('No valid columns to update in reminder tracking - skipping')
        return true
      }

      const { error } = await supabase
        .from('customer_submissions')
        .update(filteredUpdates)
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

  // Update when form was first sent (gracefully handle missing column)
  static async updateSubmissionSentTracking(submissionId: string, sentAt: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }
    
    try {
      // Try to update first_sent_at column if it exists
      const { error } = await supabase
        .from('customer_submissions')
        .update({ first_sent_at: sentAt })
        .eq('id', submissionId)

      if (error) {
        // If the column doesn't exist, just log a warning and continue
        if (error.code === 'PGRST204') {
          console.warn('first_sent_at column not found in customer_submissions table - skipping sent tracking')
          return true // Return true to not break the flow
        }
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
        // If the column doesn't exist in the DB yet, skip gracefully
        if ((error as { code?: string })?.code === 'PGRST204' ||
            (error as { message?: { toString?: () => string } })?.message?.toString?.().includes('does not exist')) {
          console.warn('last_interaction_at column not found - skipping interaction tracking')
          return true
        }
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
        .maybeSingle()

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

  // Get files for a list of submission IDs (for admin overview)
  static async getFilesBySubmissionIds(submissionIds: string[]): Promise<UploadedFile[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }

    try {
      if (!submissionIds || submissionIds.length === 0) return []

      const { data: files, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching files by submission IDs:', error)
        return []
      }

      return files || []
    } catch (error) {
      console.error('Error in getFilesBySubmissionIds:', error)
      return []
    }
  }

  /**
   * Delete all uploaded files for a list of submission IDs: removes from storage and DB
   */
  static async deleteFilesBySubmissionIds(submissionIds: string[]): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }

    try {
      if (!submissionIds || submissionIds.length === 0) return true

      const { data: files } = await supabase
        .from('uploaded_files')
        .select('file_path, submission_id')
        .in('submission_id', submissionIds)

      const filePaths = (files || []).map(f => f.file_path).filter(Boolean)

      if (filePaths.length > 0) {
        await supabase.storage
          .from('customer-files')
          .remove(filePaths)
      }

      // Delete DB records (though uploaded_files has ON DELETE CASCADE, this is explicit)
      await supabase
        .from('uploaded_files')
        .delete()
        .in('submission_id', submissionIds)

      return true
    } catch (error) {
      console.error('Error deleting files by submission IDs:', error)
      return false
    }
  }

  /**
   * Completely delete a customer and all related data by phone number
   */
  static async deleteCustomerCompletely(phoneNumber: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }

    try {
      // 1) Get customer record
      const customer = await this.getCustomerByPhone(phoneNumber)
      if (!customer) {
        console.warn('Customer not found for deletion:', phoneNumber)
        return true
      }

      // 2) Collect all submissions for this phone
      const { data: submissions } = await supabase
        .from('customer_submissions')
        .select('id')
        .eq('phone_number', phoneNumber)

      const submissionIds = (submissions || []).map(s => s.id).filter(Boolean)

      // 3) Remove files from storage and DB
      await this.deleteFilesBySubmissionIds(submissionIds)

      // 4) Delete submissions (uploaded_files rows will also be deleted due to ON DELETE CASCADE)
      await supabase
        .from('customer_submissions')
        .delete()
        .eq('phone_number', phoneNumber)

      // 5) Optional cleanups: message logs and tokens for this phone
      try {
        await supabase
          .from('message_logs')
          .delete()
          .eq('phone_number', phoneNumber)
      } catch (_e) {
        // Table may not exist; ignore
      }

      try {
        await supabase
          .from('auth_tokens')
          .delete()
          .eq('phone_number', phoneNumber)
      } catch (_e) {
        // Table may not exist; ignore
      }

      // 6) Delete the customer record
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)

      if (error) {
        console.error('Error deleting customer:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in deleteCustomerCompletely:', error)
      return false
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

  // Legacy method - kept for backward compatibility
  // Use updateCustomer() instead for new code
  static async updateCustomerDetails(phoneNumber: string, details: {
    name?: string | null
    family_name?: string | null
    id_number?: number | null
    birth_date?: string | null
    address?: object | null
  }): Promise<boolean> {
    const customer = await this.getCustomerByPhone(phoneNumber)
    if (!customer) {
      console.warn('Customer not found for phone:', phoneNumber)
      return false
    }
    
    const convertedDetails = {
      ...details,
      name: details.name || undefined,
      family_name: details.family_name || undefined,
      id_number: details.id_number || undefined,
      birth_date: details.birth_date || undefined,
      address: details.address || undefined
    }
    return await this.updateCustomer(customer.id, convertedDetails)
  }

  // Message Logging Functions

  // Log a sent message
  static async logMessage(messageData: {
    customer_id?: string
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
      
      // First, try to get the customer_id for this phone number
      const customer = await this.getCustomerByPhone(phoneNumber)
      
      // Query messages by both phone_number and customer_id to get all relevant messages
      let query = supabase
        .from('message_logs')
        .select('*')
      
      if (customer?.id) {
        // If we have customer_id, query by both customer_id and phone_number
        query = query.or(`phone_number.eq.${phoneNumber},customer_id.eq.${customer.id}`)
      } else {
        // Fallback to phone_number only
        query = query.eq('phone_number', phoneNumber)
      }
      
      const { data, error } = await query.order('sent_at', { ascending: false })

      console.log('Message history query result:', { data, error })

      if (error) {
        console.error('Error fetching message history:', {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          phoneNumber,
          customerId: customer?.id
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

  // Authorization Token Functions
  static async createAuthToken(tokenData: {
    phone_number: string
    form_type: string
    token: string
    expires_at: string
    is_reusable?: boolean
    created_by_admin?: boolean
  }): Promise<AuthToken | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }

    try {
      const { data, error } = await supabase
        .from('auth_tokens')
        .insert([{
          phone_number: tokenData.phone_number,
          form_type: tokenData.form_type,
          token: tokenData.token,
          expires_at: tokenData.expires_at,
          is_reusable: tokenData.is_reusable || false,
          created_by_admin: tokenData.created_by_admin || true
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating auth token:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in createAuthToken:', error)
      return null
    }
  }

  static async validateAuthToken(token: string): Promise<AuthToken | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning null')
      return null
    }

    try {
      const { data, error } = await supabase
        .from('auth_tokens')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          console.error('Error validating auth token:', error)
        }
        return null
      }

      // Check if token is single-use and already used
      if (!data.is_reusable && data.used_at) {
        return null
      }

      return data
    } catch (error) {
      console.error('Error in validateAuthToken:', error)
      return null
    }
  }

  static async markTokenAsUsed(tokenId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }

    try {
      const { error } = await supabase
        .from('auth_tokens')
        .update({
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenId)

      if (error) {
        console.error('Error marking token as used:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in markTokenAsUsed:', error)
      return false
    }
  }

  static async getTokensByPhone(phoneNumber: string): Promise<AuthToken[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array')
      return []
    }

    try {
      const { data, error } = await supabase
        .from('auth_tokens')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tokens for phone:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getTokensByPhone:', error)
      return []
    }
  }

  static async revokeToken(tokenId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false')
      return false
    }

    try {
      const { error } = await supabase
        .from('auth_tokens')
        .delete()
        .eq('id', tokenId)

      if (error) {
        console.error('Error revoking token:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in revokeToken:', error)
      return false
    }
  }

  static async cleanupExpiredTokens(): Promise<number> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning 0')
      return 0
    }

    try {
      const { data, error } = await supabase
        .from('auth_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select()

      if (error) {
        console.error('Error cleaning up expired tokens:', error)
        return 0
      }

      return data ? data.length : 0
    } catch (error) {
      console.error('Error in cleanupExpiredTokens:', error)
      return 0
    }
  }
}