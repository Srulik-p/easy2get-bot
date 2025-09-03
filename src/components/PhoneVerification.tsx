'use client'

import { useState } from 'react'
import { AuthService } from '@/lib/auth-service'

interface PhoneVerificationProps {
  onVerified: (phoneNumber: string) => void
  initialPhone?: string
}

// Helper functions
const formatPhoneNumber = (phone: string) => {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // Format as Israeli phone number with +972 prefix
  if (digits.startsWith('972')) {
    return '+' + digits
  } else if (digits.startsWith('0')) {
    return '+972' + digits.substring(1)
  } else if (digits.length === 9) {
    return '+972' + digits
  }
  return '+972' + digits
}

const displayPhoneNumber = (phone: string) => {
  // Convert +972xxxxxxxxx to 0xx-xxx-xxxx format for display
  if (phone.startsWith('+972')) {
    const localNumber = phone.substring(4)
    if (localNumber.length >= 9) {
      return `0${localNumber.substring(0, 2)}-${localNumber.substring(2, 5)}-${localNumber.substring(5)}`
    }
  }
  return phone
}

export default function PhoneVerification({ onVerified, initialPhone = '' }: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  // Convert initial phone to display format if it starts with +972
  const [phoneNumber, setPhoneNumber] = useState(
    initialPhone.startsWith('+972') ? displayPhoneNumber(initialPhone) : initialPhone
  )
  const [verificationCode, setVerificationCode] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validatePhoneNumber = (phone: string) => {
    const formattedPhone = formatPhoneNumber(phone)
    const phoneRegex = /^\+972[5-9]\d{8}$/
    return phoneRegex.test(formattedPhone)
  }

  const handleSendCode = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setError('מספר טלפון לא תקין. אנא הזן מספר ישראלי תקין')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber)
      
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSentCode(result.code) // In production, this should not be returned to client
        setStep('code')
        setPhoneNumber(formattedPhone)
      } else {
        setError(result.error || 'שגיאה בשליחת הקוד')
      }
    } catch (error) {
      console.error('Error sending verification code:', error)
      setError('שגיאה בשליחת הקוד. נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('אנא הזן קוד בן 6 ספרות')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          code: verificationCode
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Set client-side authentication cookie
        AuthService.setClientAuth(phoneNumber)
        onVerified(phoneNumber)
      } else {
        setError(result.error || 'קוד שגוי. נסה שוב')
      }
    } catch (error) {
      console.error('Error verifying code:', error)
      setError('שגיאה באימות הקוד. נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPhoneNumber(value)
    setError('')
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setVerificationCode(value)
    setError('')
  }

  const handleResendCode = () => {
    setVerificationCode('')
    setStep('phone')
    setSentCode('')
  }

  if (step === 'phone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">אימות טלפון</h1>
              <p className="text-gray-600">
                אנא הזן את מספר הטלפון שלך לאימות
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  מספר טלפון
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="050-1234567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-gray-900"
                  dir="ltr"
                />
                <p className="text-sm text-gray-500 mt-1">
                  הזן מספר ישראלי (למשל: 050-1234567)
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={loading || !phoneNumber}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  loading || !phoneNumber
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {loading ? 'שולח קוד...' : 'שלח קוד אימות'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">אימות קוד</h1>
            <p className="text-gray-600 mb-2">
              נשלח קוד אימות בן 6 ספרות לטלפון:
            </p>
            <p className="text-lg font-semibold text-blue-600" dir="ltr">
              {displayPhoneNumber(phoneNumber)}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                קוד אימות
              </label>
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={handleCodeChange}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center font-mono text-gray-900"
                dir="ltr"
              />
              <p className="text-sm text-gray-500 mt-1">
                הזן את הקוד בן 6 הספרות שקיבלת
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Development helper - remove in production */}
            {sentCode && process.env.NODE_ENV === 'development' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">קוד לפיתוח: {sentCode}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  loading || verificationCode.length !== 6
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                {loading ? 'מאמת...' : 'אמת קוד'}
              </button>

              <button
                onClick={handleResendCode}
                disabled={loading}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                שלח קוד חדש
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}