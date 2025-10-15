import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import type { Department } from '../types'
import { UserProgress } from '../lib/useAuthGuard'
import WorkflowSteps from '../components/WorkflowSteps'
import Navigation from '../components/Navigation'

export default function Departments(){
  const [departments, setDepartments] = useState<Department[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(()=>{
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const db = getDbClient()
    const unsub = auth.onAuthStateChanged(async (u: any | null)=>{
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
    const db = getDbClient()
    const col = collection(db,'departments')
    const q = query(col)
    const unsub = onSnapshot(q,(snap)=>{
      const list: Department[] = []
      snap.forEach(d=>{
        const data = d.data() as any
        list.push({deptId:d.id,name:data.name,capacity:data.capacity,filledCount:data.filledCount||0})
      })
      setDepartments(list)
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
        if(data.departments && data.departments.length>0){
          setSelected(data.departments)
          setLocked(true)
        }
      }
    })()
  },[userId])

  const toggle = (id:string)=>{
    if(locked) return
    setSelected(prev=>{
      if(prev.includes(id)) return prev.filter(x=>x!==id)
      if(prev.length>=1) return prev
      return [...prev,id]
    })
  }

  const confirm = async ()=>{
    if(!userId) return alert('Sign in required')
    if(selected.length!==1) return alert('Choose exactly 1 department')
    setLoading(true)
    const db = getDbClient()
    try{
      await runTransaction(db, async(tx)=>{
        // First, perform all reads
        const departmentDocs = [];
        for(const id of selected){
          const dref = doc(db,'departments',id)
          const dsnap = await tx.get(dref)
          if(!dsnap.exists()) throw new Error('Department missing')
          const filled = (dsnap.data() as any).filledCount||0
          const cap = (dsnap.data() as any).capacity||0
          if(filled+1>cap) throw new Error(`Department ${id} full`)
          departmentDocs.push({ ref: dref, filled });
        }
        
        // Read the user document
        const uref = doc(db,'users',userId)
        
        // Now perform all writes after all reads are complete
        for(const dept of departmentDocs){
          tx.update(dept.ref, { filledCount: dept.filled + 1 });
        }
        tx.update(uref, { departments: selected });
      })
      setLocked(true)
    }catch(e:any){
      console.error(e)
      alert(e.message||'Failed')
    }finally{setLoading(false)}
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
                Department
              </h1>
              <p className="text-xl md:text-2xl text-cyberblue-400 font-light">
                Select Your Department
              </p>
            </div>

            {/* Department Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {departments.map(d => (
                <div 
                  key={d.deptId} 
                  onClick={() => {
                    if (!locked && !(d.capacity > 0 && d.filledCount >= d.capacity && !selected.includes(d.deptId))) {
                      toggle(d.deptId)
                    }
                  }}
                  className={`group relative p-8 bg-black/40 backdrop-blur-xl border rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                    selected.includes(d.deptId) 
                      ? 'border-cyscom shadow-2xl shadow-cyscom/25' 
                      : 'border-cyberblue-900/50 hover:border-cyberblue-700/70'
                  } ${(!selected.includes(d.deptId) && d.capacity > 0 && d.filledCount >= d.capacity) 
                    ? 'opacity-60 cursor-not-allowed' 
                    : ''}`}
                >
                  {selected.includes(d.deptId) && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-cyscom rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">{d.name}</h3>
                    
                    <div className="text-cyberblue-300/70 mb-4">
                      {d.capacity > 0 && d.filledCount >= d.capacity ? (
                        <span className="text-red-400 font-semibold">FULL</span>
                      ) : (
                        <span>{d.filledCount}/{d.capacity || '∞'} members</span>
                      )}
                    </div>
                    
                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                      selected.includes(d.deptId) 
                        ? 'bg-cyscom text-black'
                        : d.capacity > 0 && d.filledCount >= d.capacity
                          ? 'bg-red-900/50 text-red-400 border border-red-700/50'
                          : 'bg-cyberblue-950/50 text-cyberblue-400 border border-cyberblue-700/50'
                    }`}>
                      {selected.includes(d.deptId) ? 'Selected' : 
                      d.capacity > 0 && d.filledCount >= d.capacity ? 'Unavailable' : 'Available'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
              <Link 
                href="/dashboard" 
                className="px-8 py-4 border border-cyberblue-700/50 text-cyberblue-400 font-semibold rounded-xl hover:border-cyberblue-500 hover:bg-cyberblue-950/20 transition-all duration-300 backdrop-blur-sm"
              >
                Back to Dashboard
              </Link>
              
              <button 
                onClick={confirm} 
                disabled={locked || loading || selected.length !== 1} 
                className="group relative px-8 py-4 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black font-semibold rounded-xl hover:shadow-2xl hover:shadow-cyberblue-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <span className="relative z-10">
                  {loading ? 'Processing...' : locked ? 'Selection Confirmed' : 'Confirm Selection'}
                </span>
                {!loading && !locked && selected.length === 1 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </button>
            </div>

            {/* Status Messages */}
            {locked && (
              <div className="text-center mt-6">
                <div className="inline-flex items-center px-4 py-2 bg-yellow-900/20 border border-yellow-700/50 text-yellow-400 rounded-full text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Selection is locked. Contact admin to change.
                </div>
              </div>
            )}
            
            {!locked && selected.length !== 1 && (
              <div className="text-center mt-6">
                <div className="inline-flex items-center px-4 py-2 bg-yellow-900/20 border border-yellow-700/50 text-yellow-400 rounded-full text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Please select exactly 1 department
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
