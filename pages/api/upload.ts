import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

// Increase body size limit for uploads (adjust as needed)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

type Data = {
  url?: string
  path?: string
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // WARNING: Writing to disk is fine for local development, but many serverless
  // hosts (Vercel, Netlify) do not persist filesystem changes across deployments
  // or may have read-only filesystems. Use a proper object store for production.

  try {
    const { filename, dataUrl } = req.body as { filename?: string; dataUrl?: string }
    if (!filename || !dataUrl) return res.status(400).json({ error: 'Missing filename or dataUrl' })

    const m = /^data:(.+);base64,(.+)$/.exec(dataUrl)
    if (!m) return res.status(400).json({ error: 'Invalid data URL' })

    const mime = m[1]
    const b64 = m[2]
    const buffer = Buffer.from(b64, 'base64')

    const MAX_BYTES = 5 * 1024 * 1024
    if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'File too large' })

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    // sanitize filename
    const safe = filename.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const dest = path.join(uploadsDir, safe)
    await fs.promises.writeFile(dest, buffer)

    const url = `/uploads/${safe}`
    return res.status(200).json({ url, path: `uploads/${safe}` })
  } catch (err: any) {
    console.error('Upload error', err)
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
