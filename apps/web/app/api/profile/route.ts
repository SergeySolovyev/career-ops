import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'data', 'profile.json')
    const profile = JSON.parse(readFileSync(filePath, 'utf-8'))
    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
}
