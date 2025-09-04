import { NextRequest, NextResponse } from 'next/server'
import { SupabaseService } from '@/lib/supabase-service'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, details } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    console.log('Updating customer details for:', phoneNumber, details)

    // Get customer by phone number
    const customer = await SupabaseService.getCustomerByPhone(phoneNumber)
    if (!customer) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 })
    }

    // Update customer in customers table
    const success = await SupabaseService.updateCustomer(customer.id, details)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Customer details updated successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to update customer details'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Update customer details error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}