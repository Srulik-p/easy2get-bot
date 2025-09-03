'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import formData from '@/data/form-fields.json';
import { SupabaseService } from '@/lib/supabase-service';
import { CustomerSubmission, UploadedFile } from '@/lib/supabase';
import { AuthService } from '@/lib/auth-service';
import CustomFileInput from './CustomFileInput';
import PhoneVerification from './PhoneVerification';

interface FileUploadState {
  [key: string]: File | null;
}

interface FormField {
  name: string;
  number: number;
  slug: string;
  isSection?: boolean;
  sectionType?: string;
  sectionTitle?: string;
  requiredCount?: number;
  options?: Array<{ label: string; slug: string }>;
  isMailDocument?: boolean;
  description?: string;
  template?: string;
  templates?: Array<{ label: string; path: string }>;
  optional?: boolean;
}

interface FormTypeField {
  fieldSlug: string;
  number: number;
  optional?: boolean;
  isSection?: boolean;
  sectionType?: string;
  sectionTitle?: string;
  requiredCount?: number;
  options?: Array<{ label: string; slug: string }>;
}

const formTypes = formData.formTypes;

// Helper function to display phone number in normal Israeli format
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

// Function to get form fields for a specific type
const getFormFields = (formTypeSlug: string, selectedMailDocs: string[] = []) => {
  const formType = formTypes.find(type => type.slug === formTypeSlug);
  if (!formType) return [];
  
  const fields: FormField[] = [];
  
  formType.fields.forEach(field => {
    // Handle mail documents section
    if (field.isSection && field.sectionType === 'mail-documents') {
      fields.push({
        name: field.sectionTitle || '',
        number: field.number,
        slug: field.fieldSlug,
        isSection: true,
        sectionType: field.sectionType,
        sectionTitle: field.sectionTitle,
        requiredCount: field.requiredCount,
        options: field.options
      });
      
      // Add selected mail documents as individual fields
      selectedMailDocs.forEach((docSlug, index) => {
        const option = field.options?.find((opt) => opt.slug === docSlug);
        if (option) {
          fields.push({
            name: option.label,
            number: field.number + index + 1,
            slug: docSlug,
            isMailDocument: true
          });
        }
      });
      return;
    }
    
    // Handle other section headers
    if (field.isSection) {
      fields.push({
        name: field.sectionTitle || '',
        number: field.number,
        slug: field.fieldSlug,
        isSection: true,
        sectionTitle: field.sectionTitle
      });
      return;
    }
    
    const fieldData = (formData.fields as Record<string, { 
      name: string; 
      slug: string; 
      description?: string;
      variants?: string[]; 
      template?: string;
      templates?: Array<{ label: string; path: string }>;
    }>)[field.fieldSlug];
    
         fields.push({
       name: fieldData?.name || '',
       description: fieldData?.description,
       number: field.number,
       slug: field.fieldSlug,
       template: fieldData?.template,
       templates: fieldData?.templates,
       optional: (field as FormTypeField).optional || false
     });
  });
  
  return fields;
};

