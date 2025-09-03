import { NextRequest, NextResponse } from 'next/server'
import { greenAPI } from '@/lib/green-api'

import formFieldsData from '@/data/form-fields.json'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('WhatsApp webhook received:', body)

    const parsedMessage = greenAPI.parseIncomingMessage(body)
    if (!parsedMessage) {
      return NextResponse.json({ success: true, message: 'No action needed' })
    }

    const { phoneNumber, message, type } = parsedMessage

    // Handle different message types
    if (type === 'incomingMessageReceived') {
      if (message) {
        await handleTextMessage(phoneNumber, message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleTextMessage(phoneNumber: string, message: string) {
  const lowerMessage = message.toLowerCase().trim()

  // Handle menu command
  if (lowerMessage === 'תפריט' || lowerMessage === 'menu') {
    await sendMenu(phoneNumber)
    return
  }

  // Handle form type selection (by number)
  const formTypeIndex = parseInt(lowerMessage) - 1
  if (!isNaN(formTypeIndex) && formTypeIndex >= 0 && formTypeIndex < formFieldsData.formTypes.length) {
    const selectedFormType = formFieldsData.formTypes[formTypeIndex]
    await sendFormLink(phoneNumber, selectedFormType)
    return
  }

  // Default response
  await sendDefaultResponse(phoneNumber)
}

async function sendMenu(phoneNumber: string) {
  let menuText = '🔸 *בחר סוג הטופס שברצונך למלא:*\n\n'
  
  formFieldsData.formTypes.forEach((formType, index) => {
    menuText += `${index + 1}. ${formType.label}\n`
  })
  
  menuText += '\n💬 *שלח את המספר המתאים לבחירתך*'
  menuText += '\n\n📝 לחזרה לתפריט הראשי שלח: *תפריט*'

  const chatId = greenAPI.formatChatId(phoneNumber)
  await greenAPI.sendMessage(chatId, menuText)
}

async function sendFormLink(phoneNumber: string, formType: { slug: string; label: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const formUrl = `${baseUrl}/${formType.slug}?phone=${encodeURIComponent(phoneNumber)}`
  
  let messageText = `✅ *נבחר: ${formType.label}*\n\n`
  messageText += `🔗 *לחץ על הקישור למילוי הטופס:*\n${formUrl}\n\n`
  messageText += `📱 *או העתק והדבק את הקישור בדפדפן*\n\n`
  messageText += `💬 לחזרה לתפריט הראשי שלח: *תפריט*`

  const chatId = greenAPI.formatChatId(phoneNumber)
  await greenAPI.sendMessage(chatId, messageText)
}

async function sendDefaultResponse(phoneNumber: string) {
  let messageText = '👋 *שלום! ברוכים הבאים למערכת הגשת טפסים*\n\n'
  messageText += '📋 *כדי לקבל רשימת טפסים זמינים שלח:* תפריט\n\n'
  messageText += '🔍 *או בחר מספר טופס ישירות מהרשימה:*\n\n'
  
  formFieldsData.formTypes.forEach((formType, index) => {
    messageText += `${index + 1}. ${formType.label}\n`
  })

  const chatId = greenAPI.formatChatId(phoneNumber)
  await greenAPI.sendMessage(chatId, messageText)
}

// Also handle GET requests for webhook verification (if needed)
export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook endpoint is active' })
}