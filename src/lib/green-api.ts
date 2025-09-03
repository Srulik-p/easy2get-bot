// Green API WhatsApp Service
interface APIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface NotificationBody {
  typeWebhook?: string;
  senderData?: {
    chatId?: string;
    [key: string]: unknown;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: {
      textMessage?: string;
    };
    fileMessageData?: {
      downloadUrl?: string;
      fileName?: string;
    };
    [key: string]: unknown;
  };
  timestamp?: number;
  [key: string]: unknown;
}

interface ParsedNotification {
  body?: NotificationBody;
  [key: string]: unknown;
}

class GreenAPIService {
  private idInstance: string
  private apiTokenInstance: string
  private baseURL: string

  constructor() {
    this.idInstance = process.env.GREEN_API_ID_INSTANCE || ''
    this.apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE || ''
    this.baseURL = `https://api.green-api.com/waInstance${this.idInstance}`
  }

  // Check if Green API is configured
  private isConfigured(): boolean {
    return !!(this.idInstance && this.apiTokenInstance)
  }

  // Send text message
  async sendMessage(chatId: string, message: string): Promise<APIResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Green API not configured' }
    }

    try {
      const url = `${this.baseURL}/sendMessage/${this.apiTokenInstance}`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      })

      const data = await response.json()

      if (response.ok) {
        return { success: true, data }
      } else {
        return { success: false, error: data.message || 'Failed to send message' }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Send file message
  async sendFileByUrl(
    chatId: string, 
    urlFile: string, 
    fileName: string, 
    caption?: string
  ): Promise<APIResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Green API not configured' }
    }

    try {
      const url = `${this.baseURL}/sendFileByUrl/${this.apiTokenInstance}`
      
      const body: Record<string, unknown> = {
        chatId: chatId,
        urlFile: urlFile,
        fileName: fileName
      }

      if (caption) {
        body.caption = caption
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        return { success: true, data }
      } else {
        return { success: false, error: data.message || 'Failed to send file' }
      }
    } catch (error) {
      console.error('Error sending file:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Get messages from queue (polling)
  async receiveNotification(): Promise<APIResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Green API not configured' }
    }

    try {
      const url = `${this.baseURL}/receiveNotification/${this.apiTokenInstance}`
      
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        return { success: true, data }
      } else {
        return { success: false, error: data.message || 'Failed to receive notification' }
      }
    } catch (error) {
      console.error('Error receiving notification:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Delete message from queue
  async deleteNotification(receiptId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Green API not configured' }
    }

    try {
      const url = `${this.baseURL}/deleteNotification/${this.apiTokenInstance}/${receiptId}`
      
      const response = await fetch(url, {
        method: 'DELETE'
      })

      if (response.ok) {
        return { success: true }
      } else {
        const data = await response.json()
        return { success: false, error: data.message || 'Failed to delete notification' }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Get account info and status
  async getStateInstance(): Promise<APIResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Green API not configured' }
    }

    try {
      const url = `${this.baseURL}/getStateInstance/${this.apiTokenInstance}`
      
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        return { success: true, data }
      } else {
        return { success: false, error: data.message || 'Failed to get state' }
      }
    } catch (error) {
      console.error('Error getting state:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Format phone number to WhatsApp chat ID
  formatChatId(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    
    // Add country code if not present (assuming Israel +972)
    let formattedPhone = cleanPhone
    if (cleanPhone.length === 10 && cleanPhone.startsWith('0')) {
      formattedPhone = '972' + cleanPhone.substring(1)
    } else if (cleanPhone.length === 9) {
      formattedPhone = '972' + cleanPhone
    } else if (!cleanPhone.startsWith('972')) {
      formattedPhone = '972' + cleanPhone
    }
    
    return formattedPhone + '@c.us'
  }

  // Parse incoming message
  parseIncomingMessage(notification: ParsedNotification): {
    type: string
    chatId: string
    phoneNumber: string
    message?: string
    fileName?: string
    fileUrl?: string
    timestamp: number
  } | null {
    try {
      if (!notification?.body) return null

      const { body } = notification
      const chatId = body.senderData?.chatId || ''
      const phoneNumber = chatId.replace('@c.us', '').replace('972', '0')

      const result = {
        type: body.typeWebhook || 'unknown',
        chatId,
        phoneNumber,
        timestamp: body.timestamp || Date.now()
      }

      switch (body.typeWebhook) {
        case 'incomingMessageReceived':
          if (body.messageData?.typeMessage === 'textMessage') {
            return {
              ...result,
              message: body.messageData.textMessageData?.textMessage
            }
          } else if (body.messageData?.typeMessage === 'imageMessage') {
            return {
              ...result,
              fileName: body.messageData.fileMessageData?.fileName,
              fileUrl: body.messageData.fileMessageData?.downloadUrl
            }
          } else if (body.messageData?.typeMessage === 'documentMessage') {
            return {
              ...result,
              fileName: body.messageData.fileMessageData?.fileName,
              fileUrl: body.messageData.fileMessageData?.downloadUrl
            }
          }
          break
      }

      return result
    } catch (error) {
      console.error('Error parsing incoming message:', error)
      return null
    }
  }
}

export const greenAPI = new GreenAPIService()

// Types for better TypeScript support
export interface WhatsAppMessage {
  chatId: string
  phoneNumber: string
  message?: string
  fileName?: string
  fileUrl?: string
  type: 'text' | 'file' | 'image' | 'document'
  timestamp: number
}

export interface SendMessageOptions {
  phoneNumber: string
  message: string
}

export interface SendFileOptions {
  phoneNumber: string
  fileUrl: string
  fileName: string
  caption?: string
}