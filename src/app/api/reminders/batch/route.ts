import { NextRequest, NextResponse } from 'next/server'
import { BatchReminderService } from '@/lib/batch-reminder-service'
import { BatchRecipient, BatchProgress, BatchResult } from '@/lib/supabase'

interface BatchRequestBody {
  recipients: BatchRecipient[]
  sendImmediately?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: BatchRequestBody = await request.json()
    const { recipients, sendImmediately = true } = body

    // Validate input
    if (!recipients || !Array.isArray(recipients)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Recipients array is required' 
      }, { status: 400 })
    }

    // Validate recipients using the service
    const validation = BatchReminderService.validateRecipients(recipients)
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid recipients data',
        validationErrors: validation.errors
      }, { status: 400 })
    }

    console.log(`Starting batch reminder processing for ${recipients.length} recipients`)

    if (!sendImmediately) {
      // Just validate and return (for future scheduling feature)
      return NextResponse.json({
        success: true,
        message: `Batch of ${recipients.length} reminders validated and scheduled`,
        recipientCount: recipients.length,
        estimatedDuration: BatchReminderService.estimateBatchDuration(recipients.length)
      })
    }

    // Process the batch with progress tracking
    let lastProgress: BatchProgress | null = null
    
    const result: BatchResult = await BatchReminderService.processBatchReminders(
      recipients,
      (progress: BatchProgress) => {
        lastProgress = progress
        console.log(`Batch progress: ${progress.sentCount}/${progress.totalCount} sent, ${progress.failedCount} failed, status: ${progress.currentStatus}`)
      }
    )

    // Return comprehensive result
    const responseData = {
      success: result.success,
      message: result.success 
        ? `Batch completed successfully: ${result.totalSent} sent, ${result.totalFailed} failed`
        : `Batch completed with errors: ${result.totalSent} sent, ${result.totalFailed} failed`,
      results: {
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        totalProcessed: recipients.length,
        durationMinutes: Math.round(result.duration / 1000 / 60),
        successRate: Math.round((result.totalSent / recipients.length) * 100)
      },
      errors: result.errors,
      finalProgress: lastProgress,
      timestamp: new Date().toISOString()
    }

    // Log the completion
    console.log(`Batch reminder processing completed:`, {
      sent: result.totalSent,
      failed: result.totalFailed,
      duration: `${Math.round(result.duration / 1000 / 60)} minutes`,
      successRate: `${responseData.results.successRate}%`
    })

    // Return success even if some messages failed (partial success)
    const httpStatus = result.totalSent > 0 ? 200 : 500
    
    return NextResponse.json(responseData, { status: httpStatus })

  } catch (error) {
    console.error('Batch reminder API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during batch processing',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET endpoint for batch validation/preview
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const recipientsParam = url.searchParams.get('recipients')
    
    if (!recipientsParam) {
      return NextResponse.json({
        success: false,
        error: 'Recipients parameter is required for batch preview'
      }, { status: 400 })
    }

    let recipients: BatchRecipient[]
    try {
      recipients = JSON.parse(decodeURIComponent(recipientsParam))
    } catch (_parseError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON format for recipients parameter'
      }, { status: 400 })
    }

    // Validate the batch
    const validation = BatchReminderService.validateRecipients(recipients)
    
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid recipients data',
        validationErrors: validation.errors
      }, { status: 400 })
    }

    // Calculate batch estimates
    const estimatedDuration = BatchReminderService.estimateBatchDuration(recipients.length)
    const breakdown = BatchReminderService.analyzeBatchBreakdown(recipients)

    return NextResponse.json({
      success: true,
      message: `Batch preview for ${recipients.length} recipients`,
      preview: {
        totalRecipients: recipients.length,
        estimatedDurationMinutes: Math.round(estimatedDuration / 1000 / 60),
        breakdown: breakdown,
        batchCount: Math.ceil(recipients.length / 20), // Number of 20-message batches
        longBreaks: Math.floor(recipients.length / 20), // Number of 30-min breaks
        validationPassed: true
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Batch preview API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during batch preview',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}