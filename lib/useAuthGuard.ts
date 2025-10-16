import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

// Define user progress states
export enum UserProgress {
  NOT_AUTHENTICATED,
  NEEDS_DEPARTMENTS,
  NEEDS_PROJECT,
  COMPLETE
}

// Define which pages are accessible at each progress level
const pageAccessRules: Record<string, UserProgress[]> = {
  '/': [UserProgress.NOT_AUTHENTICATED, UserProgress.NEEDS_DEPARTMENTS, UserProgress.NEEDS_PROJECT, UserProgress.COMPLETE],
  '/login': [UserProgress.NOT_AUTHENTICATED, UserProgress.NEEDS_DEPARTMENTS, UserProgress.NEEDS_PROJECT, UserProgress.COMPLETE],
  '/dashboard': [UserProgress.NEEDS_DEPARTMENTS, UserProgress.NEEDS_PROJECT, UserProgress.COMPLETE],
  '/departments': [UserProgress.NEEDS_DEPARTMENTS, UserProgress.NEEDS_PROJECT, UserProgress.COMPLETE],
  '/projects': [UserProgress.NEEDS_PROJECT, UserProgress.COMPLETE],
  '/contributions': [UserProgress.COMPLETE],
  '/leaderboard': [UserProgress.NEEDS_DEPARTMENTS, UserProgress.NEEDS_PROJECT, UserProgress.COMPLETE],
  '/admin': [UserProgress.COMPLETE], // Admin will have separate role check
}

// Allow access to dynamic project pages based on the same rules as /projects
pageAccessRules['/project/[id]'] = pageAccessRules['/projects']

export default function useAuthGuard() {
  const router = useRouter()
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  useEffect(() => {
    // Skip auth check for public pages
    const publicPaths = ['/', '/login']
    if (publicPaths.includes(router.pathname)) {
      setUserProgress(UserProgress.NOT_AUTHENTICATED)
      setIsLoading(false)
      return
    }
    
    const checkUserProgress = async () => {
      setIsLoading(true)
      
      // Special case for admin pages - will be checked separately in the admin component
      if (router.pathname === '/admin' || router.pathname === '/superadmin') {
        setIsLoading(false)
        return
      }
      
      try {
        const auth = getAuthClient()
        const user = auth.currentUser
        
        // Not authenticated
        if (!user) {
          setUserProgress(UserProgress.NOT_AUTHENTICATED)
          setIsLoading(false)
          return // Let the AuthGuard component handle the redirect
        }
        
        // Check user data from Firestore
        const db = getDbClient()
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        
        if (!userSnap.exists()) {
          // User document doesn't exist yet (should be created on auth)
          setUserProgress(UserProgress.NEEDS_DEPARTMENTS)
          setIsLoading(false)
          return
        }
        
        const userData = userSnap.data()
        setUserRole(userData.role)
        
        // Check departments
        if (!userData.departments || userData.departments.length < 1) {
          setUserProgress(UserProgress.NEEDS_DEPARTMENTS)
          
          // Redirect to departments page if trying to access a page that requires departments
          if (router.pathname !== '/departments' && 
              router.pathname !== '/dashboard' && 
              !pageAccessRules[router.pathname]?.includes(UserProgress.NEEDS_DEPARTMENTS)) {
            router.push('/departments')
          }
          
          setIsLoading(false)
          return
        }
        
        // Check project
        if (!userData.projectId) {
          setUserProgress(UserProgress.NEEDS_PROJECT)
          
          // Redirect to projects page if trying to access pages that require project
          if (router.pathname === '/contributions') {
            router.push('/projects')
          }
          
          setIsLoading(false)
          return
        }
        
        // User has completed all required steps
        setUserProgress(UserProgress.COMPLETE)
        setIsLoading(false)
      } catch (error) {
        console.error('Auth guard error:', error)
        setUserProgress(UserProgress.NOT_AUTHENTICATED)
        setIsLoading(false)
      }
    }
    
    checkUserProgress()
  }, [router.pathname])
  
  // Check if current page is accessible with user's progress
  useEffect(() => {
    if (isLoading || userProgress === null) return
    
    // Skip for public pages
    if (router.pathname === '/' || router.pathname === '/login') {
      return
    }
    
    // Admin/superadmin bypass normal flow for their pages
    if ((router.pathname === '/admin' || router.pathname === '/superadmin') && 
        (userRole === 'admin' || userRole === 'superadmin')) {
      return
    }
    
    // Find matching rule for the current path
    let rulePath = router.pathname
    if (router.pathname.startsWith('/project/')) {
      rulePath = '/project/[id]'
    }
    
    const allowedProgressStates = pageAccessRules[rulePath]
    
    // If no rule exists or user's progress isn't in allowed states, redirect
    if (!allowedProgressStates || !allowedProgressStates.includes(userProgress)) {
      // Redirect based on user progress
      if (userProgress === UserProgress.NOT_AUTHENTICATED) {
        router.push('/')
      } else if (userProgress === UserProgress.NEEDS_DEPARTMENTS) {
        router.push('/departments')
      } else if (userProgress === UserProgress.NEEDS_PROJECT) {
        router.push('/projects')
      } else {
        router.push('/dashboard')
      }
    }
  }, [userProgress, router.pathname, isLoading, userRole])
  
  return { userProgress, isLoading, userRole }
}