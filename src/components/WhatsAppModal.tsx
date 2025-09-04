'use client';

import { useState, useEffect } from 'react';
import formData from '@/data/form-fields.json';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  onSendLink: (formType: string, message: string) => Promise<void>;
}

export default function WhatsAppModal({ isOpen, onClose, phoneNumber, onSendLink }: WhatsAppModalProps) {
  const [selectedFormType, setSelectedFormType] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [generateAuthorizedLink, setGenerateAuthorizedLink] = useState(true);
  const [useShortUrl, setUseShortUrl] = useState(true);
  const [tokenExpiry, setTokenExpiry] = useState(90);
  const [isReusableToken, setIsReusableToken] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<{
    regular?: string;
    short?: string;
    tokenized?: string;
    tokenizedShort?: string;
  }>({});
  const [urlGenerating, setUrlGenerating] = useState(false);

  const formTypes = formData.formTypes;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFormType('');
      setCustomMessage('');
      setGeneratedUrls({});
      // Keep the checkboxes as they are (true by default)
      console.log('Modal opened, settings:', { generateAuthorizedLink, useShortUrl });
    }
  }, [isOpen, generateAuthorizedLink, useShortUrl]);

  const generateUrls = async () => {
    if (!selectedFormType) return;

    setUrlGenerating(true);
    try {
      const formTypeData = formTypes.find(ft => ft.slug === selectedFormType);
      const formTypeLabel = formTypeData?.label || selectedFormType;
      
      let finalUrl = `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber)}&type=${encodeURIComponent(selectedFormType)}`;
      let token = '';

      // Step 1: Generate authorization token if requested
      if (generateAuthorizedLink) {
        try {
          // Convert phone number to +972 format for API
          const trimmedPhone = phoneNumber.trim();
          let formattedPhone;
          
          if (trimmedPhone.startsWith('+972')) {
            // Already in correct format
            formattedPhone = trimmedPhone;
          } else if (trimmedPhone.startsWith('972')) {
            // Missing + prefix
            formattedPhone = `+${trimmedPhone}`;
          } else {
            // Israeli local format (05X-XXX-XXXX or 05XXXXXXXX)
            const cleanPhone = trimmedPhone.replace(/\D/g, ''); // Remove all non-digits
            formattedPhone = cleanPhone.startsWith('0') 
              ? `+972${cleanPhone.substring(1)}` 
              : `+972${cleanPhone}`;
          }
          
          console.log('Original phone:', phoneNumber, 'Formatted phone:', formattedPhone);
          
          const tokenResponse = await fetch('/api/auth/create-token', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: formattedPhone,
              formType: selectedFormType,
              expiryDays: tokenExpiry,
              isReusable: isReusableToken,
              adminKey: 'shimi-admin-2024-secure-key-auth-tokens'
            })
          });

          const tokenData = await tokenResponse.json();
          if (tokenData.success) {
            token = tokenData.data.token;
            finalUrl = tokenData.data.tokenizedURL;
          } else {
            console.warn('Failed to generate token:', tokenData.error);
          }
        } catch (error) {
          console.error('Error generating token:', error);
        }
      }

      const urls: {
        regular?: string;
        tokenized?: string;
        short?: string;
        tokenizedShort?: string;
      } = {
        regular: `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber)}&type=${encodeURIComponent(selectedFormType)}`,
        tokenized: token ? finalUrl : undefined
      };

      // Step 2: Generate short URLs if requested
      if (useShortUrl) {
        try {
          // Generate short URL for regular link
          const regularShortResponse = await fetch('/api/urls/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: phoneNumber,
              formType: selectedFormType,
              formTypeLabel: formTypeLabel
            })
          });

          const regularShortData = await regularShortResponse.json();
          if (regularShortData.success) {
            urls.short = regularShortData.shortUrl;
          }

          // Generate short URL for tokenized link if we have a token
          if (token) {
            const tokenizedShortResponse = await fetch('/api/urls/shorten', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phoneNumber: phoneNumber,
                formType: selectedFormType,
                formTypeLabel: formTypeLabel,
                token: token
              })
            });

            const tokenizedShortData = await tokenizedShortResponse.json();
            if (tokenizedShortData.success) {
              urls.tokenizedShort = tokenizedShortData.shortUrl;
            }
          }
        } catch (error) {
          console.error('Error generating short URLs:', error);
        }
      }

      setGeneratedUrls(urls);
    } catch (error) {
      console.error('Error generating URLs:', error);
    } finally {
      setUrlGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!selectedFormType) return;

    setSending(true);
    try {
      // Auto-generate URLs if not already generated
      if (Object.keys(generatedUrls).length === 0) {
        console.log('Auto-generating URLs with settings:', { generateAuthorizedLink, useShortUrl });
        await generateUrls();
        console.log('Generated URLs:', generatedUrls);
      }

      // Use the best available URL (prioritize short tokenized > tokenized > short > regular)
      let linkToUse = generatedUrls.regular || `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber)}&type=${encodeURIComponent(selectedFormType)}`;
      
      if (generateAuthorizedLink && useShortUrl && generatedUrls.tokenizedShort) {
        linkToUse = generatedUrls.tokenizedShort;
        console.log('Using tokenized short URL:', linkToUse);
      } else if (generateAuthorizedLink && generatedUrls.tokenized) {
        linkToUse = generatedUrls.tokenized;
        console.log('Using tokenized URL:', linkToUse);
      } else if (useShortUrl && generatedUrls.short) {
        linkToUse = generatedUrls.short;
        console.log('Using short URL:', linkToUse);
      } else {
        console.log('Using fallback regular URL:', linkToUse);
      }
      
      const defaultMessage = `שלום! 👋

בהמשך לשיחתינו ועל מנת שנוכל לקדם את הבקשה שלך מול המשרד לביטחון פנים יש להמציא את המסמכים המופרטים ברשימה הבאה:

${linkToUse}

בברכה, Easy2Get`;

      const messageToSend = customMessage.trim() || defaultMessage;
      
      await onSendLink(selectedFormType, messageToSend);
      
      // Reset form
      setSelectedFormType('');
      setCustomMessage('');
      setGeneratedUrls({});
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const generatePreview = () => {
    if (!selectedFormType) return '';
    
    // Use the best available URL for preview (same logic as handleSend)
    let linkToUse = generatedUrls.regular || `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber)}&type=${encodeURIComponent(selectedFormType)}`;
    
    if (generateAuthorizedLink && useShortUrl && generatedUrls.tokenizedShort) {
      linkToUse = generatedUrls.tokenizedShort;
    } else if (generateAuthorizedLink && generatedUrls.tokenized) {
      linkToUse = generatedUrls.tokenized;
    } else if (useShortUrl && generatedUrls.short) {
      linkToUse = generatedUrls.short;
    }
    
    return `שלום! 👋

בהמשך לשיחתינו ועל מנת שנוכל לקדם את הבקשה שלך מול המשרד לביטחון פנים יש להמציא את המסמכים המופרטים ברשימה הבאה:

${linkToUse}

בברכה, Easy2Get`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">שלח קישור לטופס</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={sending}
            >
              ×
            </button>
          </div>

          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">פרטי לקוח</h3>
            <p className="text-gray-700">מספר טלפון: {phoneNumber}</p>
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

          {/* Authorization and URL Options */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">אפשרויות קישור מתקדמות</h3>
            
            {/* Authorization Toggle */}
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="generateAuthorized"
                checked={generateAuthorizedLink}
                onChange={(e) => setGenerateAuthorizedLink(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={sending}
              />
              <label htmlFor="generateAuthorized" className="mr-2 text-sm font-medium text-gray-900">
                צור קישור מורשה (ללא צורך באימות SMS)
              </label>
            </div>


            {/* Short URL Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useShortUrl"
                checked={useShortUrl}
                onChange={(e) => setUseShortUrl(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={sending}
              />
              <label htmlFor="useShortUrl" className="mr-2 text-sm font-medium text-gray-900">
                צור קישור קצר (עבור וואטסאפ)
              </label>
            </div>
          </div>

          {/* URL Generation Button */}
          {selectedFormType && (
            <div className="mb-6">
              <button
                onClick={generateUrls}
                disabled={urlGenerating || sending}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  urlGenerating 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {urlGenerating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    מכין קישורים...
                  </div>
                ) : (
                  '🔗 הכן קישורים'
                )}
              </button>
            </div>
          )}

          {/* URL Preview Section - Only show URLs based on selected checkboxes */}
          {(generatedUrls.tokenizedShort || generatedUrls.tokenized || generatedUrls.short) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">קישורים שנוצרו:</h3>
              <div className="space-y-2 text-sm">
                {generatedUrls.tokenizedShort && (
                  <div className="p-2 bg-green-100 border border-green-200 rounded">
                    <div className="font-medium text-green-800 mb-1">✅ קישור מורשה וקצר (מומלץ)</div>
                    <div className="text-green-700 font-mono break-all">{generatedUrls.tokenizedShort}</div>
                  </div>
                )}
                {generatedUrls.tokenized && !generatedUrls.tokenizedShort && (
                  <div className="p-2 bg-blue-100 border border-blue-200 rounded">
                    <div className="font-medium text-blue-800 mb-1">🔐 קישור מורשה</div>
                    <div className="text-blue-700 font-mono break-all">{generatedUrls.tokenized}</div>
                  </div>
                )}
                {generatedUrls.short && !generatedUrls.tokenizedShort && !generatedUrls.tokenized && (
                  <div className="p-2 bg-yellow-100 border border-yellow-200 rounded">
                    <div className="font-medium text-yellow-800 mb-1">🔗 קישור קצר</div>
                    <div className="text-yellow-700 font-mono break-all">{generatedUrls.short}</div>
                  </div>
                )}
              </div>
            </div>
          )}

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
          {selectedFormType && (
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
              disabled={!selectedFormType || sending}
              className={`px-6 py-3 rounded-lg transition-colors ${
                !selectedFormType || sending
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
