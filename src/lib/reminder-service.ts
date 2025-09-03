import { SupabaseService } from './supabase-service'
import { greenAPI } from './green-api'
import { CustomerSubmission } from './supabase'
import formFieldsData from '@/data/form-fields.json'
import fs from 'fs'
import path from 'path'

interface ReminderCandidate {
  submission: CustomerSubmission
  reminderType: 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week'
  daysSinceLastAction: number
}

interface MessageTemplates {
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
    first: 'שלום {customerName}! 👋\n\nשלחנו לך טופס "{formLabel}" לפני יומיים.\n\n📋 זה לוקח רק כמה דקות למלא\n\nצריך עזרה? פשוט תשלח הודעה!',
    second: 'היי {customerName}! 😊\n\nעדיין לא מילאת את טופס "{formLabel}"?\n\n⏰ אנחנו כאן לעזור אם יש שאלות\n📞 צור קשר ונסביר איך למלא',
    first_week: 'תזכורת שבועית ראשונה {customerName} 📅\n\nטופס "{formLabel}" שלך עדיין מחכה!\n\n💬 יש בעיה טכנית? שאלות?\nאנחנו כאן לעזור',
    second_week: 'תזכורת שבועית שנייה {customerName} 🔔\n\nטופס "{formLabel}" - זה הזמן להשלים!\n\n📞 צריך עזרה? צור קשר ונסביר',
    third_week: 'תזכורת שבועית שלישית {customerName} ⏰\n\nעדיין לא השלמת את טופס "{formLabel}"?\n\n🤝 אנחנו כאן לסייע בכל שאלה',
    fourth_week: 'תזכורת אחרונה {customerName} 🚨\n\nטופס "{formLabel}" מחכה כבר חודש!\n\n📋 בוא נסיים את זה יחד - צור קשר'
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

  // Get customers who need reminders
  static async getCustomersNeedingReminders(): Promise<ReminderCandidate[]> {
    try {
      const submissions = await SupabaseService.getAllSubmissions()
      const candidates: ReminderCandidate[] = []
      const now = new Date()

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
        const lastReminderAt = submission.last_reminder_sent_at ? new Date(submission.last_reminder_sent_at) : null

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
  ): 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week' | null {
    
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
      const message = this.getReminderMessage(reminderType, submission)
      const chatId = greenAPI.formatChatId(submission.phone_number)

      // Send WhatsApp message
      const result = await greenAPI.sendMessage(chatId, message)
      
      // Log the reminder message
      await SupabaseService.logMessage({
        phone_number: submission.phone_number,
        message_type: `reminder_${reminderType}` as any,
        message_content: message,
        form_type: submission.form_type,
        form_type_label: submission.form_type_label,
        reminder_type: reminderType,
        sent_successfully: result.success,
        error_message: result.success ? undefined : result.error,
        whatsapp_message_id: result.data?.idMessage
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
  private static getReminderMessage(reminderType: 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week', submission: CustomerSubmission): string {
    const formLabel = submission.form_type_label
    const customerName = this.getCustomerName(submission)
    const templates = this.loadMessageTemplates()

    let template: string
    switch (reminderType) {
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
  }

  // Get customer name with fallback
  private static getCustomerName(submission: CustomerSubmission): string {
    if (submission.name && submission.family_name) {
      return `${submission.name} ${submission.family_name}`
    } else if (submission.name) {
      return submission.name
    } else if (submission.family_name) {
      return submission.family_name
    } else {
      return 'לקוח יקר' // "Dear customer" fallback
    }
  }

  // Update reminder tracking in database
  private static async updateReminderTracking(submissionId: string, reminderType: 'first' | 'second' | 'first_week' | 'second_week' | 'third_week' | 'fourth_week'): Promise<void> {
    try {
      const updates: any = {
        last_reminder_sent_at: new Date().toISOString()
      }

      // Set reminder count based on type
      if (reminderType === 'first') {
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
}