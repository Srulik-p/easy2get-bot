export interface ShortUrlResponse {
  success: boolean
  shortUrl?: string
  originalUrl?: string
  error?: string
}

export interface UrlEncodeOptions {
  encodeHebrew?: boolean
  platform?: 'whatsapp' | 'general'
}

export class URLService {
  private static readonly TINYURL_API = 'https://tinyurl.com/api-create.php'
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  /**
   * Encode Hebrew text for WhatsApp URL compatibility
   */
  static encodeHebrewText(text: string, options: UrlEncodeOptions = {}): string {
    const { encodeHebrew = true, platform = 'whatsapp' } = options

    if (!encodeHebrew) {
      return text
    }

    // For WhatsApp, we need to properly encode Hebrew characters
    if (platform === 'whatsapp') {
      // Use encodeURIComponent for proper URL encoding
      return encodeURIComponent(text)
    }

    // For general use, use base64 encoding for Hebrew
    try {
      const buffer = Buffer.from(text, 'utf8')
      return buffer.toString('base64url') // base64url is URL-safe
    } catch (error) {
      console.warn('Failed to encode Hebrew text:', error)
      return encodeURIComponent(text)
    }
  }

  /**
   * Decode Hebrew text from encoded format
   */
  static decodeHebrewText(encodedText: string, options: UrlEncodeOptions = {}): string {
    const { encodeHebrew = true, platform = 'whatsapp' } = options

    if (!encodeHebrew) {
      return encodedText
    }

    try {
      if (platform === 'whatsapp') {
        return decodeURIComponent(encodedText)
      }

      // For base64url encoded text
      const buffer = Buffer.from(encodedText, 'base64url')
      return buffer.toString('utf8')
    } catch (error) {
      console.warn('Failed to decode Hebrew text:', error)
      try {
        return decodeURIComponent(encodedText)
      } catch {
        return encodedText
      }
    }
  }

  /**
   * Create a short URL using TinyURL API
   */
  static async createShortUrl(longUrl: string, alias?: string): Promise<ShortUrlResponse> {
    try {
      // Validate URL
      try {
        new URL(longUrl)
      } catch {
        return {
          success: false,
          error: 'Invalid URL format'
        }
      }

      // Build TinyURL API request
      const apiUrl = new URL(this.TINYURL_API)
      apiUrl.searchParams.set('url', longUrl)
      if (alias) {
        apiUrl.searchParams.set('alias', alias)
      }

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Shimi-Arm-Gun-Bot/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`TinyURL API error: ${response.status}`)
      }

      const shortUrl = await response.text()

      // Check if the response is a valid URL or error message
      if (shortUrl.startsWith('http')) {
        return {
          success: true,
          shortUrl: shortUrl.trim(),
          originalUrl: longUrl
        }
      } else {
        return {
          success: false,
          error: shortUrl.includes('Error') ? shortUrl : 'Failed to create short URL'
        }
      }

    } catch (error) {
      console.error('Error creating short URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }


  /**
   * Generate a WhatsApp-friendly URL with Hebrew text support
   */
  static generateWhatsAppFriendlyUrl(
    baseUrl: string,
    phoneNumber: string,
    formType: string,
    formTypeLabel: string,
    token?: string
  ): string {
    try {
      const url = new URL(baseUrl)
      
      // Add basic parameters
      url.searchParams.set('phone', phoneNumber)
      
      // Encode form type for WhatsApp compatibility
      const encodedFormType = this.encodeHebrewText(formType, { platform: 'whatsapp' })
      url.searchParams.set('type', encodedFormType)
      
      // Add readable form label (encoded)
      const encodedLabel = this.encodeHebrewText(formTypeLabel, { platform: 'whatsapp' })
      url.searchParams.set('label', encodedLabel)
      
      // Add token if provided
      if (token) {
        url.searchParams.set('token', token)
      }

      return url.toString()
    } catch (error) {
      console.error('Error generating WhatsApp-friendly URL:', error)
      // Fallback to simple URL
      return `${baseUrl}?phone=${phoneNumber}&type=${formType}${token ? `&token=${token}` : ''}`
    }
  }

  /**
   * Create a short URL for WhatsApp sharing using TinyURL
   */
  static async createWhatsAppShortUrl(
    baseUrl: string,
    phoneNumber: string,
    formType: string,
    formTypeLabel: string,
    token?: string
  ): Promise<ShortUrlResponse> {
    try {
      // Generate WhatsApp-friendly URL
      const longUrl = this.generateWhatsAppFriendlyUrl(
        baseUrl,
        phoneNumber,
        formType,
        formTypeLabel,
        token
      )

      // Create short URL using TinyURL only
      const shortUrlResult = await this.createShortUrl(longUrl)
      return shortUrlResult

    } catch (error) {
      console.error('Error creating WhatsApp short URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Parse a URL and extract form parameters
   */
  static parseFormUrl(url: string): {
    phoneNumber?: string
    formType?: string
    formTypeLabel?: string
    token?: string
  } {
    try {
      const urlObj = new URL(url)
      const params = urlObj.searchParams

      const result: {
        phoneNumber?: string;
        formType?: string;
        formTypeLabel?: string;
        token?: string;
      } = {}

      if (params.has('phone')) {
        result.phoneNumber = params.get('phone') || undefined
      }

      if (params.has('type')) {
        const encodedType = params.get('type')!
        result.formType = this.decodeHebrewText(encodedType, { platform: 'whatsapp' })
      }

      if (params.has('label')) {
        const encodedLabel = params.get('label')!
        result.formTypeLabel = this.decodeHebrewText(encodedLabel, { platform: 'whatsapp' })
      }

      if (params.has('token')) {
        result.token = params.get('token') || undefined
      }

      return result
    } catch (error) {
      console.error('Error parsing form URL:', error)
      return {}
    }
  }

  /**
   * Validate if a URL is accessible
   */
  static async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      return response.ok
    } catch (error) {
      console.warn('URL validation failed:', error)
      return false
    }
  }

  /**
   * Generate a custom short URL alias based on form type and phone
   */
  static generateCustomAlias(phoneNumber: string, formType: string): string {
    try {
      // Extract last 4 digits of phone
      const phoneDigits = phoneNumber.replace(/\D/g, '').slice(-4)
      
      // Create a short version of form type
      const formShort = formType.split('-')[0].substring(0, 4)
      
      // Combine with timestamp
      const timestamp = Date.now().toString().slice(-6)
      
      return `form_${formShort}_${phoneDigits}_${timestamp}`.toLowerCase()
    } catch (error) {
      // Fallback to timestamp-based alias
      return `form_${Date.now()}`
    }
  }
}