import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import fs from 'fs'
import path from 'path'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const modelsDir = path.join(process.cwd(), 'public', 'models')
  const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.glb')).sort()
  return NextResponse.json(files)
}
