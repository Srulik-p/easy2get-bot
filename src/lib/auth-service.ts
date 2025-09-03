import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE_NAME = 'shimi_phone_auth'
const AUTH_EXPIRY_DAYS = 90

export interface AuthData {
  phoneNumber: string
  verifiedAt: string
  expiresAt: string
}

export class AuthService {
  // Set authentication cookie (for API routes)
  static setAuthCookie(response: NextResponse, phoneNumber: string): NextResponse {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + (AUTH_EXPIRY_DAYS * 24 * 60 * 60 * 1000))
    
    const authData: AuthData = {
      phoneNumber,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    }

    response.cookies.set(AUTH_COOKIE_NAME, JSON.stringify(authData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    return response
  }

  // Get authentication from cookie (for API routes)
  static getAuthFromCookie(request: NextRequest): AuthData | null {
    try {
      const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
      if (!authCookie) return null

      const authData: AuthData = JSON.parse(authCookie.value)
      
      // Check if expired
      if (new Date() > new Date(authData.expiresAt)) {
        return null
      }

      return authData
    } catch (error) {
      console.error('Error parsing auth cookie:', error)
      return null
    }
  }

  // Clear authentication cookie
  static clearAuthCookie(response: NextResponse): NextResponse {
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  // Client-side methods for components
  static setClientAuth(phoneNumber: string): void {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + (AUTH_EXPIRY_DAYS * 24 * 60 * 60 * 1000))
    
    const authData: AuthData = {
      phoneNumber,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    }

    // Set client-side cookie (accessible to JavaScript)
    document.cookie = `${AUTH_COOKIE_NAME}_client=${JSON.stringify(authData)}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  }

  static getClientAuth(): AuthData | null {
    try {
      if (typeof window === 'undefined') return null
      
      const cookies = document.cookie.split(';')
      const authCookie = cookies.find(cookie => 
        cookie.trim().startsWith(`${AUTH_COOKIE_NAME}_client=`)
      )
      
      if (!authCookie) return null

      const authValue = authCookie.split('=')[1]
      const authData: AuthData = JSON.parse(decodeURIComponent(authValue))
      
      // Check if expired
      if (new Date() > new Date(authData.expiresAt)) {
        this.clearClientAuth()
        return null
      }

      return authData
    } catch (error) {
      console.error('Error getting client auth:', error)
      return null
    }
  }

  static clearClientAuth(): void {
    if (typeof window === 'undefined') return
    
    document.cookie = `${AUTH_COOKIE_NAME}_client=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  }

  static isPhoneVerified(phoneNumber: string): boolean {
    const auth = this.getClientAuth()
    return auth !== null && auth.phoneNumber === phoneNumber
  }
}