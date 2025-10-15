import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import type { Project } from '../types'
import { UserProgress } from '../lib/useAuthGuard'
import WorkflowSteps from '../components/WorkflowSteps'

export default function Projects(){
  const [projects, setProjects] = useState<Project[]>([])
  const [userId, setUserId] = useState<string|null>(null)
  const [userDepts, setUserDepts] = useState<string[]|null>(null)

  useEffect(()=>{
    if(typeof window==='undefined') return
    const auth = getAuthClient()
    const unsub = auth.onAuthStateChanged((u: any | null) => setUserId(u?.uid ?? null))
    return ()=>unsub()
  },[])

  useEffect(()=>{
    if(!userId) return
    const db = getDbClient()
    ;(async ()=>{
      const { doc, getDoc } = await import('firebase/firestore')
      const uref = doc(db,'users',userId)
      const snap = await getDoc(uref)
      if(snap.exists()){
        const data = snap.data() as any
        setUserDepts(data.departments || null)
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
      
      // Filter projects by user departments
      if(userDepts && userDepts.length > 0){
        const filteredProjects = list.filter(p => p.department && userDepts.includes(p.department))
        setProjects(filteredProjects)
      } else {
        setProjects(list)
      }
    })
    return ()=>unsub()
  },[userDepts])

  const join = async(p:Project)=>{
    if(!userId) return alert('Sign in required')
    const db = getDbClient()
    try{
      await runTransaction(db, async(tx)=>{
        // First, perform all reads
        const pref = doc(db,'projects',p.projectId)
        const psnap = await tx.get(pref)
        const members = (psnap.data() as any).members || []
        if(members.includes(userId)) return
        if(members.length>=4) throw new Error('Project full')
        
        // Get user reference (no read needed here, just the reference)
        const uref = doc(db,'users',userId)
        
        // Now perform all writes after all reads are complete
        tx.update(pref,{members:[...members,userId]})
        tx.update(uref,{projectId: p.projectId})
      })
    }catch(e:any){ alert(e.message||'Failed to join') }
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

  // Function to get department name from ID
  const getDepartmentName = (deptId: string | null | undefined): string => {
    if (!deptId) return "Unassigned";
    
    switch(deptId) {
      case 'technical': return "Technical";
      case 'development': return "Development";
      case 'events': return "Events";
      case 'social': return "Social Media";
      case 'content': return "Content";
      case 'design': return "Design";
      default: return deptId;
    }
  };
  
  return (
    <div className="min-h-screen p-8 container mx-auto">
      <div className="max-w-5xl mx-auto bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg border border-cyscom/10 
        animate-fadeIn relative overflow-hidden">
        {/* Cyber decoration */}
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyscom/10 rounded-full blur-3xl"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyscom/10 rounded-full blur-3xl"></div>
        
        <div className="relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <span className="flex w-8 h-8 mr-2 bg-cyscom/20 text-cyscom rounded-full items-center justify-center">
                2
              </span>
              Project Selection
            </h2>
            <Link href="/dashboard" className="text-cyscom hover:text-cyscom/80 transition-colors">
              Back to Dashboard
            </Link>
          </div>
          
          <div className="mb-6">
            <WorkflowSteps currentStep={userDepts && userDepts.length > 0 ? UserProgress.NEEDS_PROJECT : UserProgress.NEEDS_DEPARTMENTS} />
          </div>
          
          {/* User Guidance Box */}
          <div className="p-4 bg-black/40 rounded-lg border border-cyscom/20 backdrop-blur-md mb-6">
            <div className="flex items-start">
              <div className="bg-cyscom/20 rounded-full p-2 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyscom" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-cyscom font-medium">Project Selection Guide</h3>
                {userDepts && userDepts.length > 0 ? (
                  <ul className="mt-2 text-slate-300 text-sm space-y-1 list-disc pl-5">
                    <li>Projects shown are based on your selected departments</li>
                    <li>Click on a project name to view more details</li>
                    <li>Join a project that interests you (projects can have max 4 members)</li>
                    <li>You can leave a project to join another if needed</li>
                  </ul>
                ) : (
                  <div className="mt-2 text-yellow-400 text-sm">
                    You need to select departments first before you can view and join projects.
                  </div>
                )}
              </div>
            </div>
          </div>

          {projects.length === 0 && userDepts && userDepts.length > 0 && (
            <div className="p-8 bg-black/30 rounded-lg border border-cyscom/10 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-cyscom/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-slate-300 text-lg">No projects found for your departments.</p>
              <p className="text-slate-400 mt-2">Please contact an admin to create projects for your departments.</p>
            </div>
          )}
          
          {projects.length === 0 && (!userDepts || userDepts.length === 0) && (
            <div className="p-8 bg-black/30 rounded-lg border border-cyscom/10 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-yellow-400/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-white text-lg">Department Selection Required</p>
              <p className="text-slate-300 mt-2">Please select your departments first to view available projects.</p>
              <Link href="/departments" className="mt-5 inline-block px-6 py-2 bg-cyscom text-black rounded-md hover:bg-cyscom/90 transition-all transform hover:scale-105 duration-200">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Select Departments
                </span>
              </Link>
            </div>
          )}

          {projects.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {projects.map(p=> (
                <div key={p.projectId} className="p-5 rounded-lg bg-gradient-to-br from-black/40 to-black/30 border border-cyscom/10 hover:border-cyscom/30 transition-all duration-300 group">
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      <Link href={`/project/${p.projectId}`} className="text-white text-lg font-medium hover:text-cyscom transition-colors group-hover:text-cyscom">
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-block px-2 py-1 bg-cyscom/20 text-cyscom text-xs rounded border border-cyscom/20">
                          {getDepartmentName(p.department)}
                        </span>
                        <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded text-xs text-slate-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {p.members.length}/4
                          {p.members.length >= 4 && <span className="text-red-400 ml-1">Full</span>}
                        </div>
                      </div>
                      <p className="text-slate-300 text-sm mt-3 line-clamp-2">{p.description}</p>
                      
                      <div className="mt-4 flex items-center justify-between">
                        <Link href={`/project/${p.projectId}`} className="text-cyscom/90 text-xs hover:text-cyscom flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </Link>
                        
                        {p.members.includes(userId||'') ? (
                          <button 
                            onClick={()=>leave(p)} 
                            className="px-4 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Leave Project
                          </button>
                        ) : (
                          <button 
                            onClick={()=>join(p)} 
                            className={`px-4 py-1.5 rounded flex items-center ${
                              p.members.length >= 4 
                                ? 'bg-gray-600/20 text-gray-400 cursor-not-allowed' 
                                : 'bg-cyscom/20 text-cyscom border border-cyscom/30 hover:bg-cyscom/30 transition-colors'
                            }`} 
                            disabled={p.members.length >= 4}
                          >
                            {p.members.length >= 4 ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Full
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Join Project
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {projects.length > 0 && (
            <div className="mt-8 flex justify-between items-center">
              <Link href="/dashboard" className="px-4 py-2 rounded bg-black/30 text-white border border-white/10 hover:bg-black/40 transition-colors">
                Back to Dashboard
              </Link>
              <div className="text-slate-400 text-sm">
                {projects.length} project{projects.length !== 1 ? 's' : ''} available
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
