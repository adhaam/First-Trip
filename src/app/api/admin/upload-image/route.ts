import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const ok = await requireAdmin(req as Parameters<typeof requireAdmin>[0])
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
    }
    const ext = extensions[file.type]
    if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG, WebP, or AVIF image' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 })
    }

    const requestedFolder = String(formData.get('folder') || 'accommodations')
    const folder = ['accommodations', 'community', 'trips'].includes(requestedFolder)
      ? requestedFolder
      : 'accommodations'
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.storage
      .from('property-images')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Supabase storage upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('property-images')
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl }, { status: 201 })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
