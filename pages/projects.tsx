import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, onSnapshot, doc, runTransaction, where, getDocs, addDoc, Timestamp, deleteDoc } from 'firebase/firestore'
import type { Project } from '../types'
import Navigation from '../components/Navigation'

export default function Projects(){
  const [projects, setProjects] = useState<Project[]>([])
  const [userId, setUserId] = useState<string|null>(null)
  const [userDepts, setUserDepts] = useState<string[]|null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userProject, setUserProject] = useState<string | null>(null)
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set())

  useEffect(()=>{
    if(typeof window==='undefined') return
    const auth = getAuthClient()
    const db = getDbClient()
    const unsub = auth.onAuthStateChanged(async (u: any | null) => {
      setUserId(u?.uid ?? null)
      if (u) {
        const { doc, getDoc } = await import('firebase/firestore')
        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        setUserRole(userSnap.exists() ? (userSnap.data() as any).role : null)
      } else {
        setUserRole(null)
      }
    })
    return ()=>unsub()
  },[])

  useEffect(() => {
    if (!userId) {
      setUserDepts(null);
      setUserProject(null);
      return;
    }
    
    const db = getDbClient()
    ;(async ()=>{
      const { doc, getDoc } = await import('firebase/firestore')
      const uref = doc(db,'users',userId)
      const snap = await getDoc(uref)
      if(snap.exists()){
        const data = snap.data() as any
        setUserDepts(Array.isArray(data.departments) ? data.departments : null);
        setUserProject(data.projectId || null);
      }
    })()
  },[userId])

  useEffect(()=>{
    const db = getDbClient()
    const col = collection(db,'projects')
    const q = query(col)
    const unsub = onSnapshot(q,(snap)=>{
      const list: Project[] = []
      snap.forEach(d=>{
        const data = d.data() as any
        list.push({
          projectId: d.id,
          name: data.name,
          description: data.description,
          members: data.members || [], 
          department: data.department || null
        } as Project & any)
      })
      setProjects(list)
      setAllProjects(list)
    })
    return ()=>unsub()
  },[])

  // Track pending join requests
  useEffect(() => {
    if (!userId) return
    const db = getDbClient()
    const q = query(
      collection(db, 'joinRequests'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    )
    const unsub = onSnapshot(q, (snap) => {
      const projectIds = new Set<string>()
      snap.forEach((doc) => {
        const data = doc.data() as any
        projectIds.add(data.projectId)
      })
      setPendingRequests(projectIds)
    })
    return () => unsub()
  }, [userId])

  const requestToJoin = async(p:Project)=>{
    if(!userId) return alert('Sign in required')
    const db = getDbClient()
    try{
      // Check if user already has a pending request
      const existingRequests = await getDocs(query(
        collection(db, 'joinRequests'),
        where('userId', '==', userId),
        where('projectId', '==', p.projectId),
        where('status', '==', 'pending')
      ))
      
      if (!existingRequests.empty) {
        alert('You already have a pending join request for this project')
        return
      }
      
      // Check if user is already a member
      if (p.members.includes(userId)) {
        alert('You are already a member of this project')
        return
      }
      
      // Check if project is full
      if (p.members.length >= 4) {
        alert('Project is full')
        return
      }
      
      await addDoc(collection(db,'joinRequests'), {
        userId,
        projectId: p.projectId,
        status: 'pending',
        requestedAt: Timestamp.now()
      })
      
      alert('Join request submitted successfully! An admin will review your request.')
    }catch(e:any){ 
      console.error('Failed to submit join request:', e)
      alert('Failed to submit join request. Please try again.') 
    }
  }

  const withdrawRequest = async (projectId: string) => {
    if (!userId) return alert('Sign in required')
    const db = getDbClient()
    try {
      // Find and delete the pending request
      const requests = await getDocs(query(
        collection(db, 'joinRequests'),
        where('userId', '==', userId),
        where('projectId', '==', projectId),
        where('status', '==', 'pending')
      ))
      
      if (requests.empty) {
        alert('No pending request found')
        return
      }
      
      // Delete the request
      await Promise.all(requests.docs.map(doc => deleteDoc(doc.ref)))
      
      alert('Join request withdrawn successfully!')
    } catch (e: any) {
      console.error('Failed to withdraw request:', e)
      alert('Failed to withdraw request. Please try again.')
    }
  }

  const leave = async(p:Project)=>{
    if(!userId) return
    const db = getDbClient()
    try{
      await runTransaction(db, async(tx)=>{
        // First, perform all reads
        const pref = doc(db,'projects',p.projectId)
        const psnap = await tx.get(pref)
        const members = (psnap.data() as any).members || []
        
        // Get user reference (no read needed here, just the reference)
        const uref = doc(db,'users',userId)
        
        // Now perform all writes after all reads are complete
        tx.update(pref,{members: members.filter((m:any)=>m!==userId)})
        tx.update(uref,{projectId: null})
      })
    }catch(e:any){ console.error(e); alert('Failed to leave project') }
  }

            const getDepartmentName = (deptId: string | null | undefined): string => {
              if (!deptId) return 'Unassigned'

              switch (deptId) {
                case 'technical':
                  return 'Technical'
                case 'development':
                  return 'Development'
                case 'events':
                  return 'Events'
                case 'social':
                  return 'Social Media'
                case 'content':
                  return 'Content'
                case 'design':
                  return 'Design'
                default:
                  return deptId
              }
            }

            return (
              <div className="min-h-screen bg-black text-white">
                <Navigation userRole={userRole} />
                <main className="page-shell py-8 sm:py-10">
                  <div className="ascii-stack gap-6">
                    <header className="space-y-2 text-center sm:text-left">
                      <h1 className="ascii-title text-2xl sm:text-3xl">Project Directory</h1>
                      <hr className="ascii-rule" />
                      <p className="ascii-footnote text-xs sm:text-sm">
                        Browse active builds, track team capacity, and send a join request when you spot a fit.
                      </p>
                    </header>

                    {projects.length === 0 ? (
                      <section className="ascii-card text-center space-y-4 px-6 py-8">
                        <div className="ascii-mono text-sm sm:text-base text-slate-300 flex flex-col items-center gap-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10 text-cyscom"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>No projects are open for your departments just yet.</span>
                          <span className="ascii-footnote text-[11px] text-slate-400">
                            {userDepts && userDepts.length > 0
                              ? 'Ping an admin if you think this is a mistake.'
                              : 'Pick your departments first so we can match you to projects.'}
                          </span>
                        </div>
                      </section>
                    ) : (
                      <section className="ascii-stack gap-5">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {projects.map((p) => {
                            const isMember = p.members.includes(userId || '')
                            const isFull = p.members.length >= 4
                            const isPending = pendingRequests.has(p.projectId)

                            return (
                              <article key={p.projectId} className={`ascii-card h-full flex flex-col gap-4 ${
                                isMember ? 'border-2 relative' : ''
                              }`}>
                                {isMember && (
                                  <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-white text-black px-2 py-1 text-[10px] uppercase tracking-wider font-bold">
                                    Your Project
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <Link href={`/project/${p.projectId}`} className="ascii-link text-lg sm:text-xl">
                                      {p.name} {isMember && '★'}
                                    </Link>
                                    <span className="ascii-tag text-[11px] uppercase tracking-[0.18em]">
                                      {getDepartmentName(p.department)}
                                    </span>
                                  </div>
                                  <p className="ascii-body text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-4">
                                    {p.description}
                                  </p>
                                </div>

                                <div className="ascii-meta text-[11px] sm:text-xs flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    {p.members.length}/4 seats filled
                                  </span>
                                  <Link href={`/project/${p.projectId}`} className="ascii-link text-[11px] sm:text-xs">
                                    View brief
                                  </Link>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                  {isMember ? (
                                    <button
                                      type="button"
                                      onClick={() => leave(p)}
                                      className="ascii-button bg-red-900/60 text-red-200 border-red-500/60 hover:bg-red-900/80"
                                    >
                                      Leave project
                                    </button>
                                  ) : isPending ? (
                                    <button
                                      type="button"
                                      onClick={() => withdrawRequest(p.projectId)}
                                      className="ascii-button bg-yellow-900/50 text-yellow-200 border-yellow-600/50 hover:bg-yellow-900/70"
                                    >
                                      Withdraw request
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => requestToJoin(p)}
                                      disabled={isFull}
                                      className={`ascii-button ${
                                        isFull
                                          ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                                          : 'bg-cyscom text-black font-semibold hover:bg-cyscom/90'
                                      }`}
                                    >
                                      {isFull ? 'Project full' : 'Request to join'}
                                    </button>
                                  )}
                                </div>
                              </article>
                            )
                          })}
                        </div>

                        <footer className="ascii-stack items-center justify-center text-center gap-3 sm:flex-row sm:gap-6">
                          <Link href="/dashboard" className="ascii-button px-6 py-2 text-[11px] sm:text-xs">
                            Back to dashboard
                          </Link>
                          <p className="ascii-meta text-[11px] sm:text-xs">
                            {projects.length} project{projects.length !== 1 ? 's' : ''} listed in total
                          </p>
                        </footer>
                      </section>
                    )}
                  </div>
                </main>
              </div>
            )
}
