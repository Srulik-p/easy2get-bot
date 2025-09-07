'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ReminderCandidate, BatchProgress, ReminderType } from '@/lib/supabase'

interface MessageTemplates {
  first_message: string
  first: string
  second: string
  first_week: string
  second_week: string
  third_week: string
  fourth_week: string
}

export default function RemindersPage() {
  const [candidates, setCandidates] = useState<ReminderCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [savingTemplates, setSavingTemplates] = useState(false)
  
  // Multi-select state
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [showBatchProgress, setShowBatchProgress] = useState(false)
  
  const [templates, setTemplates] = useState<MessageTemplates>({
    first_message: 'שלום {customerName}! 👋\n\nבהמשך לשיחתינו ועל מנת שנוכל לקדם את הבקשה שלך מול המשרד לביטחון פנים יש להמציא את המסמכים המופרטים ברשימה הבאה:\n\n{formLink}\n\nבברכה, Easy2Get',
    first: 'שלום {customerName}! 👋\n\nשלחנו לך טופס "{formLabel}" לפני יומיים.\n\n📋 זה לוקח רק כמה דקות למלא\n\nצריך עזרה? פשוט תשלח הודעה!',
    second: 'היי {customerName}! 😊\n\nעדיין לא מילאת את טופס "{formLabel}"?\n\n⏰ אנחנו כאן לעזור אם יש שאלות\n📞 צור קשר ונסביר איך למלא',
    first_week: 'תזכורת שבועית ראשונה {customerName} 📅\n\nטופס "{formLabel}" שלך עדיין מחכה!\n\n💬 יש בעיה טכנית? שאלות?\nאנחנו כאן לעזור',
    second_week: 'תזכורת שבועית שנייה {customerName} 🔔\n\nטופס "{formLabel}" - זה הזמן להשלים!\n\n📞 צריך עזרה? צור קשר ונסביר',
    third_week: 'תזכורת שבועית שלישית {customerName} ⏰\n\nעדיין לא השלמת את טופס "{formLabel}"?\n\n🤝 אנחנו כאן לסייע בכל שאלה',
    fourth_week: 'תזכורת אחרונה {customerName} 🚨\n\nטופס "{formLabel}" מחכה כבר חודש!\n\n📋 בוא נסיים את זה יחד - צור קשר'
  })

  const loadCandidates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reminders/process')
      const result = await response.json()
      
      if (result.success) {
        setCandidates(result.candidates || [])
        setLastCheck(new Date().toLocaleString('he-IL'))
      }
    } catch (error) {
      console.error('Error loading candidates:', error)
    } finally {
      setLoading(false)
    }
  }

  const processReminders = async () => {
    setProcessing(true)
    try {
      const response = await fetch('/api/reminders/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_REMINDER_AUTH_TOKEN || 'your_secure_token_here_change_this'}`
        }
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ הושלם! נשלחו ${result.sent} תזכורות, ${result.failed} נכשלו`)
        loadCandidates() // Reload to see updated status
      } else {
        alert(`❌ שגיאה: ${result.error}`)
      }
    } catch (error) {
      console.error('Error processing reminders:', error)
      alert('שגיאה בעיבוד התזכורות')
    } finally {
      setProcessing(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/reminders/templates')
      const result = await response.json()
      
      if (result.success) {
        setTemplates(result.templates)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const saveTemplates = async () => {
    setSavingTemplates(true)
    try {
      const response = await fetch('/api/reminders/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ templates })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('✅ תבניות הודעות נשמרו בהצלחה!')
      } else {
        alert(`❌ שגיאה: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving templates:', error)
      alert('שגיאה בשמירת תבניות ההודעות')
    } finally {
      setSavingTemplates(false)
    }
  }

  const sendManualReminder = async (phoneNumber: string, formType: string) => {
    try {
      const response = await fetch('/api/reminders/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'send-now',
          phoneNumber,
          formType
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('✅ תזכורת נשלחה בהצלחה!')
        loadCandidates()
      } else {
        alert(`❌ שגיאה: ${result.error}`)
      }
    } catch (error) {
      console.error('Error sending manual reminder:', error)
      alert('שגיאה בשליחת התזכורת')
    }
  }

  // Multi-select functions
  const getCandidateKey = (candidate: ReminderCandidate) => {
    return `${candidate.phoneNumber}-${candidate.formType}`
  }

  const handleCandidateSelect = (candidate: ReminderCandidate, checked: boolean) => {
    const key = getCandidateKey(candidate)
    const newSelected = new Set(selectedCandidates)
    
    if (checked) {
      newSelected.add(key)
    } else {
      newSelected.delete(key)
    }
    
    setSelectedCandidates(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedCandidates.size === candidates.length) {
      // Deselect all
      setSelectedCandidates(new Set())
    } else {
      // Select all
      const allKeys = new Set(candidates.map(getCandidateKey))
      setSelectedCandidates(allKeys)
    }
  }

  const getSelectedCandidates = (): ReminderCandidate[] => {
    return candidates.filter(candidate => 
      selectedCandidates.has(getCandidateKey(candidate))
    )
  }

  // Batch processing functions
  const processBatchReminders = async () => {
    const selected = getSelectedCandidates()
    
    if (selected.length === 0) {
      alert('יש לבחור לפחות מועמד אחד לשליחה')
      return
    }

    // Confirm batch operation
    const estimatedMinutes = Math.ceil((selected.length * 3.5) + (Math.floor(selected.length / 20) * 30))
    const confirmMessage = `האם אתה בטוח שברצונך לשלוח ${selected.length} תזכורות?\n\nזמן משוער: ${estimatedMinutes} דקות\n(כולל הפסקות של 30 דקות כל 20 הודעות)`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setBatchProcessing(true)
    setShowBatchProgress(true)
    setBatchProgress({
      totalCount: selected.length,
      sentCount: 0,
      failedCount: 0,
      currentStatus: 'preparing'
    })

    try {
      // Convert candidates to batch recipients format
      const recipients = selected.map(candidate => ({
        phoneNumber: candidate.phoneNumber,
        formType: candidate.formType,
        reminderType: candidate.reminderType as ReminderType
      }))

      console.log('Starting batch processing for recipients:', recipients)

      const response = await fetch('/api/reminders/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients,
          sendImmediately: true
        })
      })

      const result = await response.json()
      
      if (result.success || result.results?.totalSent > 0) {
        const { totalSent = 0, totalFailed = 0 } = result.results || {}
        
        // Update final progress
        setBatchProgress({
          totalCount: selected.length,
          sentCount: totalSent,
          failedCount: totalFailed,
          currentStatus: 'completed'
        })

        // Show results
        let alertMessage = `✅ עיבוד אצוות הושלם!\n\n📤 נשלחו: ${totalSent}\n❌ נכשלו: ${totalFailed}`
        
        if (result.results?.successRate) {
          alertMessage += `\n📊 שיעור הצלחה: ${result.results.successRate}%`
        }
        
        if (result.results?.durationMinutes) {
          alertMessage += `\n⏱️ זמן ביצוע: ${result.results.durationMinutes} דקות`
        }

        if (result.errors && result.errors.length > 0) {
          alertMessage += `\n\n❌ שגיאות:\n${result.errors.slice(0, 3).map((e: { phoneNumber: string; error: string }) => `• ${e.phoneNumber}: ${e.error}`).join('\n')}`
          if (result.errors.length > 3) {
            alertMessage += `\n... ועוד ${result.errors.length - 3} שגיאות`
          }
        }

        alert(alertMessage)
        
        // Clear selection and reload candidates
        setSelectedCandidates(new Set())
        loadCandidates()
      } else {
        alert(`❌ שגיאה בעיבוד האצווה: ${result.error || 'שגיאה לא ידועה'}`)
      }
    } catch (error) {
      console.error('Error processing batch reminders:', error)
      alert('שגיאה בעיבוד התזכורות האצוותיות')
      
      setBatchProgress({
        totalCount: selected.length,
        sentCount: 0,
        failedCount: selected.length,
        currentStatus: 'failed'
      })
    } finally {
      setBatchProcessing(false)
      // Keep progress visible for a few seconds before hiding
      setTimeout(() => {
        setShowBatchProgress(false)
        setBatchProgress(null)
      }, 3000)
    }
  }

  const formatEstimatedTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} דקות`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours} שעות ו-${remainingMinutes} דקות`
    }
  }

  useEffect(() => {
    loadCandidates()
    loadTemplates()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ניהול תזכורות</h1>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors"
          >
            ← חזרה לניהול
          </Link>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">בקרת תזכורות</h2>
          
          {/* Main Action Buttons */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <button
              onClick={loadCandidates}
              disabled={loading}
              className={`px-4 py-2 rounded-md transition-colors ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {loading ? 'בודק...' : 'בדוק מועמדים לתזכורת'}
            </button>
            
            <button
              onClick={processReminders}
              disabled={processing || candidates.length === 0}
              className={`px-4 py-2 rounded-md transition-colors ${
                processing || candidates.length === 0
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              {processing ? 'מעבד...' : `שלח הכל (${candidates.length})`}
            </button>
            
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              {showTemplates ? 'סגור עריכת הודעות' : '✏️ ערוך הודעות תזכורת'}
            </button>
          </div>

          {/* Multi-Select Actions */}
          {candidates.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-lg font-medium mb-3 text-gray-900">פעולות מרובות</h3>
              
              <div className="flex gap-4 mb-4 flex-wrap">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm"
                >
                  {selectedCandidates.size === candidates.length ? '❌ בטל בחירה מהכל' : '☑️ בחר הכל'}
                </button>
                
                {selectedCandidates.size > 0 && (
                  <button
                    onClick={() => setSelectedCandidates(new Set())}
                    className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
                  >
                    נקה בחירה
                  </button>
                )}
                
                <button
                  onClick={processBatchReminders}
                  disabled={batchProcessing || selectedCandidates.size === 0}
                  className={`px-4 py-2 rounded-md transition-colors font-medium ${
                    batchProcessing || selectedCandidates.size === 0
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-orange-600 hover:bg-orange-700'
                  } text-white`}
                >
                  {batchProcessing 
                    ? 'שולח אצווה...' 
                    : `📤 שלח נבחרים (${selectedCandidates.size})`
                  }
                </button>
              </div>

              {selectedCandidates.size > 0 && (
                <div className="text-sm text-gray-600 bg-orange-50 border border-orange-200 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">נבחרו {selectedCandidates.size} מועמדים</span>
                  </div>
                  <div className="text-xs text-orange-700">
                    זמן משוער: {Math.ceil((selectedCandidates.size * 3.5) + (Math.floor(selectedCandidates.size / 20) * 30))} דקות 
                    (כולל הפסקות של 30 דקות כל 20 הודעות)
                  </div>
                </div>
              )}
            </div>
          )}

          {lastCheck && (
            <div className="text-sm text-gray-600 mt-4">
              בדיקה אחרונה: {lastCheck}
            </div>
          )}
        </div>

        {/* Batch Progress Display */}
        {showBatchProgress && batchProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">התקדמות שליחת אצווה</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-blue-800">סה״כ הודעות:</span>
                <span className="font-medium text-blue-900">{batchProgress.totalCount}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-blue-800">נשלחו בהצלחה:</span>
                <span className="font-medium text-green-700">{batchProgress.sentCount}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-blue-800">נכשלו:</span>
                <span className="font-medium text-red-700">{batchProgress.failedCount}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${((batchProgress.sentCount + batchProgress.failedCount) / batchProgress.totalCount) * 100}%` 
                  }}
                ></div>
              </div>
              
              <div className="text-sm text-blue-700">
                {batchProgress.currentStatus === 'preparing' && '🔄 מכין להעברה...'}
                {batchProgress.currentStatus === 'sending' && `📤 שולח ל-${batchProgress.currentRecipient || 'מועמד'}...`}
                {batchProgress.currentStatus === 'sleeping' && '😴 הפסקה של 30 דקות...'}
                {batchProgress.currentStatus === 'completed' && '✅ הושלם!'}
                {batchProgress.currentStatus === 'failed' && '❌ נכשל'}
                
                {batchProgress.estimatedTimeRemaining && batchProgress.estimatedTimeRemaining > 0 && (
                  <span className="mr-2">
                    (זמן משוער: {formatEstimatedTime(Math.ceil(batchProgress.estimatedTimeRemaining / 1000 / 60))})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Templates Editor */}
        {showTemplates && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">עריכת תבניות הודעות תזכורת</h2>
            
            <div className="space-y-6">
              {/* First Message Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  🆕 הודעה ראשונה (ללקוחות ללא טפסים)
                </label>
                <textarea
                  value={templates.first_message}
                  onChange={(e) => setTemplates({...templates, first_message: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={5}
                  placeholder="הודעה ראשונה ללקוחות ללא טפסים"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLink}`} לקישור הטופס. הודעה זו נשלחת ללקוחות שלא קיבלו עדיין אף טופס.
                </div>
              </div>

              {/* First Reminder Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  📅 תזכורת ראשונה (48 שעות)
                </label>
                <textarea
                  value={templates.first}
                  onChange={(e) => setTemplates({...templates, first: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={4}
                  placeholder="הודעת תזכורת ראשונה"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLabel}`} לשם הטופס
                </div>
              </div>

              {/* Second Reminder Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  📅 תזכורת שנייה (72 שעות נוספות)
                </label>
                <textarea
                  value={templates.second}
                  onChange={(e) => setTemplates({...templates, second: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={4}
                  placeholder="הודעת תזכורת שנייה"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLabel}`} לשם הטופס
                </div>
              </div>

              {/* First Week Reminder Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  📅 תזכורת שבוע ראשון (שבוע אחד לאחר התזכורת השנייה)
                </label>
                <textarea
                  value={templates.first_week}
                  onChange={(e) => setTemplates({...templates, first_week: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={4}
                  placeholder="הודעת תזכורת שבוע ראשון"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLabel}`} לשם הטופס
                </div>
              </div>

              {/* Second Week Reminder Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  📅 תזכורת שבוע שני (שבועיים לאחר התזכורת השנייה)
                </label>
                <textarea
                  value={templates.second_week}
                  onChange={(e) => setTemplates({...templates, second_week: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={4}
                  placeholder="הודעת תזכורת שבוע שני"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLabel}`} לשם הטופס
                </div>
              </div>

              {/* Third Week Reminder Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  📅 תזכורת שבוע שלישי (3 שבועות לאחר התזכורת השנייה)
                </label>
                <textarea
                  value={templates.third_week}
                  onChange={(e) => setTemplates({...templates, third_week: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={4}
                  placeholder="הודעת תזכורת שבוע שלישי"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLabel}`} לשם הטופס
                </div>
              </div>

              {/* Fourth Week Reminder Template */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  📅 תזכורת שבוע רביעי ואילך (חודש ויותר)
                </label>
                <textarea
                  value={templates.fourth_week}
                  onChange={(e) => setTemplates({...templates, fourth_week: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  rows={4}
                  placeholder="הודעת תזכורת שבוע רביעי"
                />
                <div className="text-xs text-gray-600 mt-1">
                  השתמש ב-{`{customerName}`} לשם הלקוח וב-{`{formLabel}`} לשם הטופס - זוהי התזכורת האחרונה שתישלח שוב ושוב
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={saveTemplates}
                  disabled={savingTemplates}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    savingTemplates
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white font-medium`}
                >
                  {savingTemplates ? 'שומר...' : '💾 שמור תבניות'}
                </button>
                <button
                  onClick={() => {
                    setShowTemplates(false)
                    loadTemplates() // Reset to saved versions
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidates List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-3">
            <span>מועמדים לתזכורת ({candidates.length})</span>
            {selectedCandidates.size > 0 && (
              <span className="text-sm bg-orange-600 text-white px-3 py-1 rounded-full">
                {selectedCandidates.size} נבחרו
              </span>
            )}
          </h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">טוען...</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              🎉 אין תזכורות ממתינות כרגע
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate, index) => {
                const isFirstMessage = candidate.reminderType === 'first_message'
                const candidateKey = getCandidateKey(candidate)
                const isSelected = selectedCandidates.has(candidateKey)
                const bgColor = isSelected 
                  ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-200' 
                  : isFirstMessage 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
                
                return (
                  <div key={index} className={`border rounded-lg p-4 transition-all duration-200 ${bgColor}`}>
                    <div className="flex justify-between items-start">
                      {/* Checkbox and Content */}
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex items-center pt-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleCandidateSelect(candidate, e.target.checked)}
                            className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            📱 {candidate.phoneNumber}
                            {isFirstMessage && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">הודעה ראשונה</span>}
                            {isSelected && <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">נבחר</span>}
                          </div>
                          <div className="text-sm text-gray-700 mt-1">
                            📋 {candidate.formTypeLabel || candidate.formType}
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-gray-600 flex-wrap">
                            <span>🔔 סוג תזכורת: {
                              candidate.reminderType === 'first_message' ? 'הודעה ראשונה' :
                              candidate.reminderType === 'first' ? 'תזכורת ראשונה' :
                              candidate.reminderType === 'second' ? 'תזכורת שנייה' :
                              candidate.reminderType === 'first_week' ? 'שבוע ראשון' :
                              candidate.reminderType === 'second_week' ? 'שבוע שני' :
                              candidate.reminderType === 'third_week' ? 'שבוע שלישי' :
                              candidate.reminderType === 'fourth_week' ? 'שבוع רביעי' :
                              candidate.reminderType
                            }</span>
                            <span>📅 ימים מאז פעולה: {candidate.daysSinceLastAction}</span>
                            <span>📊 תזכורות שנשלחו: {candidate.reminderCount}</span>
                          </div>
                          {isFirstMessage && (
                            <div className="mt-2 text-xs text-blue-700 font-medium">
                              🆕 לקוח ללא טפסים - יקבל קישור עם אימות וקיצור אוטומטי
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendManualReminder(candidate.phoneNumber, candidate.formType)}
                          disabled={batchProcessing}
                          className={`text-xs px-3 py-1 rounded transition-colors ${
                            batchProcessing 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-orange-600 hover:bg-orange-700'
                          } text-white`}
                        >
                          שלח עכשיו
                        </button>
                        <Link
                          href={`/admin/customers/${encodeURIComponent(candidate.phoneNumber)}`}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                        >
                          צפה בלקוח
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">איך זה עובד?</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <div>• 🆕 <strong>הודעות ראשונות:</strong> לקוחות ללא טפסים יקבלו הודעה ראשונה עם קישור מאומת וקצר אוטומטית</div>
            <div>• 📤 כאשר טופס נשלח ללקוח, הטיימר מתחיל</div>
            <div>• ⏰ לאחר 48 שעות - תזכורת ראשונה (אם אין אינטראקציה)</div>
            <div>• ⏰ לאחר 72 שעות נוספות - תזכורת שנייה</div>
            <div>• 📅 שבוע אחד לאחר מכן - תזכורת שבוע ראשון</div>
            <div>• 📅 שבוע שני - תזכורת שבוע שני</div>
            <div>• 📅 שבוע שלישי - תזכורת שבוע שלישי</div>
            <div>• 📅 שבוע רביעי ואילך - תזכורת אחרונה (חוזרת כל שבוע)</div>
            <div>• 🎯 אינטראקציות (העלאת קבצים) מאפסות את הטיימר</div>
            <div>• 🔧 <strong>סוג הטופס נקבע אוטומטית</strong> על פי השדה &ldquo;קריטריון&rdquo; של הלקוח</div>
          </div>
        </div>
      </div>
    </div>
  )
}