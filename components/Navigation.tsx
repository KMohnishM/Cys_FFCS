import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getAuthClient, signOut } from '../lib/firebase'

interface NavigationProps {
  userRole?: string | null
}

export default function Navigation({ userRole }: NavigationProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const unsub = auth.onAuthStateChanged((u: any) => {
      setUser(u)
    })
    return () => unsub()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (e) {
      console.error('Sign out failed', e)
      alert('Failed to sign out')
    }
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '' },
    { href: '/departments', label: 'Departments', icon: '' },
    { href: '/projects', label: 'Projects', icon: '' },
    { href: '/contributions', label: 'Contributions', icon: '' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '' },
  ]

  return (
    <nav className="bg-black/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            {/* <div className="w-8 h-8 bg-cyscom rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm"></span>
            </div> */}
            <span className="text-white font-semibold">Cyscom FFCS</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  router.pathname === item.href
                    ? 'bg-white text-black font-medium'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="hidden md:flex items-center space-x-3">
                <span className="text-slate-300 text-sm">{user.displayName}</span>
                {(userRole === 'admin' || userRole === 'superadmin') && (
                  <Link
                    href="/admin"
                    className="px-3 py-1 bg-white/20 text-white border border-white/30 rounded-lg hover:bg-white/30 transition-colors text-sm"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button className="text-slate-300 hover:text-white p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  router.pathname === item.href
                    ? 'bg-white text-black font-medium'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            {user && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <span className="text-slate-300 text-sm">{user.displayName}</span>
                <div className="flex space-x-2">
                  {(userRole === 'admin' || userRole === 'superadmin') && (
                    <Link
                      href="/admin"
                      className="px-3 py-1 bg-white/20 text-white border border-white/30 rounded-lg text-sm"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg text-sm"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}