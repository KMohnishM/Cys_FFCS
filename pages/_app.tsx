import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { getAuthClient, getDbClient, ensureMockData } from '../lib/firebase'
import AuthGuard from '../lib/AuthGuard'
import { useRouter } from 'next/router'
import PresenceTracker from '../components/PresenceTracker'
import { trackPageView } from '../lib/analytics'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    // ensure local mock data for development
    ensureMockData().catch((e)=>console.error('Mock seed failed',e))
    const auth = getAuthClient()
    const db = getDbClient()

    const unsub = auth.onAuthStateChanged(async (u: any) => {
      if (!u) return
      try {
        // Verify VIT student email
        if (u.email && !u.email.endsWith('@vitstudent.ac.in')) {
          console.warn('Non-VIT email detected')
          // In production, we would sign out non-VIT users
          // await signOut(auth)
          // return
        }
        
        const { doc, getDoc, setDoc } = await import('firebase/firestore')
        const userRef = doc(db, 'users', u.uid)
        const snap = await getDoc(userRef)
        if (!snap.exists()) {
          await setDoc(userRef, {
            userId: u.uid,
            name: u.displayName ?? '',
            email: u.email ?? '',
            role: 'member',
            departments: [],
            totalPoints: 0,
            projectId: null,
          })
        }
      } catch (e) {
        console.error('Failed to ensure user doc', e)
      }
    })

    return () => unsub()
  }, [])

  // These paths should not require authentication
  const publicPaths = ['/', '/login', '/_error', '/_document', '/_app']
  
  // Check if current path is public
  const isPublicPath = publicPaths.includes(router.pathname)
  
  // Track page view when route changes - this hook must be called unconditionally
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      trackPageView(url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    
    // Track initial page load
    trackPageView();
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Only apply AuthGuard if not a public path
  if (isPublicPath) {
    return (
      <>
        <Head>
          <title>Cyscom FFCS Portal</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="description" content="Cyscom Flexible Faculty Contribution System Portal" />
        </Head>
        <Component {...pageProps} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Cyscom FFCS Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Cyscom Flexible Faculty Contribution System Portal" />
      </Head>
      
      {/* Presence tracker component (invisible) */}
      <PresenceTracker />
      
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </>
  )
}
