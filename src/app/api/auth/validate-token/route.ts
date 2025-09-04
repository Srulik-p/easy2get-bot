import { NextRequest, NextResponse } from 'next/server'
import { TokenService } from '@/lib/token-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token parameter is required' },
        { status: 400 }
      )
    }

    // Validate the token
    const validation = await TokenService.validateToken(token)

    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: validation.reason || 'Invalid token',
          isValid: false
        },
        { status: 401 }
      )
    }

    // Return token information without sensitive data
    return NextResponse.json({
      success: true,
      isValid: true,
      data: {
        phoneNumber: validation.tokenData!.phone_number,
        formType: validation.tokenData!.form_type,
        expiresAt: validation.tokenData!.expires_at,
        isReusable: validation.tokenData!.is_reusable,
        createdAt: validation.tokenData!.created_at
      }
    })

  } catch (error) {
    console.error('Error in validate-token API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, markAsUsed } = body

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    // Validate the token
    const validation = await TokenService.validateToken(token)

    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: validation.reason || 'Invalid token',
          isValid: false
        },
        { status: 401 }
      )
    }

    // If requested, mark token as used (for single-use tokens)
    let tokenUsed = false
    if (markAsUsed && validation.tokenData && !validation.tokenData.is_reusable) {
      tokenUsed = await TokenService.markTokenAsUsed(validation.tokenData.id!)
    }

    return NextResponse.json({
      success: true,
      isValid: true,
      tokenUsed: tokenUsed,
      data: {
        tokenId: validation.tokenData!.id,
        phoneNumber: validation.tokenData!.phone_number,
        formType: validation.tokenData!.form_type,
        expiresAt: validation.tokenData!.expires_at,
        isReusable: validation.tokenData!.is_reusable,
        usedAt: validation.tokenData!.used_at,
        createdAt: validation.tokenData!.created_at
      }
    })

  } catch (error) {
    console.error('Error in validate-token POST API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Additional endpoint for token status check
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get token data without validation (for status checking)
    const tokenData = await TokenService.validateToken(token)
    
    // Prepare response with detailed status
    const response: {
      success: boolean;
      tokenExists: boolean;
      isValid: boolean;
      status?: {
        expired: boolean;
        used: boolean;
        usable: boolean;
        reusable: boolean;
        expiresAt: string;
        usedAt?: string;
      };
      data?: {
        phoneNumber: string;
        formType: string;
        createdAt?: string;
      };
      reason?: string;
    } = {
      success: true,
      tokenExists: tokenData.isValid || tokenData.tokenData !== null,
      isValid: tokenData.isValid
    }

    if (tokenData.tokenData) {
      const isExpired = TokenService.isTokenExpired(tokenData.tokenData)
      const isUsable = TokenService.isTokenUsable(tokenData.tokenData)
      
      response.status = {
        expired: isExpired,
        used: !tokenData.tokenData.is_reusable && !!tokenData.tokenData.used_at,
        usable: isUsable,
        reusable: tokenData.tokenData.is_reusable,
        expiresAt: tokenData.tokenData.expires_at,
        usedAt: tokenData.tokenData.used_at
      }
      
      response.data = {
        phoneNumber: tokenData.tokenData.phone_number,
        formType: tokenData.tokenData.form_type,
        createdAt: tokenData.tokenData.created_at
      }
    }

    if (!tokenData.isValid && tokenData.reason) {
      response.reason = tokenData.reason
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in validate-token PUT API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}