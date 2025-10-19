import { ReactNode } from 'react'
import useAuthGuard, { UserProgress } from './useAuthGuard'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface AuthGuardProps {
  children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, userProgress } = useAuthGuard()
  const router = useRouter()
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] opacity-70">Loading...</div>
          <div className="text-sm" aria-hidden="true">[ \\ ] [ | ] [ / ] [ - ]</div>
        </div>
      </div>
    )
  }
  
  // If user is authenticated, render children
  if (userProgress !== UserProgress.NOT_AUTHENTICATED) {
    return <>{children}</>
  }
  
  // User is not authenticated, show sign-in message with redirect button
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="ascii-card max-w-sm w-full text-center space-y-4">
        <span className="ascii-card-top" aria-hidden="true">+----------------------+</span>
        <h2 className="uppercase tracking-[0.18em] text-sm">Authentication Required</h2>
        <p className="text-xs uppercase tracking-[0.12em] opacity-80">
          Please sign in to access this page.
        </p>
        <Link href="/" className="ascii-button text-xs">
          Go To Sign In
        </Link>
        <span className="ascii-card-bottom" aria-hidden="true">+----------------------+</span>
      </div>
    </div>
  )
}