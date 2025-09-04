import { NextRequest, NextResponse } from 'next/server'
import { TokenService } from '@/lib/token-service'

export async function POST(request: NextRequest) {
  try {
    // For now, we'll implement basic admin authentication
    // In production, you might want more sophisticated admin auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { phoneNumber, formType, expiryDays, isReusable } = body

    // Validate required fields
    if (!phoneNumber || !formType) {
      return NextResponse.json(
        { success: false, error: 'Phone number and form type are required' },
        { status: 400 }
      )
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+972[5-9]\d{8}$/
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Israeli phone number format' },
        { status: 400 }
      )
    }

    // Create the authorization token
    const tokenData = await TokenService.createAuthToken(
      phoneNumber,
      formType,
      {
        expiryDays: expiryDays || 90,
        isReusable: isReusable || false,
        createdByAdmin: true
      }
    )

    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: 'Failed to create authorization token' },
        { status: 500 }
      )
    }

    // Generate the tokenized URL
    const baseURL = `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const tokenizedURL = TokenService.generateTokenizedURL(
      baseURL,
      phoneNumber,
      formType,
      tokenData.token
    )

    return NextResponse.json({
      success: true,
      data: {
        token: tokenData.token,
        tokenId: tokenData.id,
        expiresAt: tokenData.expires_at,
        isReusable: tokenData.is_reusable,
        tokenizedURL: tokenizedURL
      }
    })

  } catch (error) {
    console.error('Error in create-token API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// For development/testing purposes - simple admin key check
function isValidAdminToken(token: string): boolean {
  // In production, implement proper admin authentication
  // For now, check against an environment variable
  const adminToken = process.env.ADMIN_API_TOKEN
  return !!(adminToken && token === adminToken)
}

// Alternative endpoint with admin key validation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, formType, expiryDays, isReusable, adminKey } = body

    // Simple admin key validation
    if (!adminKey || !isValidAdminToken(adminKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin key' },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!phoneNumber || !formType) {
      return NextResponse.json(
        { success: false, error: 'Phone number and form type are required' },
        { status: 400 }
      )
    }

    // Create the authorization token
    const tokenData = await TokenService.createAuthToken(
      phoneNumber,
      formType,
      {
        expiryDays: expiryDays || 90,
        isReusable: isReusable || false,
        createdByAdmin: true
      }
    )

    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: 'Failed to create authorization token' },
        { status: 500 }
      )
    }

    // Generate the tokenized URL
    const baseURL = `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const tokenizedURL = TokenService.generateTokenizedURL(
      baseURL,
      phoneNumber,
      formType,
      tokenData.token
    )

    return NextResponse.json({
      success: true,
      data: {
        token: tokenData.token,
        tokenId: tokenData.id,
        expiresAt: tokenData.expires_at,
        isReusable: tokenData.is_reusable,
        tokenizedURL: tokenizedURL
      }
    })

  } catch (error) {
    console.error('Error in create-token API (PUT):', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}