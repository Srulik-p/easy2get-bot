import { NextRequest, NextResponse } from 'next/server'
import { URLService } from '@/lib/url-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      longUrl, 
      phoneNumber, 
      formType, 
      formTypeLabel, 
      token, 
      generateCustom = false
    } = body

    // Method 1: Direct URL shortening (if longUrl provided)
    if (longUrl) {
      const result = await URLService.createShortUrl(longUrl)
      if (result.success) {
        return NextResponse.json(result)
      }
      // Fallback to original URL if shortening fails
      return NextResponse.json({
        success: true,
        shortUrl: longUrl,
        originalUrl: longUrl,
        error: result.error
      })
    }

    // Method 2: Generate WhatsApp-friendly URL and shorten it
    if (phoneNumber && formType) {
      if (!formTypeLabel) {
        return NextResponse.json(
          { success: false, error: 'Form type label is required for WhatsApp URLs' },
          { status: 400 }
        )
      }

      const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
      
      const result = await URLService.createWhatsAppShortUrl(
        baseUrl,
        phoneNumber,
        formType,
        formTypeLabel,
        token
      )

      // If custom alias generation was requested and we have a successful result,
      // try to create a custom alias version
      if (generateCustom && result.success && result.shortUrl) {
        const alias = URLService.generateCustomAlias(phoneNumber, formType)
        const longUrlForCustom = URLService.generateWhatsAppFriendlyUrl(
          baseUrl,
          phoneNumber,
          formType,
          formTypeLabel,
          token
        )
        
        const customResult = await URLService.createShortUrl(longUrlForCustom, alias)
        
        // If custom alias worked, use it; otherwise keep the original
        if (customResult.success) {
          return NextResponse.json({
            ...customResult,
            customAlias: alias,
            fallbackUrl: result.shortUrl
          })
        }
      }

      return NextResponse.json(result)
    }

    // If neither method has required params
    return NextResponse.json(
      { 
        success: false, 
        error: 'Either longUrl or (phoneNumber + formType + formTypeLabel) must be provided' 
      },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in shorten URL API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Parse the URL and return information about it
    const parsedInfo = URLService.parseFormUrl(url)
    
    // Validate if the URL is accessible
    const isValid = await URLService.validateUrl(url)
    
    return NextResponse.json({
      success: true,
      data: {
        originalUrl: url,
        isValid: isValid,
        parsedInfo: parsedInfo
      }
    })

  } catch (error) {
    console.error('Error in URL info API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Utility endpoint for encoding/decoding Hebrew text
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, action, platform = 'whatsapp' } = body

    if (!text || !action) {
      return NextResponse.json(
        { success: false, error: 'Text and action parameters are required' },
        { status: 400 }
      )
    }

    let result: string

    if (action === 'encode') {
      result = URLService.encodeHebrewText(text, { platform })
    } else if (action === 'decode') {
      result = URLService.decodeHebrewText(text, { platform })
    } else {
      return NextResponse.json(
        { success: false, error: 'Action must be "encode" or "decode"' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        original: text,
        result: result,
        action: action,
        platform: platform
      }
    })

  } catch (error) {
    console.error('Error in text encoding API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}