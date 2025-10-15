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
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-4 bg-black/60 rounded-md shadow-lg">
          <div className="animate-spin w-8 h-8 border-4 border-cyscom border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-slate-300">Loading...</p>
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-black to-slate-900">
      <div className="p-6 bg-black/60 backdrop-blur-md rounded-md shadow-lg max-w-md text-center">
        <h2 className="text-xl text-cyscom font-semibold">Authentication Required</h2>
        <p className="mt-2 text-slate-300">Please sign in to access this page.</p>
        <div className="mt-6">
          <Link href="/" className="px-4 py-2 bg-cyscom rounded text-black font-medium">
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}