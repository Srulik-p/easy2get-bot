'use client';

import { useState, useEffect } from 'react';
import formData from '@/data/form-fields.json';
import { SupabaseService } from '@/lib/supabase-service';

interface NewCustomerLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendLink: (phoneNumber: string, formType: string, message: string, customerName?: string) => Promise<void>;
}

export default function NewCustomerLinkModal({ isOpen, onClose, onSendLink }: NewCustomerLinkModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
      setPhoneNumber('');
      setFirstName('');
      setLastName('');
      setSelectedFormType('');
      setCustomMessage('');
      setGeneratedUrls({});
      // Keep the checkboxes as they are (true by default)
      console.log('NewCustomerModal opened, settings:', { generateAuthorizedLink, useShortUrl });
    }
  }, [isOpen, generateAuthorizedLink, useShortUrl]);

  const generateUrls = async () => {
    if (!phoneNumber.trim() || !selectedFormType || !isValidPhone(phoneNumber)) return;

    setUrlGenerating(true);
    try {
      const formTypeData = formTypes.find(ft => ft.slug === selectedFormType);
      const formTypeLabel = formTypeData?.label || selectedFormType;
      
      const finalUrl = `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber.trim())}&type=${encodeURIComponent(selectedFormType)}`;
      
      const urls: { regular?: string; short?: string; tokenized?: string; tokenizedShort?: string } = {
        regular: finalUrl
      };

      console.log('Generating URLs with options:', { generateAuthorizedLink, useShortUrl });

      // Generate authorized token if requested
      if (generateAuthorizedLink) {
        console.log('Attempting to create authorization token...');
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
          
          console.log('Original phone:', phoneNumber.trim(), 'Formatted phone:', formattedPhone);
          
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

          console.log('Token response status:', tokenResponse.status);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log('Token response data:', tokenData);
            urls.tokenized = tokenData.data.tokenizedURL;
            console.log('Created authorized URL:', urls.tokenized);
          } else {
            const errorText = await tokenResponse.text();
            console.error('Failed to create authorization token:', tokenResponse.status, errorText);
          }
        } catch (error) {
          console.error('Error creating authorization token:', error);
        }
      }

      // Generate short URLs if requested
      if (useShortUrl) {
        try {
          // Short URL for regular link
          console.log('Attempting to create short URL for:', finalUrl);
          const shortResponse = await fetch('/api/urls/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              longUrl: finalUrl,
              phoneNumber: phoneNumber.trim(),
              formType: selectedFormType,
              formTypeLabel: formTypeLabel
            })
          });

          console.log('Short URL response status:', shortResponse.status);
          if (shortResponse.ok) {
            const shortData = await shortResponse.json();
            console.log('Short URL response data:', shortData);
            if (shortData.success) {
              urls.short = shortData.shortUrl;
              console.log('Created short URL:', urls.short);
            } else {
              console.error('Short URL creation failed:', shortData.error);
            }
          } else {
            const errorText = await shortResponse.text();
            console.error('Short URL API error:', errorText);
          }

          // Short URL for tokenized link (if exists)
          if (urls.tokenized) {
            const tokenizedShortResponse = await fetch('/api/urls/shorten', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                longUrl: urls.tokenized,
                phoneNumber: phoneNumber.trim(),
                formType: selectedFormType,
                formTypeLabel: formTypeLabel
              })
            });

            if (tokenizedShortResponse.ok) {
              const tokenizedShortData = await tokenizedShortResponse.json();
              console.log('Tokenized short URL response data:', tokenizedShortData);
              if (tokenizedShortData.success) {
                urls.tokenizedShort = tokenizedShortData.shortUrl;
                console.log('Created tokenized short URL:', urls.tokenizedShort);
              } else {
                console.error('Tokenized short URL creation failed:', tokenizedShortData.error);
              }
            }
          }
        } catch (error) {
          console.error('Error creating short URLs:', error);
        }
      }

      setGeneratedUrls(urls);
      console.log('Final URLs generated:', urls);

    } catch (error) {
      console.error('Error generating URLs:', error);
    } finally {
      setUrlGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!phoneNumber.trim() || !selectedFormType) return;

    setSending(true);
    try {
      // Use the best available URL (prioritize short tokenized > tokenized > short > regular)
      let linkToUse = generatedUrls.regular || `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber.trim())}&type=${encodeURIComponent(selectedFormType)}`;
      
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
      
      // Combine first and last name if either exists
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || undefined;
      
      // Create database entries before sending the message
      try {
        // Get form type label for database
        const formTypeData = formTypes.find(ft => ft.slug === selectedFormType);
        const formTypeLabel = formTypeData?.label || selectedFormType;
        
        // Create or update customer in database
        const phoneForDb = phoneNumber.trim();
        const customerData = {
          phone_number: phoneForDb,
          name: firstName.trim() || undefined,
          family_name: lastName.trim() || undefined,
          status: 'new_lead' as const
        };
        
        console.log('Creating customer in database:', customerData);
        let customer = await SupabaseService.getOrCreateCustomer(phoneForDb);
        
        // If customer exists but we have name data, update it
        if (customer && (firstName.trim() || lastName.trim())) {
          const updateData: any = {};
          if (firstName.trim()) updateData.name = firstName.trim();
          if (lastName.trim()) updateData.family_name = lastName.trim();
          if (Object.keys(updateData).length > 0) {
            await SupabaseService.updateCustomer(customer.id, updateData);
          }
        }
        
        // Create form submission entry in database
        console.log('Creating form submission entry:', {
          phoneNumber: phoneForDb,
          formType: selectedFormType,
          formTypeLabel
        });
        
        const submission = await SupabaseService.getOrCreateSubmission(
          phoneForDb,
          selectedFormType,
          formTypeLabel
        );
        
        if (submission) {
          // Mark when the form was first sent
          await SupabaseService.updateSubmissionSentTracking(
            submission.id!,
            new Date().toISOString()
          );
          console.log('Form submission entry created/updated successfully');
        } else {
          console.warn('Failed to create form submission entry');
        }
      } catch (dbError) {
        console.error('Error creating database entries:', dbError);
        // Continue with sending the message even if database operations fail
      }
      
      await onSendLink(phoneNumber.trim(), selectedFormType, messageToSend, fullName);
      
      // Reset form
      setPhoneNumber('');
      setFirstName('');
      setLastName('');
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
    if (!phoneNumber.trim() || !selectedFormType) return '';
    
    // Use the best available URL for preview (same logic as handleSend)
    let linkToUse = generatedUrls.regular || `${window.location.origin}/?phone=${encodeURIComponent(phoneNumber.trim())}&type=${encodeURIComponent(selectedFormType)}`;
    
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

          {/* Customer Name Inputs */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              שם הלקוח: <span className="text-gray-500">(אופציונלי)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="שם פרטי"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                disabled={sending}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="שם משפחה"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                disabled={sending}
              />
            </div>
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
          {phoneNumber && selectedFormType && isValidPhone(phoneNumber) && (
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

          {/* URL Preview Section */}
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
