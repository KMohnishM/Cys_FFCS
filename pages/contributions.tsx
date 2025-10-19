import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getAuthClient, getDbClient, getStorageClient } from '../lib/firebase'
import { trackEvent } from '../lib/analytics'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth'
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import type { Contribution } from '../types'
import Navigation from '../components/Navigation'

export default function Contributions() {
  const router = useRouter()
  const { projectId } = router.query
  const pid = Array.isArray(projectId) ? projectId[0] : projectId
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [contribs, setContribs] = useState<Contribution[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [userProjects, setUserProjects] = useState<any[]>([])
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')

  const projectScopedContribs = useMemo(() => {
    if (!selectedProject) return contribs
    return contribs.filter((c) => c.projectId === selectedProject.id)
  }, [contribs, selectedProject])

  const statusCounts = useMemo(() => {
    const counts: { all: number; pending: number; verified: number; rejected: number } = {
      all: projectScopedContribs.length,
      pending: 0,
      verified: 0,
      rejected: 0,
    }

    projectScopedContribs.forEach((c) => {
      if (c.status === 'pending') counts.pending += 1
      if (c.status === 'verified') counts.verified += 1
      if (c.status === 'rejected') counts.rejected += 1
    })

    return counts
  }, [projectScopedContribs])

  const visibleContribs = useMemo(() => {
    if (statusFilter === 'all') return projectScopedContribs
    return projectScopedContribs.filter((c) => c.status === statusFilter)
  }, [projectScopedContribs, statusFilter])

  useEffect(() => {
    // guard: only run in browser
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const db = getDbClient()
    const unsub = auth.onAuthStateChanged(async (u: any) => {
      setUser(u)
      if (u) {
        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        setUserRole(userSnap.exists() ? (userSnap.data() as any).role : null)
      } else {
        setUserRole(null)
      }
    })
    return () => unsub()
  }, [])

  // Fetch user's projects when user is logged in
  useEffect(() => {
    if (!user) {
      setUserProjects([])
      return
    }

    const db = getDbClient()
    const fetchUserProjects = async () => {
      try {
        // Get user document to check projectId
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists() && userDoc.data().projectId) {
          const projectRef = doc(db, 'projects', userDoc.data().projectId)
          const projectSnap = await getDoc(projectRef)
          if (projectSnap.exists()) {
            const projectData = { id: projectSnap.id, ...projectSnap.data() }
            setUserProjects([projectData])
            
                // If projectId is in URL and matches user's project, select it
                if (pid && pid === projectSnap.id) {
                  setSelectedProject(projectData)
                } else if (pid === 'null' || !pid) {
                  // If projectId is explicitly set to null or not provided
                  setSelectedProject(null)
                }
          }
        }
      } catch (error) {
        console.error("Error fetching user projects:", error)
      }
    }

    fetchUserProjects()
  }, [user, pid])

  // Load all projects irrespective of department so users can select any project
  useEffect(() => {
    if (typeof window === 'undefined') return
    const db = getDbClient()
    const col = collection(db, 'projects')
    const unsub = onSnapshot(col, (snap) => {
      const list: any[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        list.push({ id: d.id, ...data })
      })
      setAllProjects(list)
    }, (err) => {
      console.error('Failed to load projects', err)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) {
      setContribs([])
      return
    }

    const db = getDbClient()
    const col = collection(db, 'contributions')
    
    // Create query based on whether a project is selected
    let q;
    if (selectedProject) {
      // When filtering by project
      q = query(
        col, 
        where('userId', '==', user.uid),
        where('projectId', '==', selectedProject.id)
      )
    } else {
      // Show all contributions by this user
      q = query(col, where('userId', '==', user.uid))
    }
    
    // Log the query being used for debugging purposes
    console.log('Querying contributions for user:', user.uid, selectedProject ? 'with project filter' : 'all contributions')
    
    const unsub = onSnapshot(q, (snap) => {
      const list: Contribution[] = []
      
      snap.forEach((d) => {
        const data = d.data() as any
        const rawCreated = data.createdAt
  const createdAt = rawCreated?.toDate ? rawCreated.toDate() : rawCreated instanceof Date ? rawCreated : new Date()

        list.push({
          contribId: d.id,
          userId: data.userId,
          projectId: data.projectId,
          text: data.text,
          imageUrl: data.imageUrl,
          status: data.status || 'pending',
          pointsAwarded: data.pointsAwarded || 0,
          createdAt: data.createdAt ? 
            (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt)) : 
            new Date(),
        })
      })
      
      // Sort manually since we removed orderBy from the query (which can cause index errors)
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      
      console.log(`Found ${list.length} contributions`)
      setContribs(list)
    }, (err) => {
      console.error('Failed to load contributions', err)
      setContribs([])
    })

    return () => unsub()
  }, [user?.uid])

  const signIn = async () => {
    const auth = getAuthClient()
    const provider = new (await import('firebase/auth')).GoogleAuthProvider()
    try {
      const result = await signInWithPopup(auth, provider)
      const u = result.user
      if (!u.email || !u.email.endsWith('@vitstudent.ac.in')) {
        await signOut(auth)
        alert('Please sign in with your @vitstudent.ac.in account')
        return
      }
      setUser(u)
    } catch (err: any) {
      console.error('Sign in failed', err)
      alert('Sign in failed')
    }
  }

  const signOutUser = async () => {
    const auth = getAuthClient()
    await signOut(auth)
    setUser(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert('Sign in required')
      return
    }
    if (!text.trim()) {
      alert('Please write something for your contribution')
      return
    }

    setLoading(true)
    try {
      let imageUrl: string | undefined = undefined
      if (file) {
        // Client-side guard: prevent too-large uploads for UX
        const MAX_BYTES = 5 * 1024 * 1024
        if (file.size > MAX_BYTES) {
          alert('Image must be smaller than 5 MB')
          setLoading(false)
          return
        }

        // Resize & compress to reduce storage/bandwidth (max width 1024)
        const toDataUrl = (file: File, maxWidth = 1024, quality = 0.8): Promise<{ dataUrl: string; name: string }> => {
          return new Promise((resolve, reject) => {
            const img = new Image()
            const reader = new FileReader()
            reader.onload = () => {
              img.onload = () => {
                const canvas = document.createElement('canvas')
                const scale = Math.min(1, maxWidth / img.width)
                canvas.width = Math.round(img.width * scale)
                canvas.height = Math.round(img.height * scale)
                const ctx = canvas.getContext('2d')!
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                // choose webp if available
                const dataUrl = canvas.toDataURL('image/jpeg', quality)
                resolve({ dataUrl, name: file.name.replace(/\s+/g, '_') })
              }
              if (typeof reader.result === 'string') img.src = reader.result
            }
            reader.onerror = (e) => reject(e)
            reader.readAsDataURL(file)
          })
        }

        const { dataUrl, name } = await toDataUrl(file, 1024, 0.78)

        // POST to local API route that saves to public/uploads
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: `${user.uid}_${Date.now()}_${name}`, dataUrl }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'upload failed' }))
          throw new Error(err.error || 'Upload failed')
        }
        const json = await res.json()
        imageUrl = json.url
      }

      const db = getDbClient()
      const col = collection(db, 'contributions')
      const projectIdForContrib = selectedProject ? selectedProject.id : null

      const docRef = await addDoc(col, {
        userId: user.uid,
        projectId: projectIdForContrib,
        text: text.trim(),
        imageUrl: imageUrl || null,
        status: 'pending',
        pointsAwarded: 0,
        createdAt: serverTimestamp(),
      })

      // update contribId field for convenience (optional)
      await updateDoc(doc(db, 'contributions', docRef.id), { contribId: docRef.id })

      const optimisticContribution: Contribution = {
        contribId: docRef.id,
        userId: user.uid,
        projectId: projectIdForContrib ?? undefined,
        text: text.trim(),
        imageUrl: imageUrl || undefined,
        status: 'pending',
        pointsAwarded: 0,
        createdAt: new Date(),
      }

      setContribs((prev) => {
        if (prev.some((item) => item.contribId === docRef.id)) {
          return prev
        }
        return [optimisticContribution, ...prev]
      })
      setStatusFilter('pending')

      void trackEvent('contribution_submit', {
        metadata: {
          contributionId: docRef.id,
          projectId: projectIdForContrib ?? 'general',
          projectName: selectedProject?.name ?? 'General',
          hasImage: Boolean(imageUrl),
        },
      })

      setText('')
      setFile(null)
    } catch (err) {
      console.error(err)
      alert('Failed to submit contribution')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation userRole={userRole} />
      <main className="page-shell py-8 sm:py-10">
        {/* Main Layout */}
        <div className="ascii-stack gap-6">
          {/* Header */}
          <header className="space-y-2">
            <h1 className="ascii-title text-2xl sm:text-3xl">Contributions</h1>
            <hr className="ascii-rule" />
            <div className="text-xs sm:text-sm uppercase tracking-[0.14em] sm:tracking-[0.16em]">
              {selectedProject ? `Project: ${selectedProject.name}` : 'All Contributions'}
            </div>
            <p className="ascii-footnote">Share your work. Get points. Stay monochrome.</p>
          </header>

          {/* Project Selection */}
          {userProjects.length > 0 && (
            <section className="ascii-card space-y-3">
              <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
              <p className="ascii-meta">Project Filter</p>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs tracking-wide">
                  {selectedProject 
                    ? `Showing contributions for: ${selectedProject.name}` 
                    : "Showing all contributions"}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs uppercase tracking-wider">Select:</label>
                    <select 
                      value={selectedProject?.id ?? 'none'} 
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'none') {
                          setSelectedProject(null)
                          router.push('/contributions?projectId=null')
                        } else {
                          const p = allProjects.find(ap => ap.id === val)
                          if (p) {
                            setSelectedProject(p)
                            router.push(`/contributions?projectId=${p.id}`)
                          }
                        }
                      }} 
                      className="bg-black border border-white px-2 py-1 text-xs uppercase tracking-wide"
                    >
                      <option value="none">-- NONE --</option>
                      {allProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    {selectedProject && (
                      <button 
                        onClick={() => {
                          setSelectedProject(null);
                          router.push('/contributions?projectId=null');
                        }}
                        className="ascii-button text-[10px] sm:text-xs py-1 px-2"
                      >
                        Show All
                      </button>
                    )}
                    {!selectedProject && userProjects.length > 0 && (
                      <button 
                        onClick={() => {
                          setSelectedProject(userProjects[0]);
                          router.push(`/contributions?projectId=${userProjects[0].id}`);
                        }}
                        className="ascii-button text-[10px] sm:text-xs py-1 px-2"
                      >
                        My Project
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
            </section>
          )}

          {/* Add Contribution Form */}
          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <p className="ascii-meta">Submit New Contribution</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="ascii-input min-h-[120px]"
                  placeholder="DESCRIBE YOUR CONTRIBUTION..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="ascii-button cursor-pointer py-2 text-xs">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} 
                    className="hidden" 
                  />
                  <span>{file ? file.name.substring(0, 15) + (file.name.length > 15 ? '...' : '') : 'Add Image'}</span>
                </label>
                
                <button
                  type="submit"
                  disabled={loading || !text.trim()}
                  className="ascii-button py-2 text-xs"
                >
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          {/* Contributions List */}
          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="ascii-meta">Contribution History</p>
              <div className="flex items-center gap-2">
                <button className={`px-3 py-1 rounded ${statusFilter === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-black'}`} onClick={() => setStatusFilter('all')}>All ({statusCounts.all})</button>
                <button className={`px-3 py-1 rounded ${statusFilter === 'pending' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-black'}`} onClick={() => setStatusFilter('pending')}>Pending ({statusCounts.pending})</button>
                <button className={`px-3 py-1 rounded ${statusFilter === 'verified' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-black'}`} onClick={() => setStatusFilter('verified')}>Verified ({statusCounts.verified})</button>
                <button className={`px-3 py-1 rounded ${statusFilter === 'rejected' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-black'}`} onClick={() => setStatusFilter('rejected')}>Rejected ({statusCounts.rejected})</button>
              </div>
            </div>

            {user ? (
              <div className="space-y-4">
                {visibleContribs.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="text-sm uppercase tracking-wider opacity-50">
                      No contributions found
                    </div>
                    <p className="text-xs mt-2 opacity-70 uppercase tracking-wide">
                      Submit your first contribution above
                    </p>
                  </div>
                )}

                {visibleContribs.map((c) => (
                  <div key={c.contribId} className="border border-white p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-center text-xs uppercase tracking-wider opacity-70">
                        <span>{c.createdAt.toLocaleDateString()}</span>
                        {c.projectId && (
                          <span className="ascii-tag">Project</span>
                        )}
                      </div>
                      
                      <div className="ascii-tag">
                        {c.status}
                      </div>
                    </div>
                    
                    <p className="text-sm">{c.text}</p>
                    
                    {c.imageUrl && (
                      <div className="border border-white/50 inline-block">
                        <img 
                          src={c.imageUrl} 
                          alt="contribution" 
                          className="max-h-32 w-auto object-contain" 
                        />
                      </div>
                    )}
                    
                    <div className="text-xs uppercase tracking-wider flex justify-between items-center">
                      <span className="opacity-70">ID: {c.contribId.substring(0, 8)}...</span>
                      <span>
                        Points: <strong>{c.pointsAwarded ?? 0}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="text-sm uppercase tracking-wider opacity-50">
                  Sign in required
                </div>
                <button onClick={signIn} className="ascii-button mt-4 py-2 text-xs">
                  Sign In
                </button>
              </div>
            )}
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          {/* Footer Links */}
          <footer className="flex justify-center">
            <Link href="/dashboard" className="ascii-button text-xs py-2">
              Dashboard
            </Link>
          </footer>
        </div>
      </main>
    </div>
  )
}
