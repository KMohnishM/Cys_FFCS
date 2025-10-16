import React, { useEffect, useState } from 'react'
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
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import type { Contribution } from '../types'
import Navigation from '../components/Navigation'

export default function Contributions() {
  const router = useRouter()
  const { projectId } = router.query
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [contribs, setContribs] = useState<Contribution[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [userProjects, setUserProjects] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)

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
            if (projectId && projectId === projectSnap.id) {
              setSelectedProject(projectData)
            } else if (projectId === 'null' || !projectId) {
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
  }, [user, projectId])

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
      q = query(
        col, 
        where('userId', '==', user.uid),
        where('projectId', '==', selectedProject.id),
        orderBy('createdAt', 'desc')
      )
    } else {
      q = query(col, where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
    }
    
    const unsub = onSnapshot(q, (snap) => {
      const list: Contribution[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        list.push({
          contribId: d.id,
          userId: data.userId,
          projectId: data.projectId,
          text: data.text,
          imageUrl: data.imageUrl,
          status: data.status || 'pending',
          pointsAwarded: data.pointsAwarded,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        })
      })
      setContribs(list)
    })

    return () => unsub()
  }, [user, selectedProject])

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
        const storage = getStorageClient()
        const path = `contributions/${user.uid}/${Date.now()}_${file.name}`
        const sRef = storageRef(storage, path)
        const uploadTask = uploadBytesResumable(sRef, file)
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            () => {},
            (err) => reject(err),
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref)
              resolve()
            }
          )
        })
      }

  const db = getDbClient()
  const col = collection(db, 'contributions')
      const docRef = await addDoc(col, {
        userId: user.uid,
        projectId: selectedProject ? selectedProject.id : null,
        text: text.trim(),
        imageUrl: imageUrl || null,
        status: 'pending',
        pointsAwarded: 0,
        createdAt: serverTimestamp(),
      })

      // update contribId field for convenience (optional)
      await updateDoc(doc(db, 'contributions', docRef.id), { contribId: docRef.id })

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
                <span className="text-cyberblue-300/70 text-lg ml-2">({contribs.length})</span>
              </h2>
              
              {user ? (
                <div className="space-y-4">
                  {contribs.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-cyberblue-300/70">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyberblue-300/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {selectedProject 
                          ? `No contributions yet for project ${selectedProject.name}.` 
                          : 'No contributions yet. Submit your first contribution above!'}
                      </div>
                    </div>
                  )}
                  
                  {contribs.map((c) => (
                    <div key={c.contribId} className="bg-black/30 border border-cyberblue-900/30 rounded-xl p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          {c.projectId && (
                            <span className="px-3 py-1 bg-cyscom/20 text-cyscom text-xs rounded-full border border-cyscom/30">
                              Project Contribution
                            </span>
                          )}
                          <span className="text-cyberblue-300/70 text-sm">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'}
                          </span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          c.status === 'verified' ? 'bg-green-900/50 text-green-400 border border-green-700/50' : 
                          c.status === 'rejected' ? 'bg-red-900/50 text-red-400 border border-red-700/50' : 
                          'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50'
                        }`}>
                          {c.status}
                        </div>
                      </div>
                      
                      <p className="text-white mb-4">{c.text}</p>
                      
                      {c.imageUrl && (
                        <img src={c.imageUrl} alt="contribution" className="max-h-48 w-auto rounded-lg border border-cyberblue-900/30" />
                      )}
                      
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-cyberblue-300/70 text-sm">
                          Points Earned: <span className="text-cyscom font-semibold">{c.pointsAwarded ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
