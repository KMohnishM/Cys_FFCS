import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { signInWithGoogle, signInWithEmail, ensureMockData, getAuthClient, getDbClient } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function Home(){
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)

  useEffect(() => {
    // populate mock data in browser if empty
    ensureMockData().catch(console.error)
    
    // Check if user is already authenticated
    const auth = getAuthClient()
    const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setIsAuthenticated(true)
        
        try {
          // Check user progress to redirect appropriately
          const db = getDbClient()
          const userRef = doc(db, 'users', currentUser.uid)
          const userSnap = await getDoc(userRef)
          
          if (!userSnap.exists()) {
            // No user document yet, should be created soon
            router.push('/dashboard')
            return
          }
          
          const userData = userSnap.data()
          
          // Determine where to redirect based on user progress
          if (!userData.departments || userData.departments.length < 2) {
            router.push('/departments')
          } else if (!userData.projectId) {
            router.push('/projects')
          } else {
            router.push('/dashboard')
          }
        } catch (error) {
          console.error('Error checking user progress:', error)
          router.push('/dashboard')
        }
      } else {
        setIsAuthenticated(false)
      }
    })
    
    return () => unsubAuth()
  }, [router])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const user = await signInWithGoogle()
      if (user) {
        // After signing in, let the above useEffect handle the redirection
        // based on user progress
        setIsAuthenticated(true)
      }
    } catch (e) {
      console.error('Sign in failed', e)
      alert('Sign in failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }
  
  const handleAdminLogin = async () => {
    if (!email || !password) {
      alert('Please enter both email and password')
      return
    }
    
    setAdminLoginLoading(true)
    try {
      const user = await signInWithEmail(email, password)
      if (user) {
        setIsAuthenticated(true)
        // Admin users should be redirected to admin page directly
        router.push('/admin')
      }
    } catch (e) {
      console.error('Admin login failed', e)
      // Check if it's a specific authentication error
      if (e instanceof Error && e.message.includes('auth/invalid-credential')) {
        if (confirm('Admin login failed. This may happen if admin users have not been created yet. Would you like to go to the setup page to create admin users?')) {
          router.push('/setup')
          return
        }
      }
      alert('Admin login failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAdminLoginLoading(false)
    }
  }
  
  const toggleAdminLogin = () => {
    setShowAdminLogin(!showAdminLogin)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-black to-slate-900 p-4">
      <div className="p-8 bg-pagebg/60 backdrop-blur-md rounded-xl shadow-lg text-center max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyscom">Cyscom FFCS Portal</h1>
          <p className="mt-4 text-slate-300">Select departments and projects for the upcoming club activities</p>
        </div>
        
        <div className="mt-8">
          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-slate-300">
                <span className="w-4 h-4 border-2 border-cyscom border-t-transparent rounded-full animate-spin"></span>
                You're signed in! Redirecting...
              </div>
              <Link href="/dashboard" className="block px-4 py-2 bg-cyscom rounded text-black font-medium hover:bg-cyscom/90 transition-colors">
                Go to Dashboard
              </Link>
            </div>
          ) : showAdminLogin ? (
            <div className="space-y-4">
              <div className="text-left">
                <h3 className="text-white font-medium mb-4">Admin Login</h3>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyscom text-white"
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyscom text-white"
                    placeholder="•••••••••"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleAdminLogin} 
                  disabled={adminLoginLoading} 
                  className="w-full px-4 py-3 bg-cyscom rounded-lg text-black font-medium hover:bg-cyscom/90 transition-all"
                >
                  {adminLoginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      Logging in...
                    </span>
                  ) : (
                    'Login as Admin'
                  )}
                </button>
                <button 
                  onClick={toggleAdminLogin} 
                  className="text-slate-400 text-sm hover:text-slate-300"
                >
                  Back to student login
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={handleGoogleSignIn} 
                disabled={loading} 
                className="w-full px-4 py-3 bg-cyscom rounded-lg text-black font-medium hover:bg-cyscom/90 transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    Signing in...
                  </span>
                ) : (
                  'Sign in with Google'
                )}
              </button>
              <div className="mt-4 text-center">
                <button 
                  onClick={toggleAdminLogin} 
                  className="text-slate-400 text-sm hover:text-slate-300"
                >
                  Admin login
                </button>
              </div>
            </div>
          )}
          
          {!showAdminLogin && (
            <div className="mt-6 text-xs text-slate-400">
              *Only @vitstudent.ac.in accounts are allowed for student sign-in
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-slate-700 pt-6">
          <h3 className="text-lg font-medium text-white">How it works:</h3>
          <ol className="mt-4 text-left text-slate-300 space-y-2 list-decimal list-inside">
            <li>Sign in with your VIT student account</li>
            <li>Select your preferred departments (up to 2)</li>
            <li>Choose projects you'd like to work on</li>
            <li>Contribute to your selected projects</li>
          </ol>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Cyscom VIT. All rights reserved.
        </p>
      </div>
    </div>
  )
}
