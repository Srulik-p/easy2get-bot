'use client'

import { useState, useEffect } from 'react'
import { SupabaseService } from '@/lib/supabase-service'
import { CustomerSubmission, Customer, CustomerStatus } from '@/lib/supabase'
import Link from 'next/link'
import NewCustomerLinkModal from './NewCustomerLinkModal'
import formFieldsData from '@/data/form-fields.json'

interface CustomerGroup {
  phoneNumber: string
  customer?: Customer
  submissions: CustomerSubmission[]
}

export default function AdminPanel() {
  const [submissions, setSubmissions] = useState<CustomerSubmission[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPhone, setSearchPhone] = useState('')
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [submissionsData, customersData] = await Promise.all([
      SupabaseService.getAllSubmissions(),
      SupabaseService.getAllCustomers()
    ])
    setSubmissions(submissionsData)
    setCustomers(customersData)
    setLoading(false)
  }

  // Create customer groups by merging customers and submissions
  const customerGroups: CustomerGroup[] = (() => {
    const groups: CustomerGroup[] = []
    
    // First, add all customers (including those without submissions)
    customers.forEach(customer => {
      groups.push({
        phoneNumber: customer.phone_number,
        customer: customer,
        submissions: []
      })
    })
    
    // Then, add submissions to existing groups or create new ones
    submissions.forEach(submission => {
      let existingGroup = groups.find(g => g.phoneNumber === submission.phone_number)
      if (existingGroup) {
        existingGroup.submissions.push(submission)
      } else {
        // Customer doesn't exist in customers table, create a group with just submissions
        groups.push({
          phoneNumber: submission.phone_number,
          submissions: [submission]
        })
      }
    })
    
    return groups
  })()

  const filteredCustomerGroups = customerGroups.filter(group =>
    group.phoneNumber.includes(searchPhone)
  )

  // Helper function to format phone number from +972XXXXXXXXX to 05X-XXX-XXXX
  const formatPhoneNumber = (phoneNumber: string): string => {
    // Remove +972 prefix if present
    let cleanPhone = phoneNumber.replace(/^\+972/, '')
    // Remove any non-digits
    cleanPhone = cleanPhone.replace(/\D/g, '')
    
    // Add leading 0 if not present
    if (!cleanPhone.startsWith('0')) {
      cleanPhone = '0' + cleanPhone
    }
    
    // Format as 05X-XXX-XXXX
    if (cleanPhone.length === 10) {
      return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
    }
    
    // Fallback to original if formatting fails
    return phoneNumber
  }

  // Helper function to get customer status label in Hebrew
  const getCustomerStatusLabel = (status: CustomerStatus): string => {
    const labels = {
      'new_lead': 'ליד חדש',
      'qualified_lead': 'ליד מוכשר',
      'agreement_signed': 'הסכם נחתם',
      'ready_for_apply': 'מוכן להגשה',
      'applied': 'הוגש',
      'application_approved': 'בקשה אושרה',
      'application_declined': 'בקשה נדחתה'
    }
    return labels[status] || status
  }

  // Helper function to get customer criterion label in Hebrew  
  const getCustomerCriterionLabel = (criterion: string | null | undefined): string => {
    if (!criterion) return 'לא נבחר'
    
    const formType = formFieldsData.formTypes.find(ft => ft.slug === criterion)
    return formType?.label || criterion
  }

  // Helper function to get customer status color
  const getCustomerStatusColor = (status: CustomerStatus): string => {
    const colors = {
      'new_lead': 'bg-gray-100 text-gray-800',
      'qualified_lead': 'bg-blue-100 text-blue-800',
      'agreement_signed': 'bg-yellow-100 text-yellow-800',
      'ready_for_apply': 'bg-orange-100 text-orange-800',
      'applied': 'bg-purple-100 text-purple-800',
      'application_approved': 'bg-green-100 text-green-800',
      'application_declined': 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const handleSendNewCustomerLink = async (phoneNumber: string, formType: string, message: string, customerName?: string) => {
    setSendingMessage(true)
    let customerId: string | undefined = undefined
    
    // Convert phone number to +972 format for consistency
    let formattedPhone = phoneNumber.trim()
    if (!formattedPhone.startsWith('+972') && !formattedPhone.startsWith('972')) {
      const cleanPhone = formattedPhone.replace(/\D/g, '') // Remove all non-digits
      formattedPhone = cleanPhone.startsWith('0') 
        ? `+972${cleanPhone.substring(1)}` 
        : `+972${cleanPhone}`
    } else if (formattedPhone.startsWith('972')) {
      formattedPhone = `+${formattedPhone}`
    }
    
    try {
      // First, create or update the customer in the database
      if (customerName) {
        try {
          // Parse first and last name from full name
          const nameParts = customerName.trim().split(' ')
          const firstName = nameParts[0] || undefined
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

          // Create or update customer in customers table
          const existingCustomer = await SupabaseService.getCustomerByPhone(formattedPhone)
          if (!existingCustomer) {
            // Create new customer with name and criterion
            const newCustomer = await SupabaseService.createCustomer({
              phone_number: formattedPhone,
              name: firstName,
              family_name: lastName,
              criterion: formType as any,
              status: 'agreement_signed'
            })
            customerId = newCustomer?.id
            console.log('Created new customer:', { phone: formattedPhone, name: firstName, family_name: lastName, criterion: formType })
          } else {
            customerId = existingCustomer.id
            if (!existingCustomer.name && firstName) {
              // Update existing customer with name if they don't have one
              await SupabaseService.updateCustomer(existingCustomer.id, {
                name: firstName,
                family_name: lastName,
                criterion: existingCustomer.criterion || (formType as any)
              })
              console.log('Updated existing customer with name:', { id: existingCustomer.id, name: firstName, family_name: lastName })
            }
          }
        } catch (error) {
          console.error('Error creating/updating customer:', error)
          // Don't fail the whole process if customer creation fails
        }
      }

      // Send WhatsApp message using formatted phone number
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone, // Use formatted phone with +972
          message,
          formType, // Pass form type to track when form is sent
          customerName, // Pass customer name for better tracking
          customerId, // Pass customer ID for message logging
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert('הודעה נשלחה בהצלחה! ✅')
        // Refresh the customer list
        await loadData()
      } else {
        alert(`שגיאה בשליחת ההודעה: ${result.error}`)
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      alert('שגיאה בשליחת ההודעה')
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">טוען...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">פאנל ניהול - רשימת לקוחות</h1>
          <div className="flex gap-3">
            <Link
              href="/admin/reminders"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm"
            >
              🔔 ניהול תזכורות
            </Link>
            <button
              onClick={() => setIsNewLinkModalOpen(true)}
              disabled={sendingMessage}
              className={`px-6 py-3 rounded-lg transition-colors ${
                sendingMessage 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white font-medium`}
          >
            + שלח קישור ללקוח חדש
          </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <input
              type="text"
              placeholder="חפש לפי מספר טלפון..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-md ml-4"
            />
            <div className="text-sm text-gray-600">
              סה&quot;כ לקוחות: {filteredCustomerGroups.length}
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    שם מלא
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    טלפון
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תבחין
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס לקוח
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    טפסים
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס טפסים
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomerGroups.map((customerGroup) => (
                  <tr key={customerGroup.phoneNumber} className="hover:bg-gray-50">
                    {/* Full Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customerGroup.customer ? 
                          [customerGroup.customer.name, customerGroup.customer.family_name]
                            .filter(Boolean).join(' ') || 'לא צוין'
                          : 'לא צוין'
                        }
                      </div>
                    </td>
                    
                    {/* Phone (formatted) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatPhoneNumber(customerGroup.phoneNumber)}
                      </div>
                    </td>
                    
                    {/* Criterion */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {customerGroup.customer 
                          ? getCustomerCriterionLabel(customerGroup.customer.criterion)
                          : 'לא נבחר'
                        }
                      </div>
                    </td>
                    
                    {/* Customer Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customerGroup.customer ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCustomerStatusColor(customerGroup.customer.status)}`}>
                          {getCustomerStatusLabel(customerGroup.customer.status)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          לא ידוע
                        </span>
                      )}
                    </td>
                    
                    {/* Forms */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">{customerGroup.submissions.length} טפסים</div>
                        {customerGroup.submissions.length > 0 && (
                          <div className="text-xs text-gray-500 max-w-xs truncate" title={customerGroup.submissions.map(sub => sub.form_type_label).join(', ')}>
                            {customerGroup.submissions.map(sub => sub.form_type_label).join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Form Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          // Handle customers without any submissions
                          if (customerGroup.submissions.length === 0) {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                אין טפסים
                              </span>
                            )
                          }

                          const statusCounts = customerGroup.submissions.reduce((acc, sub) => {
                            // Calculate automatic status based on form progress
                            const submittedCount = sub.submitted_fields.length
                            let automaticStatus: string
                            if (submittedCount === 0) {
                              automaticStatus = 'new'
                            } else {
                              // We need to get total fields for this form type
                              const formType = formFieldsData.formTypes.find(ft => ft.slug === sub.form_type)
                              const totalFields = formType?.fields.filter(f => !f.isSection).length || 0
                              if (submittedCount === totalFields) {
                                automaticStatus = 'completed'
                              } else {
                                automaticStatus = 'in-progress'
                              }
                            }
                            
                            acc[automaticStatus] = (acc[automaticStatus] || 0) + 1
                            return acc
                          }, {} as Record<string, number>)
                          
                          return Object.entries(statusCounts).map(([status, count]) => (
                            <span
                              key={status}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                status === 'completed' ? 'bg-green-100 text-green-800' :
                                status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {status === 'completed' ? 'הושלם' :
                               status === 'in-progress' ? 'בתהליך' : 'חדש'} ({count})
                            </span>
                          ))
                        })()}
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/admin/customers/${encodeURIComponent(customerGroup.phoneNumber)}`}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md transition-colors"
                      >
                        צפה בפרטים
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredCustomerGroups.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">לא נמצאו לקוחות</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Customer Link Modal */}
      <NewCustomerLinkModal
        isOpen={isNewLinkModalOpen}
        onClose={() => setIsNewLinkModalOpen(false)}
        onSendLink={handleSendNewCustomerLink}
      />
    </div>
  )
}