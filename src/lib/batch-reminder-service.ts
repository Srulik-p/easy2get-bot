import { SupabaseService } from './supabase-service'
import { ReminderService } from './reminder-service'
import { 
  BatchRecipient, 
  BatchProgress, 
  BatchResult
} from './supabase'

export class BatchReminderService {
  private static readonly MIN_MESSAGE_DELAY = 2 * 60 * 1000 // 2 minutes in milliseconds
  private static readonly MAX_MESSAGE_DELAY = 5 * 60 * 1000 // 5 minutes in milliseconds
  private static readonly BATCH_SIZE = 20 // Messages before long break
  private static readonly BATCH_BREAK_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

  /**
   * Process a batch of selected reminder candidates with smart rate limiting
   * @param recipients Array of selected recipients with their reminder types
   * @param progressCallback Optional callback to track progress
   * @returns BatchResult with statistics and errors
   */
  static async processBatchReminders(
    recipients: BatchRecipient[],
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchResult> {
    const startTime = Date.now()
    const result: BatchResult = {
      success: true,
      totalSent: 0,
      totalFailed: 0,
      errors: [],
      duration: 0
    }

    if (recipients.length === 0) {
      return { ...result, duration: Date.now() - startTime }
    }

    console.log(`Starting batch reminder processing for ${recipients.length} recipients`)

    // Prepare recipients by validating and enriching data
    const preparedRecipients = await this.prepareRecipients(recipients)
    
    let processedCount = 0
    let sentInCurrentBatch = 0

    for (const recipient of preparedRecipients) {
      try {
        // Update progress
        const progress: BatchProgress = {
          totalCount: recipients.length,
          sentCount: result.totalSent,
          failedCount: result.totalFailed,
          currentRecipient: recipient.phoneNumber,
          currentStatus: 'sending',
          estimatedTimeRemaining: this.estimateRemainingTime(
            processedCount, 
            recipients.length, 
            startTime
          )
        }
        progressCallback?.(progress)

        // Send the reminder
        const sendResult = await this.sendSingleReminder(recipient)
        
        if (sendResult.success) {
          result.totalSent++
          console.log(`✅ Sent reminder to ${recipient.phoneNumber} (${recipient.reminderType})`)
        } else {
          result.totalFailed++
          result.errors.push({
            phoneNumber: recipient.phoneNumber,
            error: sendResult.error || 'Unknown error'
          })
          console.error(`❌ Failed to send to ${recipient.phoneNumber}: ${sendResult.error}`)
        }

        processedCount++
        sentInCurrentBatch++

        // Check if we need a long break (every 20 sends)
        if (sentInCurrentBatch >= this.BATCH_SIZE && processedCount < recipients.length) {
          console.log(`💤 Taking 30-minute break after ${sentInCurrentBatch} messages...`)
          
          const sleepProgress: BatchProgress = {
            ...progress,
            currentStatus: 'sleeping',
            estimatedTimeRemaining: this.estimateRemainingTime(
              processedCount, 
              recipients.length, 
              startTime,
              this.BATCH_BREAK_DURATION
            )
          }
          progressCallback?.(sleepProgress)

          await this.sleep(this.BATCH_BREAK_DURATION)
          sentInCurrentBatch = 0
        } else if (processedCount < recipients.length) {
          // Random delay between messages (2-5 minutes)
          const delay = this.getRandomDelay()
          console.log(`⏱️  Waiting ${Math.round(delay / 1000 / 60)} minutes before next message...`)
          await this.sleep(delay)
        }

      } catch (error) {
        result.totalFailed++
        result.errors.push({
          phoneNumber: recipient.phoneNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        console.error(`Error processing ${recipient.phoneNumber}:`, error)
      }
    }

    result.duration = Date.now() - startTime
    result.success = result.totalFailed === 0

    // Final progress update
    const finalProgress: BatchProgress = {
      totalCount: recipients.length,
      sentCount: result.totalSent,
      failedCount: result.totalFailed,
      currentStatus: 'completed'
    }
    progressCallback?.(finalProgress)

    console.log(`Batch processing completed: ${result.totalSent} sent, ${result.totalFailed} failed in ${Math.round(result.duration / 1000 / 60)} minutes`)
    
    return result
  }

  /**
   * Prepare recipients by validating data and enriching with submission details
   */
  private static async prepareRecipients(recipients: BatchRecipient[]): Promise<BatchRecipient[]> {
    const prepared: BatchRecipient[] = []

    for (const recipient of recipients) {
      try {
        if (recipient.reminderType === 'first_message') {
          // For first messages, we don't need existing submissions
          prepared.push(recipient)
        } else {
          // For regular reminders, get the submission data
          const submissions = await SupabaseService.getAllSubmissions()
          const submission = submissions.find(s => 
            s.phone_number === recipient.phoneNumber && 
            s.form_type === recipient.formType
          )

          if (submission) {
            prepared.push({
              ...recipient,
              submission
            })
          } else {
            console.warn(`No submission found for ${recipient.phoneNumber} (${recipient.formType})`)
          }
        }
      } catch (error) {
        console.error(`Error preparing recipient ${recipient.phoneNumber}:`, error)
      }
    }

    return prepared
  }

  /**
   * Send a single reminder to a recipient
   */
  private static async sendSingleReminder(recipient: BatchRecipient): Promise<{success: boolean, error?: string}> {
    try {
      if (recipient.reminderType === 'first_message') {
        // Handle first message (customers without forms)
        const customer = await SupabaseService.getCustomerByPhone(recipient.phoneNumber)
        if (!customer) {
          return { success: false, error: 'Customer not found' }
        }

        // Use the form type label mapping from the existing code
        const formTypeToLabel: Record<string, string> = {
          'זכאי-מגורים': 'מגורים באיזור זכאי',
          'צבא-דרגה': 'צבא- דרגה',
          'צבא-לוחם': 'צבא- לוחם',
          'עבודה-זכאי-שכיר': 'עבודה באיזור זכאי שכיר',
          'עבודה-זכאי-עצמאי': 'עבודה באיזור זכאי עצמאי',
          'תלמיד-סטודנט': 'תלמיד / סטודנט',
          'מתנדב': 'מתנדב',
          'חקלאי-עצמאי': 'חקלאי עצמאי',
          'חקלאי-שכיר': 'חקלאי שכיר',
          'חקלאי-דרגה-ראשונה': 'חקלאי דרגה ראשונה',
          'מאבטח': 'מאבטח',
          'מנהל-ביטחון': 'מנהל ביטחון'
        }

        const formLabel = formTypeToLabel[recipient.formType] || 'מגורים באיזור זכאי'
        
        const firstMessageCandidate = {
          customer,
          suggestedFormType: recipient.formType,
          suggestedFormLabel: formLabel
        }

        const success = await ReminderService.sendFirstMessage(firstMessageCandidate)
        return { success }
      } else {
        // Handle regular reminders
        if (!recipient.submission) {
          return { success: false, error: 'No submission data available' }
        }

        const reminderCandidate = {
          submission: recipient.submission,
          reminderType: recipient.reminderType as 'first_message' | 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week',
          daysSinceLastAction: 0 // We'll let the service calculate this
        }

        const success = await ReminderService.sendReminder(reminderCandidate)
        return { success }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Generate random delay between min and max message delays
   */
  private static getRandomDelay(): number {
    const min = this.MIN_MESSAGE_DELAY
    const max = this.MAX_MESSAGE_DELAY
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * Sleep for specified duration
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Estimate remaining time based on current progress
   */
  private static estimateRemainingTime(
    processed: number, 
    total: number, 
    startTime: number,
    additionalDelay: number = 0
  ): number {
    if (processed === 0) return 0
    
    const elapsed = Date.now() - startTime
    const avgTimePerItem = elapsed / processed
    const remaining = total - processed
    
    return Math.round((remaining * avgTimePerItem) + additionalDelay)
  }

  /**
   * Validate recipients array before processing
   */
  static validateRecipients(recipients: BatchRecipient[]): { valid: boolean, errors: string[] } {
    const errors: string[] = []
    
    if (!Array.isArray(recipients)) {
      errors.push('Recipients must be an array')
      return { valid: false, errors }
    }

    if (recipients.length === 0) {
      errors.push('No recipients provided')
      return { valid: false, errors }
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      
      if (!recipient.phoneNumber) {
        errors.push(`Recipient ${i + 1}: Phone number is required`)
      }
      
      if (!recipient.formType) {
        errors.push(`Recipient ${i + 1}: Form type is required`)
      }
      
      if (!recipient.reminderType) {
        errors.push(`Recipient ${i + 1}: Reminder type is required`)
      }
      
      const validReminderTypes = ['first_message', 'first', 'second', 'first_week', 'second_week', 'third_week', 'fourth_week']
      if (recipient.reminderType && !validReminderTypes.includes(recipient.reminderType)) {
        errors.push(`Recipient ${i + 1}: Invalid reminder type '${recipient.reminderType}'`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Estimate total duration for a batch based on recipient count
   */
  static estimateBatchDuration(recipientCount: number): number {
    if (recipientCount === 0) return 0

    // Calculate base time: average delay between messages
    const avgMessageDelay = (this.MIN_MESSAGE_DELAY + this.MAX_MESSAGE_DELAY) / 2
    const totalMessageDelay = (recipientCount - 1) * avgMessageDelay

    // Calculate long breaks: every 20 messages gets a 30-minute break
    const longBreaks = Math.floor((recipientCount - 1) / this.BATCH_SIZE)
    const totalBreakTime = longBreaks * this.BATCH_BREAK_DURATION

    // Add some buffer for processing time (30 seconds per message)
    const processingBuffer = recipientCount * 30 * 1000

    return totalMessageDelay + totalBreakTime + processingBuffer
  }

  /**
   * Analyze batch composition for preview
   */
  static analyzeBatchBreakdown(recipients: BatchRecipient[]): {
    reminderTypes: Record<string, number>
    formTypes: Record<string, number>
    totalMessages: number
  } {
    const reminderTypes: Record<string, number> = {}
    const formTypes: Record<string, number> = {}

    for (const recipient of recipients) {
      // Count by reminder type
      reminderTypes[recipient.reminderType] = (reminderTypes[recipient.reminderType] || 0) + 1
      
      // Count by form type
      formTypes[recipient.formType] = (formTypes[recipient.formType] || 0) + 1
    }

    return {
      reminderTypes,
      formTypes,
      totalMessages: recipients.length
    }
  }
}

// Types are now exported from './supabase' for centralized management