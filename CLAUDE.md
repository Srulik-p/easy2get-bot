# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hebrew customer document upload form application built with Next.js 15. The application collects customer information and documents based on different form types (military, residential, employment, etc.) with full RTL Hebrew support.

## Development Commands

```bash
# Development server with Turbopack
npm run dev

# Production build with Turbopack  
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Architecture

### Key Technologies
- **Next.js 15.5.2** with App Router
- **React 19.1.0** 
- **TypeScript 5** with strict mode
- **Tailwind CSS 4** for styling
- **ESLint 9** for linting

### Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with Hebrew RTL support
│   ├── page.tsx            # Home page (renders CustomerFormWrapper)
│   └── globals.css         # Global Tailwind styles
└── components/
    ├── CustomerForm.tsx    # Main form component with file uploads
    └── CustomerFormWrapper.tsx # Client-side wrapper component
```

### Core Application Logic

**CustomerForm Component** (`src/components/CustomerForm.tsx`):
- Uses phone number from URL params as unique customer identifier
- Supports 8+ form types with different document requirements
- Implements file upload with drag-and-drop functionality
- Persists data to localStorage using phone number as key
- Hebrew-first interface with RTL layout

**Form Types and Fields**: Each form type has specific document requirements defined in `formFieldsByType` object:
- מגורים באיזור זכאי (5 documents)
- צבא- דרגה/לוחם (4 documents each) 
- עבודה באיזור זכאי שכיר/עצמאי (8 documents each)
- תלמיד/סטודנט, מתנדב, חקלאי variants

**File Upload System**:
- Supports PDF, JPG, PNG, DOC, DOCX formats
- Visual upload indicators (✓ for uploaded files)
- File replacement capability
- Drag-and-drop interface

### Configuration Notes

- **TypeScript**: Uses `@/*` path mapping for imports
- **Next.js**: Minimal configuration, relies on defaults
- **HTML Lang**: Set to Hebrew (`he`) with RTL direction
- **Turbopack**: Enabled for faster development builds
- **ESLint**: Next.js config with modern ESLint 9 setup

### Key URLs

Access customer forms using phone number parameter:
```
http://localhost:3000?phone=050-1234567
```

### Data Persistence

Customer data is stored in browser localStorage with phone number as the unique key. Each customer's form selection and uploaded files are persisted locally.