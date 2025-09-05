import { NextRequest, NextResponse } from 'next/server'
import { ReminderService } from '@/lib/reminder-service'

export async function POST(request: NextRequest) {
  try {
    // Optional: Add basic authentication to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const expectedAuth = process.env.REMINDER_JOB_AUTH_TOKEN
    
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Processing reminder job...')
    const result = await ReminderService.processAllReminders()

    return NextResponse.json({
      success: true,
      message: `Reminder job completed: ${result.sent} sent, ${result.failed} failed`,
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Reminder job error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also allow GET for easy testing
export async function GET() {
  try {
    console.log('Manual reminder check triggered...')
    const candidates = await ReminderService.getCustomersNeedingReminders()
    
    return NextResponse.json({
      success: true,
      message: `Found ${candidates.length} customers needing reminders`,
      candidates: candidates.map(c => ({
        phoneNumber: c.submission.phone_number,
        formType: c.submission.form_type,
        formTypeLabel: c.submission.form_type_label,
        reminderType: c.reminderType,
        daysSinceLastAction: c.daysSinceLastAction,
        reminderCount: c.submission.reminder_count || 0
      })),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Reminder check error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}