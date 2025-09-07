import { randomBytes, createHash } from 'crypto'
import { SupabaseService } from './supabase-service'
import { AuthToken } from './supabase'

export class TokenService {
  private static readonly DEFAULT_EXPIRY_DAYS = 7
  private static readonly TOKEN_LENGTH = 32

  /**
   * Generate a secure random token
   */
  static generateSecureToken(): string {
    const bytes = randomBytes(this.TOKEN_LENGTH)
    return bytes.toString('hex')
  }

  /**
   * Create a hash of the phone number and form type for additional security
   */
  static createTokenHash(phoneNumber: string, formType: string, timestamp: string): string {
    const data = `${phoneNumber}|${formType}|${timestamp}`
    return createHash('sha256').update(data).digest('hex').substring(0, 16)
  }

  /**
   * Generate expiration date
   */
  static generateExpirationDate(days: number = this.DEFAULT_EXPIRY_DAYS): Date {
    const expiration = new Date()
    expiration.setDate(expiration.getDate() + days)
    return expiration
  }

  /**
   * Create an authorization token for a specific phone and form type
   */
  static async createAuthToken(
    phoneNumber: string, 
    formType: string, 
    options: {
      expiryDays?: number
      isReusable?: boolean
      createdByAdmin?: boolean
    } = {}
  ): Promise<AuthToken | null> {
    try {
      const {
        expiryDays = this.DEFAULT_EXPIRY_DAYS,
        isReusable = false,
        createdByAdmin = true
      } = options

      // Generate secure token
      const baseToken = this.generateSecureToken()
      const timestamp = Date.now().toString()
      const hash = this.createTokenHash(phoneNumber, formType, timestamp)
      const finalToken = `${baseToken}_${hash}`

      const expiresAt = this.generateExpirationDate(expiryDays)

      // Store in database
      const tokenData = await SupabaseService.createAuthToken({
        phone_number: phoneNumber,
        form_type: formType,
        token: finalToken,
        expires_at: expiresAt.toISOString(),
        is_reusable: isReusable,
        created_by_admin: createdByAdmin
      })

      return tokenData
    } catch (error) {
      console.error('Error creating auth token:', error)
      return null
    }
  }

  /**
   * Validate a token and return token data if valid
   */
  static async validateToken(token: string): Promise<{
    isValid: boolean
    tokenData: AuthToken | null
    reason?: string
  }> {
    try {
      const tokenData = await SupabaseService.validateAuthToken(token)
      
      if (!tokenData) {
        return {
          isValid: false,
          tokenData: null,
          reason: 'Token not found or expired'
        }
      }

      // Check expiration
      const now = new Date()
      const expiration = new Date(tokenData.expires_at)
      if (now > expiration) {
        return {
          isValid: false,
          tokenData: null,
          reason: 'Token has expired'
        }
      }

      // Check if single-use token was already used
      if (!tokenData.is_reusable && tokenData.used_at) {
        return {
          isValid: false,
          tokenData: null,
          reason: 'Token has already been used'
        }
      }

      return {
        isValid: true,
        tokenData: tokenData
      }
    } catch (error) {
      console.error('Error validating token:', error)
      return {
        isValid: false,
        tokenData: null,
        reason: 'Token validation failed'
      }
    }
  }

  /**
   * Mark token as used (for single-use tokens)
   */
  static async markTokenAsUsed(tokenId: string): Promise<boolean> {
    try {
      return await SupabaseService.markTokenAsUsed(tokenId)
    } catch (error) {
      console.error('Error marking token as used:', error)
      return false
    }
  }

  /**
   * Generate a tokenized URL for forms
   */
  static generateTokenizedURL(
    baseURL: string,
    phoneNumber: string,
    formType: string,
    token: string
  ): string {
    const url = new URL(baseURL)
    // Sanitize phone to avoid duplicated 972 prefixes
    const sanitizedPhone = phoneNumber.trim().replace(/^(?:\+?972)+/, '+972')
    url.searchParams.set('phone', sanitizedPhone)
    url.searchParams.set('type', formType)
    url.searchParams.set('token', token)
    return url.toString()
  }

  /**
   * Clean up expired tokens (utility function for maintenance)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      return await SupabaseService.cleanupExpiredTokens()
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error)
      return 0
    }
  }

  /**
   * Revoke a specific token
   */
  static async revokeToken(tokenId: string): Promise<boolean> {
    try {
      return await SupabaseService.revokeToken(tokenId)
    } catch (error) {
      console.error('Error revoking token:', error)
      return false
    }
  }

  /**
   * Get all tokens for a phone number
   */
  static async getTokensForPhone(phoneNumber: string): Promise<AuthToken[]> {
    try {
      return await SupabaseService.getTokensByPhone(phoneNumber)
    } catch (error) {
      console.error('Error fetching tokens for phone:', error)
      return []
    }
  }

  /**
   * Check if a token is still valid (without detailed validation)
   */
  static isTokenExpired(tokenData: AuthToken): boolean {
    const now = new Date()
    const expiration = new Date(tokenData.expires_at)
    return now > expiration
  }

  /**
   * Check if a token can still be used
   */
  static isTokenUsable(tokenData: AuthToken): boolean {
    if (this.isTokenExpired(tokenData)) {
      return false
    }
    
    // If it's a single-use token and it's been used, it's not usable
    if (!tokenData.is_reusable && tokenData.used_at) {
      return false
    }

    return true
  }
}