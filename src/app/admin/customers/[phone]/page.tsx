'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { SupabaseService } from '@/lib/supabase-service'
import { CustomerSubmission, UploadedFile, MessageLog } from '@/lib/supabase'
import formFieldsData from '@/data/form-fields.json'
import Link from 'next/link'
import CustomFileInput from '@/components/CustomFileInput'
import WhatsAppModal from '@/components/WhatsAppModal'

interface FieldInfo {
  name: string;
  slug: string;
  description?: string;
  variants?: string[];
  template?: string;
  templates?: Array<{ label: string; path: string }>;
}

export default function CustomerPage() {
  const params = useParams()
  const phoneNumber = decodeURIComponent(params.phone as string)

  const [submissions, setSubmissions] = useState<CustomerSubmission[]>([])
  const [selectedFormType, setSelectedFormType] = useState<string>('')
  const [customerFiles, setCustomerFiles] = useState<UploadedFile[]>([])
  const [messageHistory, setMessageHistory] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    family_name: '',
    id_number: '',
    birth_date: '',
    address: {
      street: '',
      city: '',
      zip_code: ''
    }
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      // Get all submissions for this phone number
      const allSubmissions = await SupabaseService.getAllSubmissions()
      const customerSubmissions = allSubmissions.filter(sub => sub.phone_number === phoneNumber)
      setSubmissions(customerSubmissions)
      
      // Load all files for this customer
      const allFiles = await SupabaseService.getAllFilesByPhone(phoneNumber)
      setCustomerFiles(allFiles)
      
      // Load message history - with error handling for missing table
      try {
        const messages = await SupabaseService.getMessageHistory(phoneNumber)
        setMessageHistory(messages)
      } catch (error) {
        console.warn('Message history not available:', error)
        setMessageHistory([]) // Fallback to empty array
      }
      
      // Load customer details from any submission that has them
      const submissionWithDetails = customerSubmissions.find(s => s.name || s.family_name || s.id_number || s.birth_date || s.address)
      if (submissionWithDetails) {
        setCustomerDetails({
          name: submissionWithDetails.name || '',
          family_name: submissionWithDetails.family_name || '',
          id_number: submissionWithDetails.id_number?.toString() || '',
          birth_date: submissionWithDetails.birth_date || '',
          address: {
            street: submissionWithDetails.address?.street || '',
            city: submissionWithDetails.address?.city || '',
            zip_code: submissionWithDetails.address?.zip_code || ''
          }
        })
      }
      
      // Smart form selection: auto-select if only one form, otherwise let user choose
      if (customerSubmissions.length === 1) {
        // Only one form - auto select it
        const singleFormType = customerSubmissions[0].form_type
        setSelectedFormType(singleFormType)
      } else if (customerSubmissions.length > 1) {
        // Multiple forms - let user choose, don't auto-select
        setSelectedFormType('')
      }
      
      setLoading(false)
    }
    
    loadData()
  }, [phoneNumber])



  const handleFormTypeSelect = async (formType: string) => {
    setSelectedFormType(formType)
    // No need to reload files, they're already loaded
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fieldSlug: string, fieldName: string) => {
    const file = event.target.files?.[0]
    if (!file || !selectedFormType) return

    const formTypeLabel = formFieldsData.formTypes.find(ft => ft.slug === selectedFormType)?.label || selectedFormType

    setUploading(true)
    const result = await SupabaseService.adminUploadFile(
      phoneNumber,
      selectedFormType,
      formTypeLabel,
      fieldSlug,
      fieldName,
      file
    )

    if (result.success) {
      // Reload all files for this customer
      const allFiles = await SupabaseService.getAllFilesByPhone(phoneNumber)
      setCustomerFiles(allFiles)
    }
    setUploading(false)
    
    // Reset file input
    event.target.value = ''
  }

  const getFileUrl = async (filePath: string) => {
    try {
      console.log('Admin panel requesting file URL for:', filePath)
      const url = await SupabaseService.getFileUrl(filePath)
      console.log('Received URL:', url)
      
      if (url) {
        window.open(url, '_blank')
      } else {
        alert('לא ניתן לפתוח את הקובץ כרגע. הקובץ עלול להיות זמינות באחסון.')
      }
    } catch (error) {
      console.error('Error opening file:', error)
      alert('שגיאה בפתיחת הקובץ. נסה שוב מאוחר יותר.')
    }
  }

  const getFormTypeFields = (formTypeSlug?: string) => {
    const typeToUse = formTypeSlug || selectedFormType
    if (!typeToUse) return []
    const formType = formFieldsData.formTypes.find(ft => ft.slug === typeToUse)
    return formType?.fields || []
  }

  const getFieldInfo = (fieldSlug: string): FieldInfo | undefined => {
    return formFieldsData.fields[fieldSlug as keyof typeof formFieldsData.fields] as FieldInfo | undefined
  }

  const handleSendWhatsAppLink = async (formType: string, message: string) => {
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
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert('הודעה נשלחה בהצלחה! ✅')
        // Refresh message history
        const messages = await SupabaseService.getMessageHistory(phoneNumber)
        setMessageHistory(messages)
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

  const handleSendMessage = async () => {
    setSendingMessage(true)
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message: 'שלום! איך אפשר לעזור לך?',
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert('הודעה נשלחה בהצלחה! ✅')
        // Refresh message history
        const messages = await SupabaseService.getMessageHistory(phoneNumber)
        setMessageHistory(messages)
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

  const getAutomaticStatus = (submission: CustomerSubmission, totalFields: number): 'new' | 'in-progress' | 'completed' => {
    const submittedCount = submission.submitted_fields.length
    if (submittedCount === 0) return 'new'
    if (submittedCount === totalFields) return 'completed'
    return 'in-progress'
  }

  const getMessageTypeLabel = (messageType: MessageLog['message_type']): string => {
    const labels = {
      'form_link': 'קישור לטופס',
      'manual': 'הודעה ידנית',
      'reminder_first': 'תזכורת ראשונה',
      'reminder_second': 'תזכורת שנייה',
      'reminder_first_week': 'תזכורת שבוע 1',
      'reminder_second_week': 'תזכורת שבוע 2',
      'reminder_third_week': 'תזכורת שבוע 3',
      'reminder_fourth_week': 'תזכורת אחרונה',
      'verification_code': 'קוד אימות'
    }
    return labels[messageType] || messageType
  }

  const getMessageTypeColor = (messageType: MessageLog['message_type']): string => {
    const colors = {
      'form_link': 'bg-blue-100 text-blue-800',
      'manual': 'bg-green-100 text-green-800',
      'reminder_first': 'bg-orange-100 text-orange-800',
      'reminder_second': 'bg-orange-100 text-orange-800',
      'reminder_first_week': 'bg-yellow-100 text-yellow-800',
      'reminder_second_week': 'bg-yellow-100 text-yellow-800',
      'reminder_third_week': 'bg-yellow-100 text-yellow-800',
      'reminder_fourth_week': 'bg-red-100 text-red-800',
      'verification_code': 'bg-purple-100 text-purple-800'
    }
    return colors[messageType] || 'bg-gray-100 text-gray-800'
  }

  const handleSaveCustomerDetails = async () => {
    try {
      // Update all submissions for this customer with the new details
      const response = await fetch('/api/customers/update-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          details: {
            name: customerDetails.name || null,
            family_name: customerDetails.family_name || null,
            id_number: customerDetails.id_number ? parseInt(customerDetails.id_number) : null,
            birth_date: customerDetails.birth_date || null,
            address: Object.values(customerDetails.address).some(v => v) ? customerDetails.address : null
          }
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        // Reload submissions to get updated data
        const allSubmissions = await SupabaseService.getAllSubmissions()
        const customerSubmissions = allSubmissions.filter(sub => sub.phone_number === phoneNumber)
        setSubmissions(customerSubmissions)
        setEditingDetails(false)
        alert('פרטי הלקוח נשמרו בהצלחה! ✅')
      } else {
        alert(`שגיאה בשמירת הפרטים: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving customer details:', error)
      alert('שגיאה בשמירת פרטי הלקוח')
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

  const selectedSubmission = submissions.find(sub => sub.form_type === selectedFormType)

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">פרטי לקוח - {phoneNumber}</h1>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors"
          >
            ← חזרה לרשימה
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Forms Management - Left Columns */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">ניהול טפסים</h2>

              {/* Forms List */}
              <div className="mb-6">
                <h3 className="font-medium mb-4 text-gray-900">רשימת טפסים</h3>
                <div className="space-y-3">
                  {submissions.map((submission) => {
                    const totalFields = getFormTypeFields(submission.form_type).filter(f => !f.isSection).length
                    const submittedFields = submission.submitted_fields.length
                    const isSelected = selectedFormType === submission.form_type
                    const automaticStatus = getAutomaticStatus(submission, totalFields)

                    return (
                      <div
                        key={submission.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50 shadow-md' 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => handleFormTypeSelect(submission.form_type)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-900">{submission.form_type_label}</div>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              automaticStatus === 'completed' ? 'bg-green-100 text-green-800' :
                              automaticStatus === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {automaticStatus === 'completed' ? 'הושלם' :
                             automaticStatus === 'in-progress' ? 'בתהליך' : 'חדש'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-sm text-gray-600">
                            📊 {submittedFields}/{totalFields} שדות הוגשו
                          </div>
                          <div className="text-xs text-gray-500">
                            📅 {new Date(submission.updated_at || '').toLocaleDateString('he-IL')}
                          </div>
                        </div>

                        {/* Reminder Status */}
                        <div className="text-xs space-y-1 mb-3 p-2 bg-gray-50 rounded">
                          {submission.first_sent_at ? (
                            <>
                              <div className="text-gray-700">
                                📤 נשלח: {new Date(submission.first_sent_at).toLocaleDateString('he-IL')}
                              </div>
                              {submission.last_interaction_at && (
                                <div className="text-blue-700">
                                  👆 אינטראקציה אחרונה: {new Date(submission.last_interaction_at).toLocaleDateString('he-IL')}
                                </div>
                              )}
                              {submission.reminder_count > 0 && (
                                <div className="text-orange-700">
                                  🔔 תזכורות נשלחו: {submission.reminder_count}
                                  {submission.last_reminder_sent_at && (
                                    <span className="mr-2">
                                      (אחרונה: {new Date(submission.last_reminder_sent_at).toLocaleDateString('he-IL')})
                                    </span>
                                  )}
                                </div>
                              )}
                              {submission.reminder_paused && (
                                <div className="text-red-700 font-medium">
                                  ⏸️ תזכורות מושהות
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-gray-500">
                              📤 טופס לא נשלח עדיין
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              automaticStatus === 'completed' ? 'bg-green-500' :
                              automaticStatus === 'in-progress' ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}
                            style={{ width: totalFields > 0 ? `${(submittedFields / totalFields) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedFormType && selectedSubmission && (
                <>
                  {/* Form Status */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium mb-2 text-gray-900">סטטוס הטופס</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-gray-800">נוצר</div>
                        <div className="text-gray-600">{new Date(selectedSubmission.created_at || '').toLocaleDateString('he-IL')}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">עודכן</div>
                        <div className="text-gray-600">{new Date(selectedSubmission.updated_at || '').toLocaleDateString('he-IL')}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">שדות מולאו</div>
                        <div className="text-gray-600">{selectedSubmission.submitted_fields.length} / {getFormTypeFields().filter(f => !f.isSection).length}</div>
                      </div>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="mb-6">
                    <h3 className="font-medium mb-4 text-gray-900">שדות הטופס</h3>
                    <div className="space-y-4">
                      {getFormTypeFields().map((field) => {
                        const fieldInfo = getFieldInfo(field.fieldSlug)
                        if (!fieldInfo || field.isSection) return null
                        
                        const existingFile = customerFiles.find(f => 
                          f.field_slug === field.fieldSlug && 
                          f.submission_id === selectedSubmission?.id
                        )
                        const isSubmitted = selectedSubmission.submitted_fields.includes(field.fieldSlug)
                        
                        return (
                          <div key={field.fieldSlug} className={`p-4 border rounded-lg ${isSubmitted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium text-sm text-gray-900">
                                    {field.number}. {fieldInfo.name}
                                  </div>
                                  {isSubmitted && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                      הוגש
                                    </span>
                                  )}
                                </div>
                                {fieldInfo?.description && (
                                  <div className="text-xs text-gray-700 mt-1">
                                    {fieldInfo.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {isSubmitted ? (
                              <div className="mt-3">
                                {existingFile && (
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <div className="text-xs text-green-800 font-medium">✅ קובץ הוגש: {existingFile.file_name}</div>
                                      <div className="text-xs text-gray-600">
                                        {(existingFile.file_size / 1024).toFixed(1)} KB • {new Date(existingFile.created_at || '').toLocaleDateString('he-IL')}
                                      </div>
                                    </div>
                                    <div className="space-x-2 space-x-reverse">
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={() => existingFile ? getFileUrl(existingFile.file_path) : alert('הקובץ לא זמין כרגע')}
                                  className="w-full p-3 border-2 border-green-300 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                  📂 פתח קובץ
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3">
                                <CustomFileInput
                                  onChange={(e) => handleFileUpload(e, field.fieldSlug, fieldInfo.name)}
                                  disabled={uploading}
                                  ariaLabel={`העלה קובץ עבור ${fieldInfo.name}`}
                                  className="w-full"
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {uploading && <div className="text-sm text-blue-700 mt-2">מעלה קובץ...</div>}
                  </div>

                </>
              )}

              {!selectedFormType && submissions.length > 1 && (
                <div className="text-center text-gray-500 py-8">
                  בחר טופס כדי לצפות בפרטים
                </div>
              )}
            </div>
          </div>

          {/* Customer Details & Files - Right Column */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Customer Details */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">פרטי לקוח</h2>
                
                {/* Personal Details */}
                <div className="p-4 bg-blue-50 rounded-lg mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-900">פרטים אישיים</h3>
                    {!editingDetails ? (
                      <button
                        onClick={() => setEditingDetails(true)}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                      >
                        ערוך
                      </button>
                    ) : (
                      <div className="space-x-1 space-x-reverse">
                        <button
                          onClick={handleSaveCustomerDetails}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                        >
                          שמור
                        </button>
                        <button
                          onClick={() => setEditingDetails(false)}
                          className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded"
                        >
                          בטל
                        </button>
                      </div>
                    )}
                  </div>

                  {editingDetails ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="block text-gray-700 font-medium mb-1">שם פרטי</label>
                        <input
                          type="text"
                          value={customerDetails.name}
                          onChange={(e) => setCustomerDetails({...customerDetails, name: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-sm text-gray-900"
                          placeholder="הזן שם פרטי"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-1">שם משפחה</label>
                        <input
                          type="text"
                          value={customerDetails.family_name}
                          onChange={(e) => setCustomerDetails({...customerDetails, family_name: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-sm text-gray-900"
                          placeholder="הזן שם משפחה"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-1">מספר זהות</label>
                        <input
                          type="text"
                          value={customerDetails.id_number}
                          onChange={(e) => setCustomerDetails({...customerDetails, id_number: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-sm text-gray-900"
                          placeholder="הזן מספר זהות"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-1">תאריך לידה</label>
                        <input
                          type="date"
                          value={customerDetails.birth_date}
                          onChange={(e) => setCustomerDetails({...customerDetails, birth_date: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-sm text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-1">כתובת</label>
                        <input
                          type="text"
                          value={customerDetails.address.street}
                          onChange={(e) => setCustomerDetails({
                            ...customerDetails, 
                            address: {...customerDetails.address, street: e.target.value}
                          })}
                          className="w-full px-2 py-1 border rounded text-sm text-gray-900 mb-1"
                          placeholder="רחוב ומספר בית"
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="text"
                            value={customerDetails.address.city}
                            onChange={(e) => setCustomerDetails({
                              ...customerDetails, 
                              address: {...customerDetails.address, city: e.target.value}
                            })}
                            className="px-2 py-1 border rounded text-sm text-gray-900"
                            placeholder="עיר"
                          />
                          <input
                            type="text"
                            value={customerDetails.address.zip_code}
                            onChange={(e) => setCustomerDetails({
                              ...customerDetails, 
                              address: {...customerDetails.address, zip_code: e.target.value}
                            })}
                            className="px-2 py-1 border rounded text-sm text-gray-900"
                            placeholder="מיקוד"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-gray-800">
                      {submissions.length > 0 && submissions.some(s => s.name || s.family_name || s.id_number || s.birth_date || s.address) ? (
                        <>
                          {submissions.find(s => s.name) && (
                            <div><strong>שם פרטי:</strong> {submissions.find(s => s.name)?.name}</div>
                          )}
                          {submissions.find(s => s.family_name) && (
                            <div><strong>שם משפחה:</strong> {submissions.find(s => s.family_name)?.family_name}</div>
                          )}
                          {submissions.find(s => s.id_number) && (
                            <div><strong>מספר זהות:</strong> {submissions.find(s => s.id_number)?.id_number}</div>
                          )}
                          {submissions.find(s => s.birth_date) && (
                            <div><strong>תאריך לידה:</strong> {new Date(submissions.find(s => s.birth_date)?.birth_date || '').toLocaleDateString('he-IL')}</div>
                          )}
                          {submissions.find(s => s.address) && (
                            <div className="mt-2">
                              <strong>כתובת:</strong>
                              <div className="mr-2 text-gray-700">
                                {(() => {
                                  const address = submissions.find(s => s.address)?.address
                                  if (!address) return null
                                  const parts = []
                                  if (address.street) parts.push(address.street)
                                  if (address.city) parts.push(address.city)
                                  if (address.zip_code) parts.push(`מיקוד: ${address.zip_code}`)
                                  return parts.length > 0 ? parts.join(', ') : 'לא צוין'
                                })()}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-500 italic">פרטים אישיים לא מולאו עדיין</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg mb-4">
                  <h3 className="font-medium mb-2 text-gray-900">מידע מערכת</h3>
                  <div className="space-y-2 text-sm text-gray-800">
                    <div><strong>טלפון:</strong> {phoneNumber}</div>
                    <div><strong>מספר טפסים:</strong> {submissions.length}</div>
                    <div><strong>תאריך הצטרפות:</strong> {new Date(Math.min(...submissions.map(sub => new Date(sub.created_at || '').getTime()))).toLocaleDateString('he-IL')}</div>
                    <div><strong>עדכון אחרון:</strong> {new Date(Math.max(...submissions.map(sub => new Date(sub.updated_at || '').getTime()))).toLocaleDateString('he-IL')}</div>
                  </div>
                </div>

                {/* WhatsApp Actions */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-medium mb-2 text-gray-900">פעולות וואטסאפ</h3>
                  <div className="space-y-2">
                    <button 
                      onClick={handleSendMessage}
                      disabled={sendingMessage}
                      className={`w-full text-sm px-3 py-2 rounded-md transition-colors ${
                        sendingMessage 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      } text-white`}
                    >
                      {sendingMessage ? 'שולח...' : 'שלח הודעה'}
                    </button>
                    <button 
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      disabled={sendingMessage}
                      className={`w-full text-sm px-3 py-2 rounded-md transition-colors ${
                        sendingMessage 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } text-white`}
                    >
                      שלח קישור לטופס
                    </button>
                  </div>
                </div>
              </div>

              {/* Files List */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">קבצים ({customerFiles.length})</h2>
                
                {customerFiles.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group files by form type */}
                    {submissions.map((submission) => {
                      const formFiles = customerFiles.filter(f => f.submission_id === submission.id)
                      if (formFiles.length === 0) return null

                      return (
                        <div key={submission.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="font-medium text-gray-900">{submission.form_type_label}</h3>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {formFiles.length} קבצים
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {formFiles.map((file) => (
                              <div key={file.id} className="p-2 bg-gray-50 rounded border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-medium text-xs text-gray-900 truncate">{file.field_name}</div>
                                    <div className="text-xs text-gray-600 truncate">{file.file_name}</div>
                                    <div className="text-xs text-gray-500">
                                      {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at || '').toLocaleDateString('he-IL')}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => getFileUrl(file.file_path)}
                                    className="text-blue-600 hover:text-blue-800 text-xs ml-2 bg-blue-50 px-2 py-1 rounded"
                                  >
                                    צפה
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    אין קבצים עדיין
                  </div>
                )}
              </div>

              {/* Message History */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">היסטוריית הודעות ({messageHistory.length})</h2>
                
                {messageHistory.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {messageHistory.map((message) => (
                      <div key={message.id} className={`p-3 rounded-lg border-r-4 ${
                        message.sent_successfully 
                          ? 'bg-green-50 border-green-400' 
                          : 'bg-red-50 border-red-400'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getMessageTypeColor(message.message_type)}`}>
                              {getMessageTypeLabel(message.message_type)}
                            </span>
                            {message.form_type && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {message.form_type_label || message.form_type}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(message.sent_at).toLocaleString('he-IL')}
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-800 mb-2">
                          {message.message_content.length > 100 
                            ? `${message.message_content.substring(0, 100)}...` 
                            : message.message_content
                          }
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            {message.sent_successfully ? (
                              <span className="text-green-600">✓ נשלח בהצלחה</span>
                            ) : (
                              <span className="text-red-600">✗ שגיאה בשליחה</span>
                            )}
                            {message.whatsapp_message_id && (
                              <span className="text-gray-500">ID: {message.whatsapp_message_id}</span>
                            )}
                          </div>
                          {message.error_message && (
                            <span className="text-red-600 truncate max-w-xs" title={message.error_message}>
                              שגיאה: {message.error_message}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    אין הודעות עדיין
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        phoneNumber={phoneNumber}
        onSendLink={handleSendWhatsAppLink}
      />
    </div>
  )
}