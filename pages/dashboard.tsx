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
    trackEvent('page_view', { path: '/dashboard', metadata: { title: 'User Dashboard' } })

    const auth = getAuthClient()
    const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        router.push('/')
        return
      }

      setUser(currentUser)

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

        const contributionsQuery = query(collection(db, 'contributions'), where('userId', '==', currentUser.uid))
        const contributionsSnap = await getDocs(contributionsQuery)
        const contributionsData = contributionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setContributionsCount(contributionsData.length)

        const points = contributionsData.reduce((total, contrib: any) => total + (contrib.pointsAwarded || 0), 0)
        setTotalPoints(points)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching user data:', error)
        setLoading(false)
      }
    })

    return () => unsubAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation userRole={userData?.role} />
      <main className="page-shell">
        {loading ? (
          <div className="ascii-card text-center space-y-3">
            <span className="ascii-card-top" aria-hidden="true">+----------------------+</span>
            <p className="text-xs uppercase tracking-[0.12em]">Loading dashboard data...</p>
            <p className="text-sm" aria-hidden="true">[ \\ ] [ | ] [ / ] [ - ]</p>
            <span className="ascii-card-bottom" aria-hidden="true">+----------------------+</span>
          </div>
        ) : (
          <div className="ascii-stack">
            <header className="space-y-2">
              <h1 className="ascii-title">Welcome</h1>
              <hr className="ascii-rule" />
              <div className="text-sm uppercase tracking-[0.16em]">
                {user?.displayName || user?.email || 'Member'}
              </div>
              <p className="ascii-footnote">Dashboard overview. Nothing fancy.</p>
            </header>

            <section className="grid gap-3 md:grid-cols-2">
              <div className="ascii-card">
                <span className="ascii-card-top" aria-hidden="true">+-----------+</span>
                <div className="space-y-2">
                  <p className="ascii-meta">Points</p>
                  <p className="text-3xl tracking-[0.08em]">{totalPoints.toString().padStart(3, '0')}</p>
                  <p className="ascii-footnote">Awarded across verified contributions.</p>
                </div>
                <span className="ascii-card-bottom" aria-hidden="true">+-----------+</span>
              </div>

              <div className="ascii-card">
                <span className="ascii-card-top" aria-hidden="true">+-----------+</span>
                <div className="space-y-2">
                  <p className="ascii-meta">Contributions</p>
                  <p className="text-3xl tracking-[0.08em]">{contributionsCount.toString().padStart(2, '0')}</p>
                  <p className="ascii-footnote">Submissions logged under your ID.</p>
                </div>
                <span className="ascii-card-bottom" aria-hidden="true">+-----------+</span>
              </div>
            </section>

            <section className="ascii-card space-y-4">
              <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
              <div className="space-y-2">
                <p className="ascii-meta">Next Actions</p>
                <div className="flex flex-col md:flex-row gap-3">
                  <Link href="/contributions" className="ascii-button flex-1 text-center">
                    Add Contribution
                  </Link>
                  <Link href="/projects" className="ascii-button flex-1 text-center">
                    Explore Projects
                  </Link>
                </div>
                <p className="ascii-footnote">Keep shipping. Points follow proof.</p>
              </div>
              <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
            </section>

            {userData?.departments && userData.departments.length > 0 && (
              <section className="ascii-card space-y-3">
                <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
                <p className="ascii-meta">Department</p>
                <ul className="ascii-list text-sm tracking-[0.04em] normal-case">
                  {userData.departments.map((dept: string) => (
                    <li key={dept}>{dept}</li>
                  ))}
                </ul>
                <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
              </section>
            )}

            <footer className="ascii-footnote text-center uppercase tracking-[0.18em]">
              Stay monochrome. Stay consistent.
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}
