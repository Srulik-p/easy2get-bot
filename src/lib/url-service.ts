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
  private static readonly TINYURL_V1_API = 'https://api.tinyurl.com/create'
  private static readonly ISGD_API = 'https://is.gd/create.php'
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
   * Create a short URL using supported providers. Prefers TinyURL v1 (token),
   * then falls back to is.gd. If all fail, returns failure so caller can use
   * the original URL.
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

      // Try TinyURL v1 (requires token)
      const tinyToken = process.env.TINYURL_API_TOKEN
      if (tinyToken) {
        try {
          const body: { url: string; domain: string; alias?: string } = { url: longUrl, domain: 'tinyurl.com' }
          if (alias) body.alias = alias
          const res = await fetch(this.TINYURL_V1_API, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tinyToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          })
          if (res.ok) {
            const json: { data?: { tiny_url?: string }; tiny_url?: string } = await res.json()
            const tiny = json?.data?.tiny_url || json?.tiny_url
            if (tiny) {
              return { success: true, shortUrl: tiny, originalUrl: longUrl }
            }
          }
        } catch (e) {
          console.warn('TinyURL v1 failed; falling back to is.gd', e)
        }
      }

      // Fallback: is.gd (no token needed)
      try {
        const apiUrl = new URL(this.ISGD_API)
        apiUrl.searchParams.set('format', 'simple')
        apiUrl.searchParams.set('url', longUrl)
        if (alias) apiUrl.searchParams.set('shorturl', alias)

        const response = await fetch(apiUrl.toString(), { method: 'GET' })
        if (response.ok) {
          const text = (await response.text()).trim()
          if (text.startsWith('http')) {
            return { success: true, shortUrl: text, originalUrl: longUrl }
          }
        }
      } catch (e) {
        console.warn('is.gd failed to shorten URL', e)
      }

    } catch (error) {
      console.error('Error creating short URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }

    // Fallback: return failure if all methods fail
    return {
      success: false,
      error: 'All URL shortening methods failed',
      originalUrl: longUrl
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
   * Create a short URL for WhatsApp sharing using supported providers
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

      // Create short URL using providers (TinyURL v1 -> is.gd)
      const shortUrlResult = await this.createShortUrl(longUrl)
      if (shortUrlResult.success) {
        return shortUrlResult
      }

      // Graceful fallback: return original URL when shortening fails
      console.warn('Shortening failed, falling back to original URL:', shortUrlResult.error)
      return {
        success: true,
        shortUrl: longUrl,
        originalUrl: longUrl,
        error: shortUrlResult.error
      }

    } catch (error) {
      console.error('Error creating WhatsApp short URL:', error)
      return {
        // Fallback to original URL on unexpected errors
        success: true,
        shortUrl: `${baseUrl}?phone=${phoneNumber}&type=${formType}${token ? `&token=${token}` : ''}`,
        originalUrl: `${baseUrl}?phone=${phoneNumber}&type=${formType}${token ? `&token=${token}` : ''}`,
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
    } catch (_error) {
      // Fallback to timestamp-based alias
      return `form_${Date.now()}`
    }
  }
}