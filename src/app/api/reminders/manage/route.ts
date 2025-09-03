import { NextRequest, NextResponse } from 'next/server'
import { ReminderService } from '@/lib/reminder-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, submissionId, phoneNumber, formType } = body

    switch (action) {
      case 'pause':
        if (!submissionId) {
          return NextResponse.json({ error: 'submissionId is required for pause action' }, { status: 400 })
        }
        
        const pauseSuccess = await ReminderService.pauseReminders(submissionId, true)
        return NextResponse.json({
          success: pauseSuccess,
          message: pauseSuccess ? 'Reminders paused successfully' : 'Failed to pause reminders'
        })

      case 'resume':
        if (!submissionId) {
          return NextResponse.json({ error: 'submissionId is required for resume action' }, { status: 400 })
        }
        
        const resumeSuccess = await ReminderService.pauseReminders(submissionId, false)
        return NextResponse.json({
          success: resumeSuccess,
          message: resumeSuccess ? 'Reminders resumed successfully' : 'Failed to resume reminders'
        })

      case 'send-now':
        if (!phoneNumber || !formType) {
          return NextResponse.json({ error: 'phoneNumber and formType are required for send-now action' }, { status: 400 })
        }
        
        // Create a fake candidate to send immediate reminder
        const submissions = await import('@/lib/supabase-service').then(m => m.SupabaseService.getAllSubmissions())
        const submission = submissions.find(s => s.phone_number === phoneNumber && s.form_type === formType)
        
        if (!submission) {
          return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        const sendSuccess = await ReminderService.sendReminder({
          submission,
          reminderType: 'first', // Use first reminder template for manual sends
          daysSinceLastAction: 0
        })

        return NextResponse.json({
          success: sendSuccess,
          message: sendSuccess ? 'Manual reminder sent successfully' : 'Failed to send manual reminder'
        })

      case 'mark-sent':
        if (!phoneNumber || !formType) {
          return NextResponse.json({ error: 'phoneNumber and formType are required for mark-sent action' }, { status: 400 })
        }
        
        await ReminderService.markFormSent(phoneNumber, formType)
        return NextResponse.json({
          success: true,
          message: 'Form marked as sent successfully'
        })

      case 'mark-interaction':
        if (!phoneNumber || !formType) {
          return NextResponse.json({ error: 'phoneNumber and formType are required for mark-interaction action' }, { status: 400 })
        }
        
        await ReminderService.markInteraction(phoneNumber, formType)
        return NextResponse.json({
          success: true,
          message: 'Interaction marked successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Reminder management error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}