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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const unsub = auth.onAuthStateChanged((u: any) => {
      setUser(u)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const handleRouteChange = () => setMenuOpen(false)
    router.events?.on('routeChangeComplete', handleRouteChange)
    router.events?.on('hashChangeComplete', handleRouteChange)
    return () => {
      router.events?.off('routeChangeComplete', handleRouteChange)
      router.events?.off('hashChangeComplete', handleRouteChange)
    }
  }, [router.events])

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
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/departments', label: 'Departments' },
    { href: '/projects', label: 'Projects' },
    { href: '/contributions', label: 'Contributions' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ]

  const isActive = (path: string) => router.pathname === path

  return (
    <nav className="sticky top-0 z-50 border-b border-white bg-black/95 backdrop-blur">
      <div className="page-shell py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={user ? '/dashboard' : '/'}
            className="flex items-center gap-2 md:gap-3 uppercase tracking-[0.28em] text-xs md:text-sm font-bold"
          >
            <span aria-hidden="true">+----+</span>
            <span>CFFCS</span>
          </Link>

          <div className="hidden md:flex items-center gap-2 xl:gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`ascii-link text-[11px] lg:text-xs ${isActive(item.href) ? 'ascii-link-active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
            {userRole && (userRole === 'admin' || userRole === 'superadmin') && (
              <Link href="/admin" className={`ascii-link text-[11px] lg:text-xs ${isActive('/admin') ? 'ascii-link-active' : ''}`}>
                Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] lg:text-xs uppercase tracking-[0.18em]">
            {user ? (
              <>
                <span className="ascii-meta">{user.displayName || user.email}</span>
                <button onClick={handleSignOut} className="ascii-button text-[11px] lg:text-xs px-3 py-2">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/home" className="ascii-button text-[11px] lg:text-xs px-3 py-2">
                Sign In
              </Link>
            )}
          </div>

          <button
            className="md:hidden ascii-button text-[11px] px-3 py-2"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
        </div>

        {menuOpen && (
          <div className="mt-4 md:hidden border-t border-white pt-4 space-y-3 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`ascii-link text-sm ${isActive(item.href) ? 'ascii-link-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {userRole && (userRole === 'admin' || userRole === 'superadmin') && (
              <Link
                href="/admin"
                className={`ascii-link text-sm ${isActive('/admin') ? 'ascii-link-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            <div className="pt-3 border-t border-white space-y-2 text-xs">
              {user ? (
                <>
                  <div className="ascii-meta">{user.displayName || user.email}</div>
                  <button onClick={handleSignOut} className="ascii-button w-full text-xs py-2">
                    Sign Out
                  </button>
                </>
              ) : (
                <Link href="/home" className="ascii-button w-full text-xs py-2" onClick={() => setMenuOpen(false)}>
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}