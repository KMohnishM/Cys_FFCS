import React, { useEffect, useState } from 'react'
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

  useEffect(() => {
    // guard: only run in browser
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const unsub = auth.onAuthStateChanged((u: any) => {
      setUser(u)
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
    <div className="min-h-screen p-8 container mx-auto">
      <div className="max-w-3xl mx-auto bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Contributions</h2>
            {selectedProject && (
              <p className="text-cyscom text-sm mt-1">
                For project: {selectedProject.name}
              </p>
            )}
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">{user.displayName}</span>
              <button onClick={signOutUser} className="px-3 py-1 rounded bg-red-600 text-white text-sm">Sign out</button>
            </div>
          ) : (
            <button onClick={signIn} className="px-4 py-2 rounded bg-cyscom text-black font-medium">Sign in with VIT Mail</button>
          )}
        </div>

        <p className="mt-2 text-slate-300">
          Submit your contribution (text + optional image). Admins will verify and assign points.
          {selectedProject && " Your contribution will be linked to your project."}
        </p>
        
        {userProjects.length > 0 && (
          <div className="mt-4 p-3 bg-black/30 rounded flex items-center justify-between">
            <div className="text-sm text-slate-300">
              {selectedProject 
                ? "Adding contribution for your project" 
                : "You can add contributions for your project or general contributions"}
            </div>
            <div className="flex gap-2">
              {selectedProject && (
                <button 
                  onClick={() => {
                    setSelectedProject(null);
                    router.push('/contributions?projectId=null');
                  }}
                  className="px-3 py-1 rounded bg-slate-700 text-white text-xs"
                >
                  Show All Contributions
                </button>
              )}
              {!selectedProject && userProjects.length > 0 && (
                <button 
                  onClick={() => {
                    setSelectedProject(userProjects[0]);
                    router.push(`/contributions?projectId=${userProjects[0].id}`);
                  }}
                  className="px-3 py-1 rounded bg-cyscom/70 text-white text-xs"
                >
                  Show Project Contributions
                </button>
              )}
            </div>
          </div>
        )}


        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[120px] p-3 rounded bg-black/40 text-white outline-none"
            placeholder="Describe your contribution..."
          />

          <div className="flex items-center gap-4">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1 rounded bg-black/30 text-sm text-slate-200">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
              <span>{file ? file.name : 'Upload image (optional)'}</span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-cyscom text-black font-medium disabled:opacity-60"
            >
              {loading ? 'Submitting...' : 'Submit Contribution'}
            </button>
          </div>
        </form>

        <hr className="my-6 border-slate-700" />

        <h3 className="text-lg font-medium text-white flex items-center justify-between">
          <span>
            {selectedProject ? `Contributions for ${selectedProject.name}` : 'Your contributions'}
            <span className="text-sm text-slate-400 ml-2">({contribs.length})</span>
          </span>
        </h3>
        
        {user ? (
          <div className="mt-4 space-y-3">
            {contribs.length === 0 && (
              <p className="text-slate-300">
                {selectedProject 
                  ? `No contributions yet for project ${selectedProject.name}.` 
                  : 'No contributions yet.'}
              </p>
            )}
            
            {contribs.map((c) => (
              <div key={c.contribId} className="p-3 rounded bg-black/30">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center mb-1">
                      {c.projectId && (
                        <span className="mr-2 px-2 py-0.5 bg-cyscom/20 text-cyscom text-xs rounded">
                          Project Contribution
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'}
                      </span>
                    </div>
                    
                    <p className="text-slate-200">{c.text}</p>
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="contribution" className="mt-2 max-h-48 w-auto rounded" />
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-sm ${
                      c.status === 'verified' ? 'bg-green-600 text-white' : 
                      c.status === 'rejected' ? 'bg-red-600 text-white' : 
                      'bg-yellow-500 text-black'
                    }`}>
                      {c.status}
                    </div>
                    <div className="text-xs text-slate-300 mt-2">Points: {c.pointsAwarded ?? 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-slate-300">Sign in to submit and view your contributions.</p>
        )}
      </div>
    </div>
  )
}
