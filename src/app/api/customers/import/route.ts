import { NextRequest, NextResponse } from 'next/server'
import { SupabaseService } from '@/lib/supabase-service'

interface CsvRow {
  ['שם עסק']?: string
  ['נייד']?: string
  ['טלפון']?: string
  ['ח.פ.']?: string
  [key: string]: string | undefined
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []

  const header = lines[0].split(',').map(h => h.trim())
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const row: CsvRow = {}
    header.forEach((key, idx) => {
      row[key] = (cols[idx] || '').trim()
    })
    rows.push(row)
  }
  return rows
}

function formatToInternational(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  // If already starts with 972 or +972
  if (digits.startsWith('972')) return `+${digits}`
  // Assume Israeli local starting with 0
  if (digits.startsWith('0')) return `+972${digits.substring(1)}`
  return `+972${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const criterion = formData.get('criterion') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'CSV file is required (field name: file)' }, { status: 400 })
    }
    if (!criterion) {
      return NextResponse.json({ success: false, error: 'criterion is required' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCsv(text)

    const results: Array<{ index: number; phone: string | null; created: boolean; error?: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        // Full name
        const fullName = (row['שם עסק'] || '').trim()
        const parts = fullName.split(' ').filter(Boolean)
        const firstName = parts[0] || ''
        const lastName = parts.slice(1).join(' ') || ''

        // Phone: נייד preferred, fallback to טלפון
        const phoneCandidate = (row['נייד'] || row['טלפון'] || '').trim()
        const phoneIntl = formatToInternational(phoneCandidate)
        if (!phoneIntl) {
          results.push({ index: i + 1, phone: null, created: false, error: 'Missing phone number' })
          continue
        }

        const idNumberRaw = (row['ח.פ.'] || '').trim()
        const idNumber = idNumberRaw ? Number(idNumberRaw.replace(/\D/g, '')) : null

        // Create only as agreement_signed
        const created = await SupabaseService.createCustomer({
          phone_number: phoneIntl,
          name: firstName || undefined,
          family_name: lastName || undefined,
          criterion: criterion,
          id_number: idNumber,
          status: 'agreement_signed'
        })

        results.push({ index: i + 1, phone: phoneIntl, created: !!created })
      } catch (err) {
        results.push({ index: i + 1, phone: null, created: false, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return NextResponse.json({ success: true, count: results.length, results })
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


