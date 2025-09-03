'use client'

import { useState, useEffect } from 'react'
import { SupabaseService } from '@/lib/supabase-service'
import { CustomerSubmission } from '@/lib/supabase'
import Link from 'next/link'
import NewCustomerLinkModal from './NewCustomerLinkModal'
import formFieldsData from '@/data/form-fields.json'

interface CustomerGroup {
  phoneNumber: string
  submissions: CustomerSubmission[]
}

export default function AdminPanel() {
  const [submissions, setSubmissions] = useState<CustomerSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPhone, setSearchPhone] = useState('')
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    loadSubmissions()
  }, [])

  const loadSubmissions = async () => {
    setLoading(true)
    const data = await SupabaseService.getAllSubmissions()
    setSubmissions(data)
    setLoading(false)
  }

  // Group submissions by phone number
  const customerGroups: CustomerGroup[] = submissions.reduce((groups: CustomerGroup[], submission) => {
    const existingGroup = groups.find(g => g.phoneNumber === submission.phone_number)
    if (existingGroup) {
      existingGroup.submissions.push(submission)
    } else {
      groups.push({
        phoneNumber: submission.phone_number,
        submissions: [submission]
      })
    }
    return groups
  }, [])

  const filteredCustomerGroups = customerGroups.filter(group =>
    group.phoneNumber.includes(searchPhone)
  )

  const handleSendNewCustomerLink = async (phoneNumber: string, formType: string, message: string) => {
    setSendingMessage(true)
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message,
          formType, // Pass form type to track when form is sent
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert('הודעה נשלחה בהצלחה! ✅')
        // Optionally refresh the customer list
        await loadSubmissions()
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
                    מספר טלפון
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    מספר טפסים
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סוגי טפסים
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    עדכון אחרון
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomerGroups.map((customerGroup) => (
                  <tr key={customerGroup.phoneNumber} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customerGroup.phoneNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customerGroup.submissions.length}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-xs">
                        {customerGroup.submissions.map(sub => sub.form_type_label).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(Math.max(...customerGroup.submissions.map(sub => new Date(sub.updated_at || '').getTime()))).toLocaleDateString('he-IL')}
                    </td>
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