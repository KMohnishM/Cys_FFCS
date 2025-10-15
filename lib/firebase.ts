import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import type { FirebaseApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let cachedApp: FirebaseApp | null = null

function getAppClient(): FirebaseApp {
  if (cachedApp) return cachedApp
  if (typeof window === 'undefined') {
    throw new Error('Firebase client can only be used in the browser')
  }
  if (!getApps().length) {
    cachedApp = initializeApp(firebaseConfig)
  } else {
    cachedApp = getApp()
  }
  return cachedApp
}

export function getAuthClient() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth can only be used in the browser')
  }
  try {
    return getAuth(getAppClient())
  } catch (e) {
    // rethrow with clearer context
    throw new Error('Failed to get Firebase Auth client: ' + (e instanceof Error ? e.message : String(e)))
  }
}

export function getDbClient() {
  if (typeof window === 'undefined') {
    throw new Error('Firestore can only be used in the browser')
  }
  try {
    return getFirestore(getAppClient())
  } catch (e) {
    throw new Error('Failed to get Firestore client: ' + (e instanceof Error ? e.message : String(e)))
  }
}

export function getStorageClient() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Storage can only be used in the browser')
  }
  try {
    return getStorage(getAppClient())
  } catch (e) {
    throw new Error('Failed to get Firebase Storage client: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// Auth helpers
import type { User } from 'firebase/auth'
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  signInWithEmailAndPassword
} from 'firebase/auth'

export async function signInWithGoogle() : Promise<User|null> {
  if (typeof window === 'undefined') return null
  const auth = getAuth(getAppClient())
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const res = await signInWithPopup(auth, provider)
  return res.user ?? null
}

export async function signInWithEmail(email: string, password: string) : Promise<User|null> {
  if (typeof window === 'undefined') return null
  const auth = getAuth(getAppClient())
  const res = await signInWithEmailAndPassword(auth, email, password)
  return res.user ?? null
}

export async function signOut() {
  const auth = getAuth(getAppClient())
  await firebaseSignOut(auth)
}

// Quick browser-only mock seed (idempotent-ish) to populate basic departments/projects if none exist.
export async function ensureMockData() {
  if (typeof window === 'undefined') return
  const db = getDbClient()
  const { collection, getDocs, addDoc, query, limit } = await import('firebase/firestore')
  const dcol = collection(db, 'departments')
  const snapshot = await getDocs(query(dcol, limit(1)))
  if (!snapshot.empty) return

  const departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'CHEM']
  for (const name of departments) {
    await addDoc(dcol, { name, seatLimit: 50, filledCount: 0 })
  }

  const pcol = collection(db, 'projects')
  for (let i = 1; i <= 15; i++) {
    await addDoc(pcol, { name: `Project ${i}`, description: `Project ${i} description`, members: [] })
  }
}
