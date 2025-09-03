'use client';

import { useRef } from 'react';

interface CustomFileInputProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export default function CustomFileInput({ 
  onChange, 
  accept, 
  disabled, 
  ariaLabel,
  className = ""
}: CustomFileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={onChange}
        accept={accept}
        disabled={disabled}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        className={`w-full p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-medium">
            בחר קובץ...
          </span>
          <span className="text-gray-500 text-sm">
            📁
          </span>
        </div>
      </button>
    </div>
  );
}
