import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const TEMPLATES_FILE = path.join(process.cwd(), 'data/reminder-templates.json')

interface MessageTemplates {
  first: string
  second: string
  first_week: string
  second_week: string
  third_week: string
  fourth_week: string
}

// Default templates (fallback)
const DEFAULT_TEMPLATES: MessageTemplates = {
  first: 'שלום {customerName}! 👋\n\nשלחנו לך טופס "{formLabel}" לפני יומיים.\n\n📋 זה לוקח רק כמה דקות למלא\n\nצריך עזרה? פשוט תשלח הודעה!',
  second: 'היי {customerName}! 😊\n\nעדיין לא מילאת את טופס "{formLabel}"?\n\n⏰ אנחנו כאן לעזור אם יש שאלות\n📞 צור קשר ונסביר איך למלא',
  first_week: 'תזכורת שבועית ראשונה {customerName} 📅\n\nטופס "{formLabel}" שלך עדיין מחכה!\n\n💬 יש בעיה טכנית? שאלות?\nאנחנו כאן לעזור',
  second_week: 'תזכורת שבועית שנייה {customerName} 🔔\n\nטופס "{formLabel}" - זה הזמן להשלים!\n\n📞 צריך עזרה? צור קשר ונסביר',
  third_week: 'תזכורת שבועית שלישית {customerName} ⏰\n\nעדיין לא השלמת את טופס "{formLabel}"?\n\n🤝 אנחנו כאן לסייע בכל שאלה',
  fourth_week: 'תזכורת אחרונה {customerName} 🚨\n\nטופס "{formLabel}" מחכה כבר חודש!\n\n📋 בוא נסיים את זה יחד - צור קשר'
}

function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function loadTemplates(): MessageTemplates {
  try {
    ensureDataDirectory()
    if (fs.existsSync(TEMPLATES_FILE)) {
      const data = fs.readFileSync(TEMPLATES_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading templates:', error)
  }
  return DEFAULT_TEMPLATES
}

function saveTemplates(templates: MessageTemplates): boolean {
  try {
    ensureDataDirectory()
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2))
    return true
  } catch (error) {
    console.error('Error saving templates:', error)
    return false
  }
}

// GET - Load current templates
export async function GET() {
  try {
    const templates = loadTemplates()
    return NextResponse.json({
      success: true,
      templates
    })
  } catch (error) {
    console.error('Error in GET templates:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load templates'
    }, { status: 500 })
  }
}

// POST - Save new templates
export async function POST(request: NextRequest) {
  try {
    const { templates } = await request.json()

    if (!templates || typeof templates !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'Invalid templates format'
      }, { status: 400 })
    }

    // Validate required fields
    if (!templates.first || !templates.second || !templates.first_week || !templates.second_week || !templates.third_week || !templates.fourth_week) {
      return NextResponse.json({
        success: false,
        error: 'All template fields are required (first, second, first_week, second_week, third_week, fourth_week)'
      }, { status: 400 })
    }

    const success = saveTemplates(templates)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Templates saved successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to save templates'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in POST templates:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}