import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

type Data = {
  urls?: string[]
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { projectId, files } = req.body as { 
      projectId?: string
      files?: Array<{ filename: string; dataUrl: string }> 
    }

    if (!projectId || !files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Missing projectId or files' })
    }

    // Create uploads directory structure
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const uploadedUrls: string[] = []

    for (const fileData of files) {
      const { filename, dataUrl } = fileData

      // Parse data URL
      const matches = /^data:(.+);base64,(.+)$/.exec(dataUrl)
      if (!matches) {
        console.error('Invalid data URL for file:', filename)
        continue
      }

      const buffer = Buffer.from(matches[2], 'base64')

      // Check file size (10MB max)
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(413).json({ error: `File ${filename} is too large` })
      }

      // Create safe filename with timestamp
      const timestamp = Date.now()
      const ext = path.extname(filename)
      const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_')
      const safeFilename = `${timestamp}_${baseName}${ext}`
      const destPath = path.join(uploadsDir, safeFilename)

      // Write file
      await fs.promises.writeFile(destPath, buffer)

      // Return public URL
      const publicUrl = `/uploads/projects/${projectId}/${safeFilename}`
      uploadedUrls.push(publicUrl)
    }

    return res.status(200).json({ urls: uploadedUrls })
  } catch (err: any) {
    console.error('Upload error', err)
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}

