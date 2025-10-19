import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { signInWithGoogle, signInWithEmail, ensureMockData, getAuthClient, getDbClient } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function SignIn() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)

  useEffect(() => {
    ensureMockData().catch(console.error)

    const auth = getAuthClient()
    const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setIsAuthenticated(true)

        try {
          const db = getDbClient()
          const userRef = doc(db, 'users', currentUser.uid)
          const userSnap = await getDoc(userRef)

          if (!userSnap.exists()) {
            router.push('/dashboard')
            return
          }

          const userData = userSnap.data()

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
        router.push('/admin')
      }
    } catch (e) {
      console.error('Admin login failed', e)
      if (e instanceof Error && e.message.includes('auth/invalid-credential')) {
        if (confirm('Admin login failed. Setup admin users now?')) {
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
    setShowAdminLogin((prev) => !prev)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="page-shell">
        <div className="ascii-stack max-w-xl mx-auto">
          <header className="space-y-3 text-center">
            <p className="ascii-divider" aria-hidden="true">{'='.repeat(48)}</p>
            <h1 className="text-3xl uppercase tracking-[0.28em]">Cyscom FFCS Portal</h1>
            <p className="text-xs uppercase tracking-[0.14em] opacity-80">
              Monochrome interface ahead. Google sign-ins only.
            </p>
            <Link href="/" className="ascii-link text-xs">
              Visit Home Page
            </Link>
          </header>

          <section className="ascii-card text-center space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+------------------------------+</span>
            {isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.12em]">You are signed in. Redirecting...</p>
                <p className="text-sm" aria-hidden="true">[ \\ ] [ | ] [ / ] [ - ]</p>
                <Link href="/dashboard" className="ascii-button text-xs">
                  Go To Dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                <button onClick={handleGoogleSignIn} disabled={loading} className="ascii-button w-full">
                  {loading ? 'Signing In...' : 'Sign In With Google'}
                </button>
                <div className="space-y-2 text-xs">
                  <button onClick={toggleAdminLogin} className="ascii-link text-xs">
                    {showAdminLogin ? 'Close Admin Login' : 'Admin?'}
                  </button>
                  <p className="ascii-footnote">Only @vitstudent.ac.in accounts.</p>
                </div>
                {showAdminLogin && (
                  <div className="space-y-3 text-left">
                    <div>
                      <label htmlFor="email" className="ascii-label">Email</label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="ascii-input"
                        placeholder="admin@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="ascii-label">Password</label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="ascii-input"
                        placeholder="********"
                      />
                    </div>
                    <button onClick={handleAdminLogin} disabled={adminLoginLoading} className="ascii-button w-full">
                      {adminLoginLoading ? 'Verifying...' : 'Verify Access'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <span className="ascii-card-bottom" aria-hidden="true">+------------------------------+</span>
          </section>

          <footer className="text-center">
            <p className="ascii-divider" aria-hidden="true">{'-'.repeat(48)}</p>
            <p className="ascii-footnote">&copy; {new Date().getFullYear()} Cyscom VIT.</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
