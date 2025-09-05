import { SupabaseService } from './supabase-service'
import { greenAPI } from './green-api'
import { CustomerSubmission, MessageLog } from './supabase'
import formFieldsData from '@/data/form-fields.json'
import fs from 'fs'
import path from 'path'

interface ReminderCandidate {
  submission: CustomerSubmission
  reminderType: 'first_message' | 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week'
  daysSinceLastAction: number
}

interface FirstMessageCandidate {
  customer: import('./supabase').Customer
  suggestedFormType: string
  suggestedFormLabel: string
}

interface MessageTemplates {
  first_message: string
  first: string
  second: string
  first_week: string
  second_week: string
  third_week: string
  fourth_week: string
}

export class ReminderService {
  
  // Timeline constants (in hours)
  static readonly FIRST_REMINDER_HOURS = 48  // 2 days
  static readonly SECOND_REMINDER_HOURS = 72 // 3 days after first reminder
  static readonly WEEKLY_REMINDER_HOURS = 168 // 7 days
  static readonly MAX_INACTIVE_DAYS = 30 // Stop after 30 days of inactivity

  // Default templates (fallback)
  private static readonly DEFAULT_TEMPLATES: MessageTemplates = {
    first_message: 'שלום {customerName}! 👋\n\nבהמשך לשיחתינו ועל מנת שנוכל לקדם את הבקשה שלך מול המשרד לביטחון פנים יש להמציא את המסמכים המופרטים ברשימה הבאה:\n\n{formLink}\n\nבברכה, Easy2Get',
    first: 'שלום {customerName}! 👋\n\nשלחנו לך טופס "{formLabel}" לפני יומיים.\n\n📋 זה לוקח רק כמה דקות למלא\n\nצריך עזרה? פשוט תשלח הודעה!',
    second: 'היי {customerName}! 😊\n\nעדיין לא מילאת את טופס "{formLabel}"?\n\n⏰ אנחנו כאן לעזור אם יש שאלות\n📞 צור קשר ונסביר איך למלא',
    first_week: 'תזכורת שבועית ראשונה {customerName} 📅\n\nטופס "{formLabel}" שלך עדיין מחכה!\n\n💬 יש בעיה טכנית? שאלות?\nאנחנו כאן לעזור',
    second_week: 'תזכורת שבועית שנייה {customerName} 🔔\n\nטופס "{formLabel}" - זה הזמן להשלים!\n\n📞 צריך עזרה? צור קשר ונסביר',
    third_week: 'תזכורת שבועית שלישית {customerName} ⏰\n\nעדיין לא השלמת את טופס "{formLabel}"?\n\n🤝 אנחנו כאן לסייע בכל שאלה',
    fourth_week: 'תזכורת אחרונה {customerName} 🚨\n\nטופس "{formLabel}" מחכה כבר חודש!\n\n📋 בוא נסיים את זה יחד - צור קשר'
  }

