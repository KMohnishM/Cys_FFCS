import React, { useEffect, useState } from "react"
import Link from "next/link"
import { getAuthClient, getDbClient } from "../lib/firebase"
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore"
import Navigation from "../components/Navigation"
import { trackEvent } from "../lib/analytics"

interface LeaderboardEntry {
  userId: string
  name: string
  email: string
  totalPoints: number
  role: string
  departments: string[]
  projectId?: string
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trackEvent('page_view', { path: '/leaderboard', metadata: { title: 'Leaderboard' } })
    
    if (typeof window === "undefined") return
    
    const auth = getAuthClient()
    const db = getDbClient()

    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        const userRef = doc(db, "users", u.uid)
        const userSnap = await getDoc(userRef)
        setUserRole(userSnap.exists() ? (userSnap.data() as any).role : null)
      } else {
        setUserRole(null)
      }
    })

    const usersRef = collection(db, "users")
    const q = query(usersRef, orderBy("totalPoints", "desc"))
    const unsubLeaderboard = onSnapshot(q, (snapshot) => {
      const entries: LeaderboardEntry[] = []
      snapshot.forEach((s) => {
        const data = s.data() as any
        if (data.role !== "admin" && data.role !== "superadmin") {
          entries.push({
            userId: s.id,
            name: data.name || "Anonymous",
            email: data.email || "",
            totalPoints: data.totalPoints || 0,
            role: data.role || "member",
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
      <div className="min-h-screen bg-black text-white">
        <Navigation userRole={userRole} />
        <main className="page-shell py-8 sm:py-10">
          <div className="ascii-card text-center space-y-3">
            <span className="ascii-card-top" aria-hidden="true">+----------------------+</span>
            <p className="text-xs uppercase tracking-[0.12em]">Loading leaderboard data...</p>
            <p className="text-sm" aria-hidden="true">[ \\ ] [ | ] [ / ] [ - ]</p>
            <span className="ascii-card-bottom" aria-hidden="true">+----------------------+</span>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation userRole={userRole} />
      <main className="page-shell py-8 sm:py-10">
        <div className="ascii-stack gap-6">
          <header className="space-y-2">
            <h1 className="ascii-title text-2xl sm:text-3xl">Leaderboard</h1>
            <hr className="ascii-rule" />
            <div className="text-xs sm:text-sm uppercase tracking-[0.14em] sm:tracking-[0.16em]">
              Top contributors ranked by points
            </div>
            <p className="ascii-footnote">Members who contribute get recognized.</p>
          </header>

          {leaderboard.length === 0 ? (
            <section className="ascii-card space-y-3">
              <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
              <p className="ascii-meta text-xs sm:text-sm">No Contributors Yet</p>
              <p className="text-sm">Users will appear here when they start contributing to projects.</p>
              <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
            </section>
          ) : (
            <section className="space-y-4">
              {leaderboard.map((user, index) => (
                <div key={user.userId} className="ascii-card">
                  <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-bold">
                        {index === 0 ? "1ST" : index === 1 ? "2ND" : index === 2 ? "3RD" : `${index + 1}TH`}
                      </div>
                      <div>
                        <div className="text-sm uppercase tracking-[0.08em] font-bold">{user.name}</div>
                        <div className="ascii-footnote">{user.email}</div>
                        {user.departments && user.departments.length > 0 && (
                          <div className="ascii-footnote mt-1">
                            {user.departments.length} department{user.departments.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl sm:text-3xl tracking-[0.08em]">{user.totalPoints.toString().padStart(3, '0')}</div>
                      <div className="ascii-footnote">Points</div>
                    </div>
                  </div>
                  <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
                </div>
              ))}
            </section>
          )}
          
          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <div className="space-y-2">
              <p className="ascii-meta">Options</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard" className="ascii-button flex-1 text-center text-[11px] sm:text-xs py-3">
                  Back to Dashboard
                </Link>
                <Link href="/projects" className="ascii-button flex-1 text-center text-[11px] sm:text-xs py-3">
                  Explore Projects
                </Link>
              </div>
              <p className="ascii-footnote">Keep shipping. Points follow proof.</p>
            </div>
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          <footer className="ascii-footnote text-center uppercase tracking-[0.16em] sm:tracking-[0.18em]">
            Stay monochrome. Stay consistent.
          </footer>
        </div>
      </main>
    </div>
  )
}
