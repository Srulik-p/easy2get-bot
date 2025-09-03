'use client';

import { useState } from 'react';
import formData from '@/data/form-fields.json';

interface NewCustomerLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendLink: (phoneNumber: string, formType: string, message: string) => Promise<void>;
}

export default function NewCustomerLinkModal({ isOpen, onClose, onSendLink }: NewCustomerLinkModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedFormType, setSelectedFormType] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  const formTypes = formData.formTypes;

  const handleSend = async () => {
    if (!phoneNumber.trim() || !selectedFormType) return;

    setSending(true);
    try {
      const formLink = `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber.trim())}&type=${selectedFormType}`;
      
      const defaultMessage = `שלום! 👋

בהמשך לשיחתינו ועל מנת שנוכל לקדם את הבקשה שלך מול המשרד לביטחון פנים יש להמציא את המסמכים המופרטים ברשימה הבאה:

${formLink}

בברכה, Easy2Get`;

      const messageToSend = customMessage.trim() || defaultMessage;
      
      await onSendLink(phoneNumber.trim(), selectedFormType, messageToSend);
      
      // Reset form
      setPhoneNumber('');
      setSelectedFormType('');
      setCustomMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const generatePreview = () => {
    if (!phoneNumber.trim() || !selectedFormType) return '';
    
    const formLink = `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber.trim())}&type=${selectedFormType}`;
    
    return `שלום! 👋

בהמשך לשיחתינו ועל מנת שנוכל לקדם את הבקשה שלך מול המשרד לביטחון פנים יש להמציא את המסמכים המופרטים ברשימה הבאה:

${formLink}

בברכה, Easy2Get`;
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as Israeli phone number
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else if (digits.length <= 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const isValidPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 && (digits.startsWith('05') || digits.startsWith('02') || digits.startsWith('03') || digits.startsWith('04') || digits.startsWith('08') || digits.startsWith('09'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">שלח קישור ללקוח חדש</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={sending}
            >
              ×
            </button>
          </div>

          {/* Phone Number Input */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              מספר טלפון: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="050-123-4567"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                phoneNumber && !isValidPhone(phoneNumber) 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-300'
              }`}
              disabled={sending}
              maxLength={12}
            />
            {phoneNumber && !isValidPhone(phoneNumber) && (
              <p className="text-red-500 text-sm mt-1">אנא הזן מספר טלפון ישראלי תקין</p>
            )}
          </div>

          {/* Form Type Selection */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              בחר סוג טופס: <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedFormType}
              onChange={(e) => setSelectedFormType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              aria-label="בחר סוג טופס"
              disabled={sending}
            >
              <option value="">בחר סוג טופס...</option>
              {formTypes.map((type) => (
                <option key={type.slug} value={type.slug}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Message */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              הודעה מותאמת אישית (אופציונלי)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="השאר ריק לשימוש בהודעה הברירת מחדל..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 min-h-[120px]"
              disabled={sending}
            />
          </div>

          {/* Preview */}
          {phoneNumber && selectedFormType && isValidPhone(phoneNumber) && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3">תצוגה מקדימה של ההודעה:</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-gray-800 whitespace-pre-line">
                  {customMessage.trim() || generatePreview()}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={sending}
            >
              ביטול
            </button>
            <button
              onClick={handleSend}
              disabled={!phoneNumber || !selectedFormType || !isValidPhone(phoneNumber) || sending}
              className={`px-6 py-3 rounded-lg transition-colors ${
                !phoneNumber || !selectedFormType || !isValidPhone(phoneNumber) || sending
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {sending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  שולח...
                </div>
              ) : (
                '📱 שלח לוואטסאפ'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
