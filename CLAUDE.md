# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive Hebrew customer document management system built with Next.js 15. The application handles customer form submissions, file uploads, WhatsApp integration, reminder management, and admin panels for Israeli government benefit applications.

**⚠️ SECURITY WARNING**: This project contains sensitive production credentials in `.env.local` that are checked into the repository. These should be rotated immediately and moved to proper environment configuration.

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
- **React 19.1.0** with strict TypeScript
- **Supabase** for database and file storage
- **TypeScript 5** with strict mode
- **Tailwind CSS 4** for styling
- **ESLint 9** for linting

### Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with Hebrew RTL support
│   ├── page.tsx            # Home page (renders CustomerFormWrapper)
│   ├── globals.css         # Global Tailwind styles
│   ├── admin/              # Admin panel routes
│   │   ├── page.tsx        # Main admin dashboard
│   │   ├── customers/      # Customer management
│   │   └── reminders/      # Reminder management
│   └── api/                # API routes
│       ├── auth/           # Authentication endpoints
│       ├── customers/      # Customer management APIs
│       ├── reminders/      # Reminder system APIs
│       ├── urls/           # URL shortening service
│       └── whatsapp/       # WhatsApp integration
├── components/
│   ├── CustomerForm.tsx    # Main form component with file uploads
│   ├── CustomerFormWrapper.tsx # Client wrapper with phone verification
│   ├── PhoneVerification.tsx    # Phone number verification system
│   ├── AdminPanel.tsx      # Admin dashboard interface
│   ├── WhatsAppModal.tsx   # WhatsApp message interface
│   └── CustomFileInput.tsx # File upload component
├── lib/
│   ├── supabase.ts         # Supabase client and type definitions
│   ├── supabase-service.ts # Database service layer (1300+ lines)
│   ├── auth-service.ts     # Phone authentication service
│   ├── green-api.ts        # WhatsApp API integration
│   ├── reminder-service.ts # Automated reminder system
│   ├── url-service.ts      # URL shortening service
│   └── verification-service.ts # Phone verification logic
└── data/
    └── form-fields.json    # Form configuration and field definitions
```

### Core Application Logic

**Phone-Based Authentication Flow**:
1. User accesses form via URL with phone parameter (e.g., `?phone=050-1234567`)
2. PhoneVerification component sends SMS verification code
3. Upon verification, user gains access to forms and file uploads
4. All data is linked to verified phone number

**Form System** (`src/components/CustomerForm.tsx`):
- Supports 10+ Hebrew form types with specific document requirements
- Real-time file upload with Supabase storage integration
- Visual upload indicators and progress tracking
- Form field definitions loaded from `src/data/form-fields.json`
- Hebrew-first interface with full RTL support

**Database Layer** (`src/lib/supabase-service.ts`):
- Comprehensive service layer with 1300+ lines of code
- Handles customers, submissions, file uploads, message logs, and auth tokens
- Graceful error handling for missing database columns
- Built-in fallback mechanisms for schema evolution

**WhatsApp Integration**:
- Green-API based messaging system
- Automated reminder system with multiple reminder types
- Form link distribution and customer communication
- Message logging and delivery tracking

**Admin Panel Features**:
- Customer management and data overview
- File upload management for customers
- Reminder system configuration and monitoring
- Message history and communication logs

### Critical Dependencies

**External Services**:
- **Supabase**: Primary database and file storage
- **Green-API**: WhatsApp messaging service  
- **TinyURL**: URL shortening for form links
- **Vercel**: Deployment platform

**Service Configuration**:
- All services require API keys stored in environment variables
- Graceful degradation when services are unavailable
- Fallback mechanisms for URL shortening and messaging

## ⚠️ POTENTIAL ISSUES DURING DEVELOPMENT

### Security Issues
1. **Exposed Credentials**: Production API keys and secrets are committed to `.env.local`
   - **Risk**: Database access, WhatsApp API abuse, URL service misuse
   - **Action**: Rotate all keys immediately and use proper environment configuration

2. **Phone Number Handling**: Phone verification system uses SMS codes
   - **Risk**: SMS bombing if rate limiting fails
   - **Monitor**: Authentication attempts and verification code requests

### Database Schema Dependencies
3. **Dynamic Schema Handling**: SupabaseService has extensive error handling for missing columns
   - **Issue**: Code expects certain database columns that may not exist
   - **Check Before Changes**: Verify database schema matches service expectations
   - **Key Tables**: `customers`, `customer_submissions`, `uploaded_files`, `message_logs`, `auth_tokens`

4. **File Storage Dependencies**: Heavy reliance on Supabase storage
   - **Risk**: File uploads will fail if storage bucket isn't configured
   - **Verify**: `customer-files` bucket exists and has proper policies

### External Service Dependencies
5. **WhatsApp API (Green-API)**: Core functionality depends on external service
   - **Risk**: Messaging failures can break reminder system
   - **Fallback**: System logs failures but may not handle extended outages

6. **URL Shortening**: TinyURL integration for form links
   - **Risk**: Link generation failures affect customer communication
   - **Check**: URL shortening service availability before deployments

### TypeScript Configuration
7. **Strict Mode**: Project uses TypeScript strict mode with complex type definitions
   - **Requirements**: All types must be properly defined (no `any`)
   - **null vs undefined**: Database types use `undefined`, convert `null` appropriately
   - **Import Types**: Always import required types (`CustomerSubmission`, `MessageLog`, etc.)

### Data Flow Complexity
8. **Phone Number Normalization**: Multiple phone formats across codebase
   - **Risk**: Inconsistent formatting can break customer lookups
   - **Formats**: `+972xxxxxxxxx`, `050-xxx-xxxx`, internal normalization required

9. **Form Field Configuration**: Dynamic form generation from JSON
   - **Risk**: Changes to `form-fields.json` can break existing forms
   - **Validation**: Test form rendering after any field configuration changes

### Performance Considerations
10. **Large Service File**: `supabase-service.ts` is 1300+ lines
    - **Maintenance**: Complex file with many interdependent methods
    - **Testing**: Changes require thorough testing of related functionality

## Development Guidelines

### Required Environment Variables
```bash
# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# WhatsApp Integration
GREEN_API_ID_INSTANCE=
GREEN_API_TOKEN_INSTANCE=

# Additional Services
REMINDER_JOB_AUTH_TOKEN=
NEXT_PUBLIC_BASE_URL=
TINYURL_API_TOKEN=
ADMIN_API_TOKEN=
```

### TypeScript Requirements
- **Never use `any` type** - Always specify proper types
- **Handle null vs undefined**: Database types use `undefined` for optional fields
- **Import required types**: Always import `CustomerSubmission`, `MessageLog`, etc.
- **Unused parameters**: Prefix with `_` if required but unused

### Testing Checklist Before Changes
1. ✅ Verify Supabase database schema matches service expectations
2. ✅ Test phone verification flow end-to-end  
3. ✅ Validate file upload and storage functionality
4. ✅ Check WhatsApp messaging integration
5. ✅ Test form field rendering with current JSON configuration
6. ✅ Verify admin panel functionality
7. ✅ Test reminder system triggers

### Key URLs
- Customer forms: `http://localhost:3000?phone=050-1234567`
- Admin panel: `http://localhost:3000/admin`
- Customer management: `http://localhost:3000/admin/customers/[phone]`
- Reminder management: `http://localhost:3000/admin/reminders`