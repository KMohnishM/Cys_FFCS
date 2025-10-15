import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { useRouter } from 'next/router'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import Navigation from '../components/Navigation'
import { trackEvent } from '../lib/analytics'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [totalPoints, setTotalPoints] = useState(0)
  const [contributionsCount, setContributionsCount] = useState(0)

  useEffect(() => {
    // Track page view
    trackEvent('page_view', { path: '/dashboard', metadata: { title: 'User Dashboard' } });
    
    const auth = getAuthClient()
    const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        router.push('/')
        return
      }
      
      setUser(currentUser)
      
      // Get user data from Firestore
      try {
        const db = getDbClient()
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        
        if (!userSnap.exists()) {
          setLoading(false)
          return
        }
        
        const userDataFromDb = userSnap.data()
        setUserData(userDataFromDb)
        
        // Fetch user's contributions
        const contributionsQuery = query(
          collection(db, 'contributions'), 
          where('userId', '==', currentUser.uid)
        );
        const contributionsSnap = await getDocs(contributionsQuery);
        const contributionsData = contributionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContributionsCount(contributionsData.length);
        
        // Calculate total points
        const points = contributionsData.reduce((total, contrib: any) => total + (contrib.pointsAwarded || 0), 0);
        setTotalPoints(points);
        
        setLoading(false)
      } catch (error) {
        console.error('Error fetching user data:', error)
        setLoading(false)
      }
    })
    
    return () => unsubAuth()
  }, [router])
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation userRole={userData?.role} />
        
        {/* Skeleton Loading */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/3 rounded-full blur-3xl"></div>
          
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full" style={{
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }}></div>
          </div>

          <div className="relative z-10 container mx-auto px-6 py-20">
            <div className="max-w-4xl mx-auto text-center">
              {/* Skeleton Welcome */}
              <div className="mb-8">
                <div className="h-16 bg-white/10 rounded-lg animate-pulse mb-4"></div>
                <div className="h-8 bg-white/5 rounded animate-pulse"></div>
              </div>

              {/* Skeleton Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
                <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
                  <div className="h-12 bg-white/10 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-white/5 rounded animate-pulse"></div>
                </div>
                <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
                  <div className="h-12 bg-white/10 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-white/5 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Skeleton Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="h-12 bg-white/10 rounded-xl animate-pulse w-48"></div>
                <div className="h-12 bg-white/5 rounded-xl animate-pulse w-48"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black">
      <Navigation userRole={userData?.role} />
      
      {/* Minimalist Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-cyberdark-900 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyscom/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyscom/3 rounded-full blur-3xl"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Welcome Message */}
            <div className="mb-8">
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-cyberblue-300 to-cyscom bg-clip-text text-transparent mb-4">
                Welcome
              </h1>
              {user && (
                <p className="text-xl md:text-2xl text-cyberblue-400 font-light">
                  {user.displayName}
                </p>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
              <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8 hover:border-cyberblue-700/70 transition-all duration-300">
                <div className="text-4xl font-bold text-cyberblue-400 mb-2">
                  {totalPoints}
                </div>
                <div className="text-cyberblue-300/70 uppercase tracking-wider text-sm">
                  Points Earned
                </div>
              </div>
              
              <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8 hover:border-cyberblue-700/70 transition-all duration-300">
                <div className="text-4xl font-bold text-cyscom mb-2">
                  {contributionsCount}
                </div>
                <div className="text-cyberblue-300/70 uppercase tracking-wider text-sm">
                  Contributions
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/contributions" 
                className="group relative px-8 py-4 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black font-semibold rounded-xl hover:shadow-2xl hover:shadow-cyberblue-500/25 transition-all duration-300 transform hover:scale-105"
              >
                <span className="relative z-10">Add Contribution</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
              
              <Link 
                href="/projects" 
                className="group px-8 py-4 border border-cyberblue-700/50 text-cyberblue-400 font-semibold rounded-xl hover:border-cyberblue-500 hover:bg-cyberblue-950/20 transition-all duration-300 backdrop-blur-sm"
              >
                Browse Projects
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
