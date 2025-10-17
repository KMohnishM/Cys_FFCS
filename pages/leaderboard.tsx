import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore'
import Navigation from '../components/Navigation'

interface LeaderboardEntry {
  userId: string
  name: string
  email: string
  totalPoints: number
  role: string
  departments: string[]
  projectId?: string
}

export default function Leaderboard(){
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const db = getDbClient()
    
    // Get current user role
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        setUserRole(userSnap.exists() ? (userSnap.data() as any).role : null)
      } else {
        setUserRole(null)
      }
    })

    // Get leaderboard data
    const usersRef = collection(db, 'users')
    const q = query(usersRef, orderBy('totalPoints', 'desc'))
    const unsubLeaderboard = onSnapshot(q, (snapshot) => {
      const entries: LeaderboardEntry[] = []
      snapshot.forEach((doc) => {
        const data = doc.data() as any
        // Filter out admins and superadmins
        if (data.role !== 'admin' && data.role !== 'superadmin') {
          entries.push({
            userId: doc.id,
            name: data.name || 'Anonymous',
            email: data.email || '',
            totalPoints: data.totalPoints || 0,
            role: data.role || 'member',
            departments: data.departments || [],
            projectId: data.projectId
          })
        }
      })
      setLeaderboard(entries)
      setLoading(false)
    })

    return () => {
      unsubAuth()
      unsubLeaderboard()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation userRole={userRole} />
        
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
            <div className="max-w-4xl mx-auto">
              {/* Skeleton Header */}
              <div className="text-center mb-12">
                <div className="h-16 bg-white/10 rounded-lg animate-pulse mb-4"></div>
                <div className="h-8 bg-white/5 rounded animate-pulse"></div>
              </div>

              {/* Skeleton Leaderboard */}
              <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="relative p-6 bg-black/30 border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse"></div>
                          <div className="flex-1">
                            <div className="h-6 bg-white/10 rounded animate-pulse mb-2"></div>
                            <div className="h-4 bg-white/5 rounded animate-pulse"></div>
                          </div>
                        </div>
                        <div className="h-8 bg-white/10 rounded animate-pulse w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation userRole={userRole} />
      
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
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-cyberblue-300 to-cyscom bg-clip-text text-transparent mb-4">
                Leaderboard
              </h1>
              <p className="text-xl md:text-2xl text-cyberblue-400 font-light">
                Top Contributors
              </p>
            </div>

            {/* Leaderboard */}
            <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-cyberblue-300/70">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyberblue-300/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    No users found yet. Users will appear here once they start contributing.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((user, index) => (
                    <div 
                      key={user.userId} 
                      className={`group relative p-6 bg-black/30 border rounded-xl transition-all duration-300 transform hover:scale-102 ${
                        index === 0 
                          ? 'border-yellow-500/50 shadow-2xl shadow-yellow-500/10' 
                          : index === 1 
                            ? 'border-slate-400/50'
                            : index === 2
                              ? 'border-orange-500/50'
                              : 'border-cyberblue-900/30 hover:border-cyberblue-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                          {/* Rank */}
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-xl ${
                            index === 0 
                              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30' 
                              : index === 1 
                                ? 'bg-slate-400 text-black'
                                : index === 2
                                  ? 'bg-orange-500 text-black'
                                  : 'bg-cyberblue-950/50 text-cyberblue-300 border border-cyberblue-700/50'
                          }`}>
                            {index + 1}
                          </div>
                          
                          {/* User Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-white">{user.name}</h3>
                              {user.role === 'admin' && (
                                <span className="px-3 py-1 bg-cyscom/20 text-cyscom text-xs rounded-full border border-cyscom/30 font-semibold">
                                  Admin
                                </span>
                              )}
                              {user.role === 'superadmin' && (
                                <span className="px-3 py-1 bg-red-900/50 text-red-400 text-xs rounded-full border border-red-700/50 font-semibold">
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <p className="text-cyberblue-300/70 text-sm mb-2">{user.email}</p>
                            <div className="flex items-center gap-4">
                              {user.departments && user.departments.length > 0 && (
                                <div className="flex items-center gap-1 text-cyberblue-300/50 text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  {user.departments.length} department{user.departments.length !== 1 ? 's' : ''}
                                </div>
                              )}
                              {user.projectId && (
                                <div className="flex items-center gap-1 text-cyberblue-300/50 text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  In project
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Points */}
                        <div className="text-right">
                          <div className="text-3xl font-bold text-cyscom mb-1">{user.totalPoints}</div>
                          <div className="text-cyberblue-300/70 text-sm uppercase tracking-wider">Points</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex justify-center mt-8">
              <Link 
                href="/dashboard" 
                className="px-8 py-4 border border-cyberblue-700/50 text-cyberblue-400 font-semibold rounded-xl hover:border-cyberblue-500 hover:bg-cyberblue-950/20 transition-all duration-300 backdrop-blur-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
