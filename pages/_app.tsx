import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import { getAuthClient, getDbClient, ensureMockData } from '../lib/firebase'
import AuthGuard from '../lib/AuthGuard'
import { useRouter } from 'next/router'
import PresenceTracker from '../components/PresenceTracker'
import { trackPageView } from '../lib/analytics'
import Head from 'next/head'

// Page Transition Component
function PageTransition({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleStart = () => setIsLoading(true)
    const handleComplete = () => setIsLoading(false)

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  }, [router])

  return (
    <div className="relative">
      {/* Smooth transition overlay */}
      <div 
        className={`fixed inset-0 bg-black z-50 transition-opacity duration-300 ${
          isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-4 border-white/20 border-t-white rounded-full"></div>
        </div>
      </div>
      
      {/* Page content with fade transition */}
      <div className={`transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
        {children}
      </div>
    </div>
  )
}

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
        <PageTransition>
          <Component {...pageProps} />
        </PageTransition>
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
        <PageTransition>
          <Component {...pageProps} />
        </PageTransition>
      </AuthGuard>
    </>
  )
}
