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
  const [viewerImage, setViewerImage] = useState<string | null>(null)
  const [viewerZoom, setViewerZoom] = useState<number>(1)

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

        // Resize & compress to reduce storage/bandwidth with improved quality settings
        const toDataUrl = (file: File, maxWidth = 2048, quality = 0.92): Promise<{ dataUrl: string; name: string }> => {
          return new Promise((resolve, reject) => {
            const img = new Image()
            const reader = new FileReader()
            reader.onload = () => {
              img.onload = () => {
                const canvas = document.createElement('canvas')
                // Only scale down if image is larger than maxWidth
                const scale = img.width > maxWidth ? maxWidth / img.width : 1
                canvas.width = Math.round(img.width * scale)
                canvas.height = Math.round(img.height * scale)
                const ctx = canvas.getContext('2d')!
                
                // Use better quality rendering
                ctx.imageSmoothingEnabled = true
                ctx.imageSmoothingQuality = 'high'
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                
                // Use WebP if supported, otherwise fall back to high quality JPEG
                const isWebPSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
                const format = isWebPSupported ? 'image/webp' : 'image/jpeg'
                const dataUrl = canvas.toDataURL(format, quality)
                resolve({ dataUrl, name: file.name.replace(/\s+/g, '_') })
              }
              if (typeof reader.result === 'string') img.src = reader.result
            }
            reader.onerror = (e) => reject(e)
            reader.readAsDataURL(file)
          })
        }

        const { dataUrl, name } = await toDataUrl(file, 2048, 0.92)

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
            <div className="flex justify-between items-center">
              <p className="ascii-meta">Contribution History</p>
              <div className="text-xs tracking-wide">
                {contribs.length} item{contribs.length !== 1 ? 's' : ''}
              </div>
            </div>

            {user ? (
              <div className="space-y-4">
                {contribs.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="text-sm uppercase tracking-wider opacity-50">
                      No contributions found
                    </div>
                    <p className="text-xs mt-2 opacity-70 uppercase tracking-wide">
                      Submit your first contribution above
                    </p>
                  </div>
                )}

                {contribs.map((c) => (
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
                      <div 
                        className="relative group border-2 border-white/70 hover:border-white inline-block cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200" 
                        onClick={() => setViewerImage(c.imageUrl || null)}
                      >
                        {/* Smaller sized preview */}
                        <div className="max-h-48 min-h-[100px] min-w-[100px] bg-black/20 flex items-center justify-center">
                          <img 
                            src={c.imageUrl} 
                            alt="contribution" 
                            className="max-h-48 w-auto object-contain" 
                            loading="lazy"
                            style={{
                              imageRendering: 'auto',
                              backfaceVisibility: 'hidden'
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/60 transition-all duration-200">
                          <div className="opacity-0 group-hover:opacity-100 transform group-hover:scale-100 scale-90 transition-all duration-200 bg-white/10 backdrop-blur-sm p-3 rounded flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                            <span className="font-bold tracking-wider">View Full Image</span>
                          </div>
                        </div>
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

      {/* Image Viewer Modal */}
      {viewerImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2">
          <div className="relative w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Header with controls */}
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black to-transparent">
              <div className="flex items-center gap-4">
                <div className="flex bg-black/80 border border-white p-1 rounded">
                  <button 
                    onClick={() => setViewerZoom(z => Math.max(0.5, z - 0.25))}
                    className="px-4 py-2 text-lg font-bold hover:bg-white/10"
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <div className="px-3 py-2 border-x border-white/30">
                    {Math.round(viewerZoom * 100)}%
                  </div>
                  <button 
                    onClick={() => setViewerZoom(z => Math.min(5, z + 0.25))}
                    className="px-4 py-2 text-lg font-bold hover:bg-white/10"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
                
                <button 
                  onClick={() => setViewerZoom(1)}
                  className="bg-black/80 border border-white px-4 py-2 hover:bg-white/10"
                >
                  Reset View
                </button>
                
                <a 
                  href={viewerImage} 
                  download 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-black/80 border border-white px-4 py-2 hover:bg-white/10 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              </div>
              
              <button 
                onClick={() => {
                  setViewerImage(null);
                  setViewerZoom(1);
                }}
                className="bg-red-900 border border-red-700 text-white px-4 py-2 hover:bg-red-800"
                aria-label="Close image viewer"
              >
                Close Viewer
              </button>
            </div>
            
            {/* Main image container with scroll/zoom */}
            <div 
              className="overflow-auto flex-1 flex items-center justify-center mt-16"
              style={{
                backgroundColor: 'rgba(0,0,0,0.9)'
              }}
            >
              <div 
                style={{
                  transform: `scale(${viewerZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                className="relative cursor-move"
              >
                <img 
                  src={viewerImage} 
                  alt="Contribution Image" 
                  className="max-w-none max-h-none shadow-2xl"
                  style={{
                    boxShadow: '0 0 20px rgba(255,255,255,0.1)',
                    imageRendering: 'auto',
                    objectFit: 'contain',
                    backfaceVisibility: 'hidden'
                  }}
                  onLoad={(e) => {
                    // Auto-fit large images
                    const img = e.target as HTMLImageElement;
                    const container = document.querySelector('.overflow-auto');
                    
                    if (container) {
                      const containerWidth = container.clientWidth;
                      const containerHeight = container.clientHeight;
                      
                      if (img.naturalWidth > containerWidth || img.naturalHeight > containerHeight) {
                        // Automatically adjust zoom to fit image within viewport
                        const widthRatio = containerWidth / img.naturalWidth;
                        const heightRatio = containerHeight / img.naturalHeight;
                        const fitZoom = Math.min(1, Math.min(widthRatio, heightRatio) * 0.9);
                        
                        if (fitZoom < 1) setViewerZoom(fitZoom);
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Image navigation dots (for future multi-image support) */}
            <div className="bg-black py-3 flex justify-center">
              <div className="bg-white/10 h-1 w-20 rounded-full"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
