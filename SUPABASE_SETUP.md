# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be initialized
3. Get your project URL and anon key from the project settings

## 2. Configure Environment Variables

Update your `.env.local` file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Run Database Schema

Execute the SQL commands in `supabase-schema.sql` in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the query

This will create:
- `customer_submissions` table for tracking form submissions
- `uploaded_files` table for file metadata
- `customer-files` storage bucket for file uploads
- Necessary indexes and RLS policies

## 4. Verify Setup

After running the schema, verify:

1. **Tables Created**: Check that both tables exist in the Table Editor
2. **Storage Bucket**: Confirm `customer-files` bucket exists in Storage
3. **Policies**: Ensure RLS policies are active

## 5. Features Implemented

### Customer Submission Management
- Tracks customer phone number and selected form type
- Maintains list of submitted fields
- Automatic timestamps for created/updated records

### File Storage
- Files are stored under `customer-files` bucket
- Organized by phone number: `{phoneNumber}/{fieldSlug}-{timestamp}.{ext}`
- Supports PDF, JPG, PNG, DOC, DOCX formats
- 50MB file size limit

### Field Tracking
- Each uploaded file is tracked with metadata
- Field slugs allow for consistent field identification
- File replacement automatically deletes old files

### Data Structure

**customer_submissions table:**
```sql
id (UUID, Primary Key)
phone_number (Text)
form_type (Text) -- slug like 'צבא-דרגה'
form_type_label (Text) -- display name like 'צבא- דרגה'  
submitted_fields (JSONB) -- array of field slugs
created_at (Timestamp)
updated_at (Timestamp)
```

**uploaded_files table:**
```sql
id (UUID, Primary Key)
submission_id (UUID, Foreign Key)
field_slug (Text) -- like 'health-declaration'
field_name (Text) -- Hebrew field name
file_name (Text) -- original filename
file_path (Text) -- storage path
file_size (Integer)
mime_type (Text)
created_at (Timestamp)
```

## 6. Usage

The application now:
- Automatically creates customer submissions when files are uploaded
- Stores files in organized folder structure by phone number
- Tracks which fields have been submitted
- Handles file replacement and deletion
- Maintains data persistence across sessions
- Shows loading states during file operations

## 7. Security Notes

- Row Level Security (RLS) is enabled on all tables
- Storage bucket has appropriate access policies
- File access is controlled through Supabase policies
- Consider adding authentication for production use