#!/usr/bin/env ts-node
/**
 * scripts/fix-cors.ts
 *
 * Usage (from repo root):
 * 1. npm install @google-cloud/storage
 * 2. npx ts-node --project tsconfig.scripts.json ./scripts/fix-cors.ts
 *
 * This script reads `service-account.json` in the project root and sets a
 * CORS policy on the configured storage bucket from env or firebase config.
 */

import { Storage } from '@google-cloud/storage'
import fs from 'fs'
import path from 'path'

async function main() {
  const svcPath = path.resolve(process.cwd(), 'service-account.json')
  if (!fs.existsSync(svcPath)) {
    console.error('service-account.json not found in project root. Please provide a service account JSON with Storage permissions.')
    process.exit(1)
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET
  if (!bucketName) {
    console.error('Storage bucket not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment or provide FIREBASE_STORAGE_BUCKET.')
    process.exit(1)
  }

  const storage = new Storage({ keyFilename: svcPath })
  const bucket = storage.bucket(bucketName)

  const cors = [
    {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
      responseHeader: ['Content-Type', 'Authorization'],
      maxAgeSeconds: 3600,
    },
  ]

  try {
    console.log(`Setting CORS for bucket: ${bucketName}`)
    await bucket.setMetadata({ cors })
    console.log('CORS updated successfully. New CORS policy:')
    console.log(JSON.stringify(cors, null, 2))
  } catch (err) {
    console.error('Failed to update CORS:', err)
    process.exitCode = 2
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