export default function CustomerForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const phoneNumberFromUrl = searchParams.get('phone') || '';
  const formTypeFromUrl = searchParams.get('type') || '';
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState('');
  
  // Check if the form type from URL is valid, otherwise use first form type
  const initialFormType = formTypes.find(type => type.slug === formTypeFromUrl)?.slug || formTypes[0].slug;
  const [selectedType, setSelectedType] = useState(initialFormType);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadState>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<CustomerSubmission | null>(null);
  const [uploadedFilesList, setUploadedFilesList] = useState<UploadedFile[]>([]);


  const [fieldLoading, setFieldLoading] = useState<{[key: string]: boolean}>({});
  const [selectedMailDocuments, setSelectedMailDocuments] = useState<string[]>([]);

  // Get current form fields based on selected type
  const currentFormFields = getFormFields(selectedType, selectedMailDocuments);

  // Phone number to use (verified phone takes priority over URL phone)
  const phoneNumber = verifiedPhoneNumber || phoneNumberFromUrl;

  // Check if user has authenticated phone number
  useEffect(() => {
    // Check for existing authentication cookie
    const existingAuth = AuthService.getClientAuth();
    
    if (existingAuth) {
      // If we have valid auth and it matches the URL phone, auto-authenticate
      if (phoneNumberFromUrl && existingAuth.phoneNumber === phoneNumberFromUrl) {
        setVerifiedPhoneNumber(existingAuth.phoneNumber);
        setIsAuthenticated(true);
        return;
      }
      
      // If we have auth but no phone in URL, use the authenticated phone
      if (!phoneNumberFromUrl) {
        setVerifiedPhoneNumber(existingAuth.phoneNumber);
        setIsAuthenticated(true);
        
        // Update URL with authenticated phone
        const params = new URLSearchParams(searchParams.toString());
        params.set('phone', existingAuth.phoneNumber);
        router.push(`/?${params.toString()}`);
        return;
      }
    }
    
    // No valid authentication found, require verification
    setIsAuthenticated(false);
  }, [phoneNumberFromUrl, searchParams, router]);

  // Handle successful phone verification
  const handlePhoneVerified = (phone: string) => {
    setVerifiedPhoneNumber(phone);
    setIsAuthenticated(true);
    
    // Update URL with verified phone number
    const params = new URLSearchParams(searchParams.toString());
    params.set('phone', phone);
    router.push(`/?${params.toString()}`);
  };

  // Handle logout
  const handleLogout = () => {
    AuthService.clearClientAuth();
    setIsAuthenticated(false);
    setVerifiedPhoneNumber('');
    
    // Redirect to home without phone parameter
    const params = new URLSearchParams(searchParams.toString());
    params.delete('phone');
    router.push(params.toString() ? `/?${params.toString()}` : '/');
  };
  const selectedFormType = formTypes.find(type => type.slug === selectedType) || formTypes[0];

  // Clear uploaded files when form type changes
  useEffect(() => {
    setUploadedFiles({});
  }, [selectedType]);

  // Load existing submission data
  useEffect(() => {
    const loadExistingData = async () => {
      if (!phoneNumber) return;
      
      try {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') return;
        
        const currentFormType = formTypes.find(type => type.slug === selectedType) || formTypes[0];
        const submission = await SupabaseService.getOrCreateSubmission(
          phoneNumber, 
          selectedType, 
          currentFormType.label
        );
        
        if (submission) {
          setCurrentSubmission(submission);
          
          // Load uploaded files
          const files = await SupabaseService.getUploadedFiles(submission.id!);
          setUploadedFilesList(files);
          
          // Create uploadedFiles state from database records
          const fileState: FileUploadState = {};
          files.forEach(file => {
            fileState[file.field_slug] = new File([], file.file_name); // Placeholder file object
          });
          setUploadedFiles(fileState);
        }
      } catch (error) {
        console.error('Error loading existing data:', error);
      }
    };

    loadExistingData();
  }, [phoneNumber, selectedType]);

  const handleFileUpload = async (fieldSlug: string, file: File | null) => {
    if (!phoneNumber) {
      alert('יש להזין מספר טלפון בכתובת URL');
      return;
    }

    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co') {
      alert('מערכת האחסון אינה מוגדרת. אנא צור קשר עם מנהל המערכת.');
      return;
    }

    if (!file) {
      // Handle file removal
      if (currentSubmission) {
        setFieldLoading(prev => ({ ...prev, [fieldSlug]: true }));
        await SupabaseService.deleteFileForField(currentSubmission.id!, fieldSlug);
        
        // Update local state
        setUploadedFiles(prev => ({
          ...prev,
          [fieldSlug]: null
        }));
        
        // Reload files and auto-update submitted fields
        const files = await SupabaseService.getUploadedFiles(currentSubmission.id!);
        setUploadedFilesList(files);
        
        // Automatically update submitted fields
        const submittedFieldSlugs = files.map(file => file.field_slug);
        await SupabaseService.updateSubmittedFields(currentSubmission.id!, submittedFieldSlugs);
        
        setFieldLoading(prev => ({ ...prev, [fieldSlug]: false }));
      }
      return;
    }

    // Handle file upload
    setFieldLoading(prev => ({ ...prev, [fieldSlug]: true }));
    try {
      const fieldName = currentFormFields.find(f => f.slug === fieldSlug)?.name || '';
      
      const result = await SupabaseService.handleFileUpload(
        phoneNumber,
        selectedType,
        selectedFormType.label,
        fieldSlug,
        fieldName,
        file
      );

      if (result.success) {
        // Update local state
        setUploadedFiles(prev => ({
          ...prev,
          [fieldSlug]: file
        }));
        
        if (result.submission) {
          setCurrentSubmission(result.submission);
        }
        
        // Reload uploaded files and auto-update submitted fields
        if (result.submission) {
          const files = await SupabaseService.getUploadedFiles(result.submission.id!);
          setUploadedFilesList(files);
          
          // Automatically mark as submitted
          const submittedFieldSlugs = files.map(file => file.field_slug);
          await SupabaseService.updateSubmittedFields(result.submission.id!, submittedFieldSlugs);
        }
      } else {
        alert('שגיאה בהעלאת הקובץ. אנא נסה שוב.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('שגיאה בהעלאת הקובץ. אנא נסה שוב.');
    } finally {
      setFieldLoading(prev => ({ ...prev, [fieldSlug]: false }));
    }
  };


  const handleDragOver = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    setDragOver(fieldName);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, fieldSlug: string) => {
    e.preventDefault();
    setDragOver(null);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(fieldSlug, files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldSlug: string) => {
    const file = e.target.files?.[0] || null;
    handleFileUpload(fieldSlug, file);
  };

  const removeFile = (fieldSlug: string) => {
    handleFileUpload(fieldSlug, null);
  };

  const handleFormTypeChange = (newType: string) => {
    setSelectedType(newType);
    
    // Update URL with new form type
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', newType);
    if (phoneNumber) {
      params.set('phone', phoneNumber);
    }
    router.push(`/?${params.toString()}`);
  };

  // Show phone verification if not authenticated
  if (!isAuthenticated) {
    return (
      <PhoneVerification 
        onVerified={handlePhoneVerified}
        initialPhone={phoneNumberFromUrl}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">טופס לקוח</h1>
              {phoneNumber && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-lg text-gray-800">לקוח: {displayPhoneNumber(phoneNumber)}</p>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-600 hover:text-red-800 font-medium bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors"
                  >
                    התנתק
                  </button>
                </div>
              )}
              {!phoneNumber && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <p className="text-yellow-800">
                    הזן מספר טלפון בכתובת ה-URL: ?phone=050-1234567
                  </p>
                </div>
              )}
            </div>
            
            {/* Form Type Selection */}
            <div className="lg:w-80">
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                סוג הטופס:
              </label>
              <select
                value={selectedType}
                onChange={(e) => handleFormTypeChange(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-black"
                aria-label="בחר סוג טופס"
              >
                {formTypes.map((type, index) => (
                  <option key={index} value={type.slug}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* File Upload Fields */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">העלאת מסמכים</h2>
          <p className="text-gray-600 mb-6">קבצים מותרים: PDF, תמונות, או מסמכי Word</p>
          
          <div className="space-y-6">
            {currentFormFields.map((field, index) => {
              // Render mail documents section
              if (field.isSection && field.sectionType === 'mail-documents') {
                return (
                  <div key={index} className="my-6">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                      <h3 className="text-lg font-semibold text-blue-800 mb-3">
                        {field.sectionTitle}
                      </h3>
                      <p className="text-sm text-blue-800 mb-4">
                        יש לבחור את סוג המכתבים אותם תרצה לצרף - שים לב לכך שהמכתבים כוללים כתובת ותאריך ברורים
                      </p>
                      
                      {/* Document Selection */}
                      <div className="space-y-3">
                        {Array.from({ length: field.requiredCount || 0 }, (_, docIndex) => {
                          const selectedDoc = selectedMailDocuments[docIndex];
                          const availableOptions = field.options?.filter((opt) => 
                            !selectedMailDocuments.includes(opt.slug) || opt.slug === selectedDoc
                          ) || [];
                          
                          return (
                            <div key={docIndex} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-blue-900 min-w-[80px]">
                                מכתב {docIndex + 1}:
                              </span>
                              <select
                                value={selectedDoc || ''}
                                onChange={(e) => {
                                  const newSelected = [...selectedMailDocuments];
                                  newSelected[docIndex] = e.target.value;
                                  setSelectedMailDocuments(newSelected.filter(Boolean));
                                }}
                                className="flex-1 p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                aria-label={`בחר סוג מכתב ${docIndex + 1}`}
                              >
                                <option value="">בחר סוג מכתב...</option>
                                {availableOptions.map((option) => (
                                  <option key={option.slug} value={option.slug}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                      
                      {selectedMailDocuments.length > 0 && (
                        <p className="text-xs text-blue-800 mt-3">
                          נבחרו {selectedMailDocuments.length} מתוך {field.requiredCount} מכתבים
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              
              // Render other section headers
              if (field.isSection) {
                return (
                  <div key={index} className="my-6">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                      <h3 className="text-lg font-semibold text-blue-800 mb-1">
                        {field.sectionTitle}
                      </h3>
                    </div>
                  </div>
                );
              }

              const fieldKey = field.slug;
              const isUploaded = uploadedFiles[fieldKey];
              const isDragging = dragOver === fieldKey;
              const isFieldLoading = fieldLoading[fieldKey] || false;
              
              return (
                <div key={index} className={`border border-gray-200 rounded-lg p-4 ${
                  field.optional ? 'border-dashed border-orange-200' : ''
                } ${field.isMailDocument ? 'border-blue-200 bg-blue-25' : ''}`}>
                  <div className="mb-3">
                    {/* First Row: Field Info and Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-bold ${
                          field.optional ? 'bg-orange-500' : 
                          field.isMailDocument ? 'bg-blue-600' : 'bg-blue-500'
                        }`}>
                          {field.optional ? '?' : 
                           field.isMailDocument ? `6.${selectedMailDocuments.indexOf(field.slug) + 1}` : 
                           field.number}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {field.name}
                          {field.optional && <span className="text-orange-600 text-sm mr-2">(בחירה)</span>}
                        </h3>
                        {isUploaded && (
                          <span className="text-green-500 text-xl">✓</span>
                        )}
                      </div>
                      {isUploaded && (
                        <button
                          onClick={() => removeFile(fieldKey)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          הסר קובץ
                        </button>
                      )}
                    </div>
                    
                    {/* Second Row: Description */}
                    {field.description && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          {field.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Third Row: Templates */}
                    {(field.template || field.templates) && (
                      <div className="flex flex-wrap gap-2">
                        {field.template && (
                          <a
                            href={field.template}
                            download
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                            title="הורד טופס להדפסה ומילוי"
                          >
                            📄 הורד טופס
                          </a>
                        )}
                        {field.templates && field.templates.map((template, templateIndex) => (
                          <a
                            key={templateIndex}
                            href={template.path}
                            download
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                            title={`הורד ${template.label}`}
                          >
                            📄 {template.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {isFieldLoading ? (
                    <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-6 text-center">
                      <div className="text-blue-600">
                        <div className="text-lg font-semibold mb-1">⏳ מעלה קובץ...</div>
                        <div className="text-sm">אנא המתן</div>
                      </div>
                    </div>
                  ) : isUploaded ? (
                    <div className="border-2 border-dashed border-green-400 bg-green-50 rounded-lg p-6 text-center">
                      <div className="text-green-600">
                        <div className="text-lg font-semibold mb-1">✓ קובץ הועלה</div>
                        <div className="text-sm">{isUploaded.name}</div>
                        <div className="text-xs text-gray-700 mt-1">
                          לחץ או גרור קובץ חדש להחלפה
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 md:p-6 text-center transition-colors ${
                        isDragging
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onDragOver={(e) => {
                        // Only enable drag on desktop
                        if (window.innerWidth >= 768) {
                          handleDragOver(e, fieldKey)
                        }
                      }}
                      onDragLeave={(e) => {
                        // Only enable drag on desktop  
                        if (window.innerWidth >= 768) {
                          handleDragLeave(e)
                        }
                      }}
                      onDrop={(e) => {
                        // Only enable drag on desktop
                        if (window.innerWidth >= 768) {
                          handleDrop(e, fieldKey)
                        }
                      }}
                    >
                      <div className="text-gray-700 mb-4">
                        <div className="text-lg mb-2">📁</div>
                        <div className="text-lg font-semibold mb-1 hidden md:block">
                          גרור קובץ לכאן או לחץ לבחירה
                        </div>
                        <div className="text-lg font-semibold mb-1 md:hidden">
                          לחץ לבחירת קובץ
                        </div>
                      </div>
                      <CustomFileInput
                        onChange={(e) => handleInputChange(e, fieldKey)}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        ariaLabel={`העלה קובץ עבור ${field.name}`}
                        disabled={isFieldLoading}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submission Status */}
          <div className="mt-8 text-center">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-lg font-semibold text-gray-900 mb-2">
                סטטוס הגשה
              </div>
              <div className="text-sm text-gray-800">
                הועלו {uploadedFilesList.length} מתוך {currentFormFields.length} קבצים
              </div>
              {uploadedFilesList.length > 0 && (
                <div className="text-xs text-green-600 mt-1">
                  ✓ קבצים נשמרו אוטומטית
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
