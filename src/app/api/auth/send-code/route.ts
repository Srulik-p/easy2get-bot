import { NextRequest, NextResponse } from 'next/server'
import { greenAPI } from '@/lib/green-api'
import { verificationStorage } from '@/lib/verification-service'
import { SupabaseService } from '@/lib/supabase-service'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({
        success: false,
        error: 'Phone number is required'
      }, { status: 400 })
    }

    // Validate Israeli phone number format
    const phoneRegex = /^\+972[5-9]\d{8}$/
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Israeli phone number format'
      }, { status: 400 })
    }

    // Generate and store verification code
    const code = verificationStorage.generateCode()
    verificationStorage.storeCode(phoneNumber, code, 10) // 10 minutes

    // Send verification code via WhatsApp
    const chatId = greenAPI.formatChatId(phoneNumber)
    const message = `קוד האימות שלך: ${code}\n\nהקוד תקף ל-10 דקות.\n\nאל תשתף את הקוד עם אף אחד! 🔒`

    const result = await greenAPI.sendMessage(chatId, message)

    // Log the verification code message
    await SupabaseService.logMessage({
      phone_number: phoneNumber,
      message_type: 'verification_code',
      message_content: message,
      sent_successfully: result.success,
      error_message: result.success ? undefined : result.error,
      whatsapp_message_id: result.data && typeof result.data === 'object' && 'idMessage' in result.data ? String(result.data.idMessage) : undefined
    })

    if (result.success) {
      console.log(`Verification code sent to ${phoneNumber}`)
      
      return NextResponse.json({
        success: true,
        message: 'Verification code sent successfully',
        // Only include code in development mode
        ...(process.env.NODE_ENV === 'development' && { code })
      })
    } else {
      console.error(`Failed to send verification code to ${phoneNumber}:`, result.error)
      return NextResponse.json({
        success: false,
        error: 'Failed to send verification code'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in send-code:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}