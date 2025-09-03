import { NextRequest, NextResponse } from 'next/server'
import { verificationStorage } from '@/lib/verification-service'
import { AuthService } from '@/lib/auth-service'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, code } = await request.json()

    if (!phoneNumber || !code) {
      return NextResponse.json({
        success: false,
        error: 'Phone number and code are required'
      }, { status: 400 })
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid code format'
      }, { status: 400 })
    }

    // Verify and remove code
    const isValid = verificationStorage.verifyAndRemoveCode(phoneNumber, code)
    
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired verification code'
      }, { status: 400 })
    }

    console.log(`Phone number ${phoneNumber} verified successfully`)

    const response = NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneNumber
    })

    // Set authentication cookie for 90 days
    return AuthService.setAuthCookie(response, phoneNumber)
  } catch (error) {
    console.error('Error in verify-code:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}