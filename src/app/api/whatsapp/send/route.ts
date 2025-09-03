import { NextRequest, NextResponse } from 'next/server'
import { greenAPI } from '@/lib/green-api'
import { ReminderService } from '@/lib/reminder-service'
import { SupabaseService } from '@/lib/supabase-service'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, message, fileUrl, fileName, caption, formType } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const chatId = greenAPI.formatChatId(phoneNumber)

    let result
    if (fileUrl && fileName) {
      // Send file
      result = await greenAPI.sendFileByUrl(chatId, fileUrl, fileName, caption || message)
    } else if (message) {
      // Send text message
      result = await greenAPI.sendMessage(chatId, message)
    } else {
      return NextResponse.json({ error: 'Message or file is required' }, { status: 400 })
    }

    // Determine message type
    let messageType: 'form_link' | 'manual' = 'manual'
    if (formType) {
      messageType = 'form_link'
    }

    // Log the message
    await SupabaseService.logMessage({
      phone_number: phoneNumber,
      message_type: messageType,
      message_content: message || `File: ${fileName}${caption ? ` - ${caption}` : ''}`,
      form_type: formType,
      sent_successfully: result.success,
      error_message: result.success ? undefined : result.error,
      whatsapp_message_id: result.data?.idMessage
    })

    if (result.success) {
      // If formType is provided, mark form as sent for reminder tracking
      if (formType) {
        await ReminderService.markFormSent(phoneNumber, formType)
      }
      
      return NextResponse.json({ success: true, data: result.data })
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Get account status
    const result = await greenAPI.getStateInstance()
    
    if (result.success) {
      return NextResponse.json({ success: true, data: result.data })
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('Get state error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}