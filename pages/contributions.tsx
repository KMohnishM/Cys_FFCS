import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getAuthClient, getDbClient, getStorageClient } from '../lib/firebase'
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
import { trackEvent } from '../lib/analytics'
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
    const q = query(col, where('userId', '==', user.uid))

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
          pointsAwarded: data.pointsAwarded,
          createdAt,
        })
      })

      list.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })

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
                Contributions
              </h1>
              <p className="text-xl md:text-2xl text-cyberblue-400 font-light">
                Share Your Work & Earn Points
              </p>
            </div>

            {/* Contribution Form */}
            <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Submit Contribution</h2>
              
              {userProjects.length > 0 && (
                <div className="mb-6 p-4 bg-cyberblue-950/30 border border-cyberblue-700/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-cyberblue-300/70 text-sm">
                      {selectedProject 
                        ? `Adding contribution for: ${selectedProject.name}` 
                        : "You can add contributions for your project or general contributions"}
                    </div>
                    <div className="ml-4">
                      <label className="text-sm text-slate-300 mr-2">Select Project:</label>
                      <select value={selectedProject?.id ?? 'none'} onChange={(e) => {
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
                      }} className="bg-black/20 text-white rounded p-2">
                        <option value="none">-- None --</option>
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
                          className="px-4 py-2 bg-cyberblue-900/50 text-cyberblue-300 border border-cyberblue-700/50 rounded-lg text-sm hover:bg-cyberblue-900/70 transition-colors"
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
                          className="px-4 py-2 bg-cyscom/20 text-cyscom border border-cyscom/30 rounded-lg text-sm hover:bg-cyscom/30 transition-colors"
                        >
                          Project Only
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full min-h-[120px] p-4 bg-black/50 border border-cyberblue-900/50 rounded-xl text-white placeholder-cyberblue-300/50 outline-none focus:border-cyberblue-500/70 transition-colors"
                    placeholder="Describe your contribution..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-cyberblue-950/50 border border-cyberblue-700/50 text-cyberblue-300 rounded-lg hover:bg-cyberblue-950/70 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
                    <span>{file ? file.name : 'Upload Image (Optional)'}</span>
                  </label>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative px-6 py-3 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black font-semibold rounded-xl hover:shadow-2xl hover:shadow-cyberblue-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <span className="relative z-10">
                      {loading ? 'Submitting...' : 'Submit Contribution'}
                    </span>
                    {!loading && (
                      <div className="absolute inset-0 bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Contributions List */}
            <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                {selectedProject ? `Contributions for ${selectedProject.name}` : 'Your Contributions'}
                <span className="text-cyberblue-300/70 text-lg ml-2">({statusCounts.all})</span>
              </h2>
              
              {user ? (
                <div className="space-y-6">
                  {/* Status Filter Tabs */}
                  <div className="flex flex-wrap gap-3 pb-6 border-b border-cyberblue-900/30">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        statusFilter === 'all'
                          ? 'bg-cyberblue-600 text-white shadow-lg shadow-cyberblue-600/30'
                          : 'bg-black/30 text-cyberblue-300 border border-cyberblue-900/30 hover:bg-black/50'
                      }`}
                    >
                      All ({statusCounts.all})
                    </button>
                    <button
                      onClick={() => setStatusFilter('pending')}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        statusFilter === 'pending'
                          ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/30'
                          : 'bg-black/30 text-yellow-400 border border-yellow-900/30 hover:bg-black/50'
                      }`}
                    >
                      Pending ({statusCounts.pending})
                    </button>
                    <button
                      onClick={() => setStatusFilter('verified')}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        statusFilter === 'verified'
                          ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                          : 'bg-black/30 text-green-400 border border-green-900/30 hover:bg-black/50'
                      }`}
                    >
                      Approved ({statusCounts.verified})
                    </button>
                    <button
                      onClick={() => setStatusFilter('rejected')}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        statusFilter === 'rejected'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                          : 'bg-black/30 text-red-400 border border-red-900/30 hover:bg-black/50'
                      }`}
                    >
                      Rejected ({statusCounts.rejected})
                    </button>
                  </div>

                  <div className="space-y-4">
                    {visibleContribs.length === 0 && (
                      <div className="text-center py-8">
                        <div className="text-cyberblue-300/70">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyberblue-300/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {statusFilter === 'all' 
                            ? (selectedProject 
                              ? `No contributions yet for project ${selectedProject.name}.` 
                              : 'No contributions yet. Submit your first contribution above!')
                            : `No ${statusFilter} contributions.`}
                        </div>
                      </div>
                    )}
                    
                    {visibleContribs.map((c) => (
                      <div key={c.contribId} className="bg-black/30 border border-cyberblue-900/30 rounded-xl p-6 hover:border-cyberblue-700/50 transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            {c.projectId && (
                              <span className="px-3 py-1 bg-cyscom/20 text-cyscom text-xs rounded-full border border-cyscom/30">
                                Project Contribution
                              </span>
                            )}
                            <span className="text-cyberblue-300/70 text-sm">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'}
                            </span>
                          </div>
                          <div className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider shadow-lg ${
                            c.status === 'verified' 
                              ? 'bg-green-900/50 text-green-300 border border-green-500/50 shadow-green-500/20' 
                              : c.status === 'rejected' 
                              ? 'bg-red-900/50 text-red-300 border border-red-500/50 shadow-red-500/20' 
                              : 'bg-yellow-900/50 text-yellow-300 border border-yellow-500/50 shadow-yellow-500/20'
                          }`}>
                            {c.status === 'verified' ? '✓ Approved' : c.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                          </div>
                        </div>
                        
                        <p className="text-white mb-4">{c.text}</p>
                        
                        {c.imageUrl && (
                          <img src={c.imageUrl} alt="contribution" className="max-h-48 w-auto rounded-lg border border-cyberblue-900/30" />
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-cyberblue-900/30 flex items-center justify-between">
                          <div className="text-cyberblue-300/70 text-sm">
                            Points Earned: <span className={`font-bold text-lg ${(c.pointsAwarded ?? 0) > 0 ? 'text-cyscom' : 'text-cyberblue-300/50'}`}>{c.pointsAwarded ?? 0}</span>
                          </div>
                          {c.status === 'verified' && (c.pointsAwarded ?? 0) > 0 && (
                            <div className="flex items-center gap-2 text-green-400 text-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Contribution Approved</span>
                            </div>
                          )}
                          {c.status === 'rejected' && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Contribution Rejected</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-cyberblue-300/70">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyberblue-300/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign in to submit and view your contributions.
                  </div>
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
