import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import type { Project } from '../types'
import { UserProgress } from '../lib/useAuthGuard'
import WorkflowSteps from '../components/WorkflowSteps'
import Navigation from '../components/Navigation'

export default function Projects(){
  const [projects, setProjects] = useState<Project[]>([])
  const [userId, setUserId] = useState<string|null>(null)
  const [userDepts, setUserDepts] = useState<string[]|null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

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
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-cyberblue-300 to-cyscom bg-clip-text text-transparent mb-4">
                Projects
              </h1>
              <p className="text-xl md:text-2xl text-cyberblue-400 font-light">
                Join a Project Team
              </p>
            </div>

            {/* No Departments Selected */}
            {(!userDepts || userDepts.length === 0) && (
              <div className="max-w-2xl mx-auto text-center">
                <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8">
                  <div className="text-cyberblue-300/70 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-yellow-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Department Selection Required
                  </div>
                  <p className="text-cyberblue-300/70 mb-6">
                    Please select your departments first to view available projects.
                  </p>
                  <Link 
                    href="/departments" 
                    className="group relative px-8 py-4 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black font-semibold rounded-xl hover:shadow-2xl hover:shadow-cyberblue-500/25 transition-all duration-300 transform hover:scale-105"
                  >
                    <span className="relative z-10">Select Departments</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </Link>
                </div>
              </div>
            )}

            {/* No Projects Available */}
            {projects.length === 0 && userDepts && userDepts.length > 0 && (
              <div className="max-w-2xl mx-auto text-center">
                <div className="bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-8">
                  <div className="text-cyberblue-300/70 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyscom/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    No Projects Available
                  </div>
                  <p className="text-cyberblue-300/70">
                    No projects found for your departments. Please contact an admin to create projects.
                  </p>
                </div>
              </div>
            )}

            {/* Projects Grid */}
            {projects.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  {projects.map(p => (
                    <div 
                      key={p.projectId} 
                      className="group relative bg-black/40 backdrop-blur-xl border border-cyberblue-900/50 rounded-2xl p-6 hover:border-cyberblue-700/70 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="mb-4">
                        <Link 
                          href={`/project/${p.projectId}`} 
                          className="text-xl font-bold text-white hover:text-cyscom transition-colors group-hover:text-cyscom"
                        >
                          {p.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center px-3 py-1 bg-cyscom/20 text-cyscom text-xs rounded-full border border-cyscom/30">
                            {getDepartmentName(p.department)}
                          </span>
                        </div>
                      </div>

                      <p className="text-cyberblue-300/70 text-sm mb-4 line-clamp-3">{p.description}</p>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1 text-cyberblue-300/70 text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {p.members.length}/4 members
                        </div>
                        <Link 
                          href={`/project/${p.projectId}`} 
                          className="text-cyscom/90 text-xs hover:text-cyscom flex items-center"
                        >
                          View Details
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>

                      <div className="flex gap-2">
                        {p.members.includes(userId || '') ? (
                          <button 
                            onClick={() => leave(p)} 
                            className="flex-1 px-4 py-2 bg-red-900/50 text-red-400 border border-red-700/50 rounded-lg hover:bg-red-900/70 transition-colors text-sm font-semibold"
                          >
                            Leave Project
                          </button>
                        ) : (
                          <button 
                            onClick={() => join(p)} 
                            disabled={p.members.length >= 4}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                              p.members.length >= 4 
                                ? 'bg-gray-800/50 text-gray-500 border border-gray-700/50 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black hover:shadow-lg hover:shadow-cyberblue-500/25 transform hover:scale-105'
                            }`}
                          >
                            {p.members.length >= 4 ? 'Project Full' : 'Join Project'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link 
                    href="/dashboard" 
                    className="px-8 py-4 border border-cyberblue-700/50 text-cyberblue-400 font-semibold rounded-xl hover:border-cyberblue-500 hover:bg-cyberblue-950/20 transition-all duration-300 backdrop-blur-sm"
                  >
                    Back to Dashboard
                  </Link>
                  <div className="text-cyberblue-300/70 text-sm">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} available
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
