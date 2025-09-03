'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ReminderCandidate {
  phoneNumber: string
  formType: string
  reminderType: string
  daysSinceLastAction: number
  reminderCount: number
}

interface MessageTemplates {
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
  const [templates, setTemplates] = useState<MessageTemplates>({
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
          
          <div className="flex gap-4 mb-4">
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
              {processing ? 'מעבד...' : `שלח ${candidates.length} תזכורות`}
            </button>
            
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              {showTemplates ? 'סגור עריכת הודעות' : '✏️ ערוך הודעות תזכורת'}
            </button>
          </div>

          {lastCheck && (
            <div className="text-sm text-gray-600">
              בדיקה אחרונה: {lastCheck}
            </div>
          )}
        </div>

        {/* Message Templates Editor */}
        {showTemplates && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">עריכת תבניות הודעות תזכורת</h2>
            
            <div className="space-y-6">
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
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            מועמדים לתזכורת ({candidates.length})
          </h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">טוען...</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              🎉 אין תזכורות ממתינות כרגע
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        📱 {candidate.phoneNumber}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        📋 {candidate.formType}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-600">
                        <span>🔔 סוג תזכורת: {candidate.reminderType}</span>
                        <span>📅 ימים מאז פעולה: {candidate.daysSinceLastAction}</span>
                        <span>📊 תזכורות שנשלחו: {candidate.reminderCount}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendManualReminder(candidate.phoneNumber, candidate.formType)}
                        className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
                      >
                        שלח עכשיו
                      </button>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(candidate.phoneNumber)}`}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        צפה בלקוח
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">איך זה עובד?</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <div>• 📤 כאשר טופס נשלח ללקוח, הטיימר מתחיל</div>
            <div>• ⏰ לאחר 48 שעות - תזכורת ראשונה (אם אין אינטראקציה)</div>
            <div>• ⏰ לאחר 72 שעות נוספות - תזכורת שנייה</div>
            <div>• 📅 שבוע אחד לאחר מכן - תזכורת שבוע ראשון</div>
            <div>• 📅 שבוע שני - תזכורת שבוע שני</div>
            <div>• 📅 שבוע שלישי - תזכורת שבוע שלישי</div>
            <div>• 📅 שבוע רביעי ואילך - תזכורת אחרונה (חוזרת כל שבוע)</div>
            <div>• 🎯 אינטראקציות (העלאת קבצים) מאפסות את הטיימר</div>
          </div>
        </div>
      </div>
    </div>
  )
}