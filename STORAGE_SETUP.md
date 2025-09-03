# Supabase Storage Setup Instructions

## Problem
The application is showing error: `customer-files bucket not found` because the Supabase storage bucket hasn't been created yet.

## Solution

### Step 1: Create the Storage Bucket

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Set bucket name: `customer-files`
5. Set bucket to **Public** (checked)
6. Click **"Create bucket"**

**Option B: Using SQL**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Copy and paste the contents of `setup-storage-bucket.sql`
4. Click **"Run"**

### Step 2: Configure Bucket Policies (if using Option A)

If you created the bucket via dashboard, add these policies in SQL Editor:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-files');

-- Allow authenticated users to view files
CREATE POLICY "Allow authenticated users to view files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'customer-files');

-- Allow public access to files
CREATE POLICY "Allow public access to files" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'customer-files');
```

### Step 3: Test the Setup

1. Restart your Next.js development server
2. Try uploading a file in the customer form
3. Try opening a file in the admin panel

### Expected File Structure

Files will be stored as:
```
customer-files/
├── 050-123-4567/
│   ├── health-declaration-20241201-143022.pdf
│   ├── residence-approval-20241201-143105.pdf
│   └── ...
└── 050-987-6543/
    ├── health-declaration-20241201-144001.pdf
    └── ...
```

### Troubleshooting

**Error: "Bucket not found"**
- Make sure the bucket name is exactly `customer-files` (case-sensitive)
- Verify the bucket exists in Supabase Storage dashboard

**Error: "Access denied"**
- Check that RLS policies are properly set up
- Ensure your Supabase environment variables are correct

**Error: "File upload failed"**
- Check file size (max 50MB)
- Verify file type is allowed (PDF, JPG, PNG, DOC, DOCX)
- Check browser console for detailed error messages

### Environment Variables

Make sure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### After Setup

Once the storage bucket is created:
- ✅ File uploads will work in customer forms
- ✅ "פתח קובץ" (Open File) buttons will work in admin panel
- ✅ Files will be properly stored and retrievable
- ✅ No more "bucket not found" errors