  // Load message templates from file
  private static loadMessageTemplates(): MessageTemplates {
    try {
      const templatesFile = path.join(process.cwd(), 'data/reminder-templates.json')
      if (fs.existsSync(templatesFile)) {
        const data = fs.readFileSync(templatesFile, 'utf8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('Error loading message templates:', error)
    }
    return this.DEFAULT_TEMPLATES
  }

  // Get customers who need reminders (including first messages)
  static async getCustomersNeedingReminders(): Promise<ReminderCandidate[]> {
    try {
      const submissions = await SupabaseService.getAllSubmissions()
      const candidates: ReminderCandidate[] = []
      const now = new Date()

      // Handle existing submissions
      for (const submission of submissions) {
        // Skip if reminders are paused or form is completed
        if (submission.reminder_paused || this.isFormCompleted(submission)) {
          continue
        }

        // Skip if no first_sent_at (form never sent)
        if (!submission.first_sent_at) {
          continue
        }

        const firstSentAt = new Date(submission.first_sent_at)
        const lastInteractionAt = submission.last_interaction_at ? new Date(submission.last_interaction_at) : firstSentAt

        // Calculate time since last interaction
        const hoursSinceLastAction = (now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60)
        const daysSinceLastAction = Math.floor(hoursSinceLastAction / 24)

        // Stop if inactive too long
        if (daysSinceLastAction > this.MAX_INACTIVE_DAYS) {
          continue
        }

        // Determine reminder type needed
        const reminderType = this.determineReminderType(submission, now)
        if (reminderType) {
          candidates.push({
            submission,
            reminderType,
            daysSinceLastAction
          })
        }
      }

      // Handle customers without forms (first message candidates)
      const customersWithoutForms = await this.getCustomersWithoutForms()
      for (const firstMsgCandidate of customersWithoutForms) {
        // Create a mock submission for the first message candidate
        const mockSubmission: CustomerSubmission = {
          customer_id: firstMsgCandidate.customer.id,
          phone_number: firstMsgCandidate.customer.phone_number,
          form_type: firstMsgCandidate.suggestedFormType,
          form_type_label: firstMsgCandidate.suggestedFormLabel,
          submitted_fields: [],
          status: 'new',
          reminder_count: 0,
          reminder_paused: false
        }

        candidates.push({
          submission: mockSubmission,
          reminderType: 'first_message',
          daysSinceLastAction: 0 // New customers don't have previous actions
        })
      }

      return candidates
    } catch (error) {
      console.error('Error getting customers needing reminders:', error)
      return []
    }
  }

  // Determine what type of reminder is needed, if any
  private static determineReminderType(
    submission: CustomerSubmission, 
    now: Date
  ): 'first_message' | 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week' | null {
    
    const firstSentAt = new Date(submission.first_sent_at!)
    const lastInteractionAt = submission.last_interaction_at ? new Date(submission.last_interaction_at) : firstSentAt
    const lastReminderAt = submission.last_reminder_sent_at ? new Date(submission.last_reminder_sent_at) : null

    const hoursSinceFirstSent = (now.getTime() - firstSentAt.getTime()) / (1000 * 60 * 60)
    const hoursSinceLastInteraction = (now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60)
    const hoursSinceLastReminder = lastReminderAt ? (now.getTime() - lastReminderAt.getTime()) / (1000 * 60 * 60) : Infinity

    // First reminder: 48 hours after first sent, no reminders sent yet
    if (submission.reminder_count === 0 && hoursSinceFirstSent >= this.FIRST_REMINDER_HOURS) {
      return 'first'
    }

    // Second reminder: 72 hours after last reminder or interaction (whichever is more recent)
    if (submission.reminder_count === 1 && 
        hoursSinceLastReminder >= this.SECOND_REMINDER_HOURS && 
        hoursSinceLastInteraction >= this.SECOND_REMINDER_HOURS) {
      return 'second'
    }

    // Weekly reminders: after second reminder, send weekly variants
    if (submission.reminder_count >= 2 && 
        hoursSinceLastReminder >= this.WEEKLY_REMINDER_HOURS &&
        hoursSinceLastInteraction >= this.WEEKLY_REMINDER_HOURS) {
      
      // Determine which weekly reminder based on count
      const weeklyReminderCount = submission.reminder_count - 2 + 1; // Start from week 1 after second reminder
      
      if (weeklyReminderCount === 1) return 'first_week'
      if (weeklyReminderCount === 2) return 'second_week' 
      if (weeklyReminderCount === 3) return 'third_week'
      if (weeklyReminderCount >= 4) return 'fourth_week'
    }

    return null
  }

  // Check if form is completed
  private static isFormCompleted(submission: CustomerSubmission): boolean {
    const formType = formFieldsData.formTypes.find(ft => ft.slug === submission.form_type)
    if (!formType) return false
    
    const totalFields = formType.fields.filter(f => !f.isSection).length
    const submittedFields = submission.submitted_fields.length
    
    return submittedFields === totalFields
  }

  // Send reminder to customer
  static async sendReminder(candidate: ReminderCandidate): Promise<boolean> {
    try {
      const { submission, reminderType } = candidate

      // Handle first_message differently
      if (reminderType === 'first_message') {
        // For first messages, we need to create the actual submission and send via sendFirstMessage
        const firstMsgCandidate: FirstMessageCandidate = {
          customer: { 
            id: submission.customer_id,
            phone_number: submission.phone_number,
            status: 'new_lead'
          } as import('./supabase').Customer,
          suggestedFormType: submission.form_type,
          suggestedFormLabel: submission.form_type_label
        }
        return await this.sendFirstMessage(firstMsgCandidate)
      }

      // Handle regular reminders
      const message = this.getReminderMessage(reminderType, submission)
      const chatId = greenAPI.formatChatId(submission.phone_number)

      // Send WhatsApp message
      const result = await greenAPI.sendMessage(chatId, message)
      
      // Log the reminder message
      await SupabaseService.logMessage({
        phone_number: submission.phone_number,
        message_type: `reminder_${reminderType}` as MessageLog['message_type'],
        message_content: message,
        form_type: submission.form_type,
        form_type_label: submission.form_type_label,
        reminder_type: reminderType,
        sent_successfully: result.success,
        error_message: result.success ? undefined : result.error,
        whatsapp_message_id: result.data && typeof result.data === 'object' && 'idMessage' in result.data ? String(result.data.idMessage) : undefined
      })
      
      if (result.success) {
        // Update reminder tracking in database
        await this.updateReminderTracking(submission.id!, reminderType)
        console.log(`Reminder sent to ${submission.phone_number}: ${reminderType}`)
        return true
      } else {
        console.error(`Failed to send reminder to ${submission.phone_number}:`, result.error)
        return false
      }
    } catch (error) {
      console.error('Error sending reminder:', error)
      return false
    }
  }

  // Get reminder message based on type
  private static getReminderMessage(reminderType: 'first_message' | 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week', submission: CustomerSubmission, formLink?: string): string {
    const formLabel = submission.form_type_label
    const customerName = this.getCustomerName(submission)
    const templates = this.loadMessageTemplates()

    let template: string
    switch (reminderType) {
      case 'first_message':
        template = templates.first_message
        break
      case 'first':
        template = templates.first
        break
      case 'second':
        template = templates.second
        break
      case 'first_week':
        template = templates.first_week
        break
      case 'second_week':
        template = templates.second_week
        break
      case 'third_week':
        template = templates.third_week
        break
      case 'fourth_week':
        template = templates.fourth_week
        break
      default:
        template = templates.first // fallback
    }

    // Replace placeholders
    return template
      .replace(/{formLabel}/g, formLabel)
      .replace(/{customerName}/g, customerName)
      .replace(/{formLink}/g, formLink || '')
  }

  // Get customer name with fallback
  private static getCustomerName(_submission: CustomerSubmission): string {
    return 'לקוח יקר' // "Dear customer" fallback
  }

  // Update reminder tracking in database
  private static async updateReminderTracking(submissionId: string, reminderType: 'first_message' | 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week'): Promise<void> {
    try {
      const updates: Partial<CustomerSubmission> = {
        last_reminder_sent_at: new Date().toISOString()
      }

      // Set reminder count based on type
      if (reminderType === 'first_message') {
        updates.reminder_count = 0 // first_message doesn't increment reminder count
      } else if (reminderType === 'first') {
        updates.reminder_count = 1
      } else if (reminderType === 'second') {
        updates.reminder_count = 2
      } else {
        // For weekly reminders, increment the count
        const submission = await SupabaseService.getAllSubmissions()
        const currentSubmission = submission.find(s => s.id === submissionId)
        if (currentSubmission) {
          updates.reminder_count = currentSubmission.reminder_count + 1
        }
      }

      await SupabaseService.updateSubmissionReminderTracking(submissionId, updates)
    } catch (error) {
      console.error('Error updating reminder tracking:', error)
    }
  }

  // Process all pending reminders
  static async processAllReminders(): Promise<{sent: number, failed: number}> {
    const candidates = await this.getCustomersNeedingReminders()
    let sent = 0
    let failed = 0

    console.log(`Found ${candidates.length} customers needing reminders`)

    for (const candidate of candidates) {
      const success = await this.sendReminder(candidate)
      if (success) {
        sent++
      } else {
        failed++
      }

      // Add small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`Reminder processing complete: ${sent} sent, ${failed} failed`)
    return { sent, failed }
  }

  // Mark form as sent (called when admin sends form link)
  static async markFormSent(phoneNumber: string, formType: string): Promise<void> {
    try {
      const submissions = await SupabaseService.getAllSubmissions()
      const submission = submissions.find(s => s.phone_number === phoneNumber && s.form_type === formType)
      
      if (submission && !submission.first_sent_at) {
        await SupabaseService.updateSubmissionSentTracking(submission.id!, new Date().toISOString())
        console.log(`Marked form as sent: ${phoneNumber} - ${formType}`)
      }
    } catch (error) {
      console.error('Error marking form as sent:', error)
    }
  }

  // Mark interaction (called when customer uploads file or interacts with form)
  static async markInteraction(phoneNumber: string, formType: string): Promise<void> {
    try {
      const submissions = await SupabaseService.getAllSubmissions()
      const submission = submissions.find(s => s.phone_number === phoneNumber && s.form_type === formType)
      
      if (submission) {
        await SupabaseService.updateSubmissionInteractionTracking(submission.id!, new Date().toISOString())
        console.log(`Marked interaction: ${phoneNumber} - ${formType}`)
      }
    } catch (error) {
      console.error('Error marking interaction:', error)
    }
  }

  // Pause/resume reminders for a customer
  static async pauseReminders(submissionId: string, paused: boolean): Promise<boolean> {
    try {
      return await SupabaseService.updateSubmissionReminderPause(submissionId, paused)
    } catch (error) {
      console.error('Error pausing/resuming reminders:', error)
      return false
    }
  }

  // Map customer criterion to form type (using Hebrew slugs from form-fields.json)
  private static mapCriterionToFormType(criterion?: import('./supabase').CustomerCriterion): {formType: string, formLabel: string} {
    const mapping: Record<string, {formType: string, formLabel: string}> = {
      'זכאי-מגורים': {formType: 'זכאי-מגורים', formLabel: 'מגורים באיזור זכאי'},
      'צבא-דרגה': {formType: 'צבא-דרגה', formLabel: 'צבא- דרגה'},
      'צבא-לוחם': {formType: 'צבא-לוחם', formLabel: 'צבא- לוחם'},
      'איזור-עבודה-שכיר': {formType: 'עבודה-זכאי-שכיר', formLabel: 'עבודה באיזור זכאי שכיר'},
      'איזור-עבודה-עצמאי': {formType: 'עבודה-זכאי-עצמאי', formLabel: 'עבודה באיזור זכאי עצמאי'},
      'איזור-לימודים': {formType: 'תלמיד-סטודנט', formLabel: 'תלמיד / סטודנט'},
      'מתנדב': {formType: 'מתנדב', formLabel: 'מתנדב'},
      'חקלאי-עצמאי': {formType: 'חקלאי-עצמאי', formLabel: 'חקלאי עצמאי'},
      'חקלאי-שכיר': {formType: 'חקלאי-שכיר', formLabel: 'חקלאי שכיר'},
      'חקלאי-דרגה-ראשונה': {formType: 'חקלאי-דרגה-ראשונה', formLabel: 'חקלאי דרגה ראשונה'},
      'מאבטח': {formType: 'מאבטח', formLabel: 'מאבטח'},
      'מנהל-ביטחון': {formType: 'מנהל-ביטחון', formLabel: 'מנהל ביטחון'}
    }
    
    // Default to residential form if no mapping found
    return mapping[criterion || ''] || {formType: 'זכאי-מגורים', formLabel: 'מגורים באיזור זכאי'}
  }

  // Get customers without any form submissions
  static async getCustomersWithoutForms(): Promise<FirstMessageCandidate[]> {
    try {
      const customers = await SupabaseService.getAllCustomers()
      const submissions = await SupabaseService.getAllSubmissions()
      
      const customersWithoutForms: FirstMessageCandidate[] = []
      
      for (const customer of customers) {
        // Check if customer has any submissions
        const hasSubmissions = submissions.some(sub => sub.phone_number === customer.phone_number)
        
        if (!hasSubmissions) {
          const mapping = this.mapCriterionToFormType(customer.criterion)
          customersWithoutForms.push({
            customer,
            suggestedFormType: mapping.formType,
            suggestedFormLabel: mapping.formLabel
          })
        }
      }
      
      return customersWithoutForms
    } catch (error) {
      console.error('Error getting customers without forms:', error)
      return []
    }
  }

  // Generate auth token and short URL for first message
  private static async generateFirstMessageLink(phoneNumber: string, formType: string, formLabel: string): Promise<string | null> {
    try {
      // Format phone number for token service
      const cleanPhone = phoneNumber.replace(/\D/g, '')
      const formattedPhone = cleanPhone.startsWith('0') 
        ? `+972${cleanPhone.substring(1)}` 
        : `+972${cleanPhone}`

      // Step 1: Create auth token directly using TokenService
      const { TokenService } = await import('./token-service')
      const tokenData = await TokenService.createAuthToken(formattedPhone, formType, {
        expiryDays: 90,
        isReusable: true,
        createdByAdmin: true
      })

      if (!tokenData) {
        console.error('Failed to create auth token')
        return null
      }

      // Step 2: Create short URL using the same approach as the customer page
      // Use the URL shortening API with proper parameters
      const baseURL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      console.log('Using baseURL for first message:', baseURL)
      console.log('Making URL shortening request with params:', {
        phoneNumber,
        formType,
        formTypeLabel: formLabel,
        token: tokenData.token
      })
      
      try {
        const shortUrlResponse = await fetch(`${baseURL}/api/urls/shorten`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phoneNumber, // Use original phone (not formatted)
            formType: formType,
            formTypeLabel: formLabel,
            token: tokenData.token
          })
        })
        
        console.log('Short URL response status:', shortUrlResponse.status)

        if (shortUrlResponse.ok) {
          const shortData = await shortUrlResponse.json()
          console.log('Short URL API response data:', shortData)
          if (shortData.success) {
            console.log('✅ Created short URL for first message:', shortData.shortUrl)
            return shortData.shortUrl
          } else {
            console.error('❌ Short URL creation failed:', shortData.error)
            // Fallback: generate tokenized URL manually
            const fallbackUrl = TokenService.generateTokenizedURL(baseURL, phoneNumber, formType, tokenData.token)
            console.log('⚠️ Using fallback tokenized URL:', fallbackUrl)
            return fallbackUrl
          }
        } else {
          const errorText = await shortUrlResponse.text()
          console.error('❌ Short URL API error:', shortUrlResponse.status, errorText)
          // Fallback: generate tokenized URL manually
          const fallbackUrl = TokenService.generateTokenizedURL(baseURL, phoneNumber, formType, tokenData.token)
          console.log('⚠️ Using fallback tokenized URL:', fallbackUrl)
          return fallbackUrl
        }
      } catch (urlError) {
        console.error('Error creating short URL:', urlError)
        // Fallback: generate tokenized URL manually
        const fallbackUrl = TokenService.generateTokenizedURL(baseURL, phoneNumber, formType, tokenData.token)
        console.log('Using fallback tokenized URL:', fallbackUrl)
        return fallbackUrl
      }
    } catch (error) {
      console.error('Error generating first message link:', error)
      return null
    }
  }

  // Send first message to customer without forms
  static async sendFirstMessage(candidate: FirstMessageCandidate): Promise<boolean> {
    try {
      const { customer, suggestedFormType, suggestedFormLabel } = candidate

      // Generate the tokenized short URL
      const formLink = await this.generateFirstMessageLink(customer.phone_number, suggestedFormType, suggestedFormLabel)
      if (!formLink) {
        console.error('Failed to generate form link for first message')
        return false
      }

      // Create submission entry in database first
      const submission = await SupabaseService.getOrCreateSubmission(
        customer.phone_number,
        suggestedFormType,
        suggestedFormLabel
      )

      if (!submission) {
        console.error('Failed to create submission for first message')
        return false
      }

      // Mark as sent and get the message
      await SupabaseService.updateSubmissionSentTracking(submission.id!, new Date().toISOString())
      const message = this.getReminderMessage('first_message', submission, formLink)
      const chatId = greenAPI.formatChatId(customer.phone_number)

      // Send WhatsApp message
      const result = await greenAPI.sendMessage(chatId, message)
      
      // Log the message
      await SupabaseService.logMessage({
        customer_id: customer.id,
        phone_number: customer.phone_number,
        message_type: 'form_link',
        message_content: message,
        form_type: suggestedFormType,
        form_type_label: suggestedFormLabel,
        sent_successfully: result.success,
        error_message: result.success ? undefined : result.error,
        whatsapp_message_id: result.data && typeof result.data === 'object' && 'idMessage' in result.data ? String(result.data.idMessage) : undefined
      })
      
      if (result.success) {
        console.log(`First message sent to ${customer.phone_number}: ${suggestedFormLabel}`)
        return true
      } else {
        console.error(`Failed to send first message to ${customer.phone_number}:`, result.error)
        return false
      }
    } catch (error) {
      console.error('Error sending first message:', error)
      return false
    }
  }
}