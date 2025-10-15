import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthClient, getDbClient } from '../lib/firebase'
import { collection, query, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import type { Department } from '../types'
import { UserProgress } from '../lib/useAuthGuard'
import WorkflowSteps from '../components/WorkflowSteps'

export default function Departments(){
  const [departments, setDepartments] = useState<Department[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const unsub = auth.onAuthStateChanged((u: any | null)=>{
      setUserId(u?.uid ?? null)
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
      if(prev.length>=2) return prev
      return [...prev,id]
    })
  }

  const confirm = async ()=>{
    if(!userId) return alert('Sign in required')
    if(selected.length!==2) return alert('Choose exactly 2 departments')
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
    <div className="min-h-screen p-8 container mx-auto">
      <div className="max-w-4xl mx-auto bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg border border-cyscom/10 
        animate-fadeIn relative overflow-hidden">
        {/* Cyber decoration */}
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyscom/10 rounded-full blur-3xl"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyscom/10 rounded-full blur-3xl"></div>
        
        <div className="relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <span className="flex w-8 h-8 mr-2 bg-cyscom/20 text-cyscom rounded-full items-center justify-center">
                1
              </span>
              Department Selection
            </h2>
            <Link href="/dashboard" className="text-cyscom hover:text-cyscom/80 transition-colors">
              Back to Dashboard
            </Link>
          </div>
          
          <div className="mb-6">
            <WorkflowSteps currentStep={UserProgress.NEEDS_DEPARTMENTS} />
          </div>

          <div className="p-4 bg-black/40 rounded-lg border border-cyscom/20 backdrop-blur-md mb-6">
            <div className="flex items-start">
              <div className="bg-cyscom/20 rounded-full p-2 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyscom" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-cyscom font-medium">Department Selection Guide</h3>
                <ul className="mt-2 text-slate-300 text-sm space-y-1 list-disc pl-5">
                  <li>You must choose exactly <span className="text-white font-medium">2 departments</span></li>
                  <li>Your selection will determine which projects you can join</li>
                  <li>Selections are final and can only be changed by admins</li>
                  <li>Some departments may be full - these cannot be selected</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map(d=> (
              <div 
                key={d.deptId} 
                onClick={() => {
                  if (!locked && !(d.capacity > 0 && d.filledCount >= d.capacity && !selected.includes(d.deptId))) {
                    toggle(d.deptId)
                  }
                }}
                className={`p-4 rounded group transition-all duration-300 cursor-pointer relative
                  ${selected.includes(d.deptId) 
                    ? 'bg-gradient-to-r from-black/40 to-cyscom/20 border border-cyscom'
                    : 'bg-black/30 hover:bg-black/40 border border-transparent'}
                  ${(!selected.includes(d.deptId) && d.capacity > 0 && d.filledCount >= d.capacity) 
                    ? 'opacity-60 cursor-not-allowed' 
                    : ''}
                `}
              >
                {selected.includes(d.deptId) && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyscom rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-medium text-lg flex items-center">
                      {d.name}
                    </h4>
                    <div className="text-sm text-slate-300 mt-2">
                      <div className="w-full bg-black/50 rounded-full h-1.5 relative">
                        <div 
                          className="absolute top-0 left-0 h-1.5 rounded-full bg-cyscom"
                          style={{ width: d.capacity ? `${(d.filledCount / d.capacity) * 100}%` : '0%' }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span>
                          {d.capacity > 0 && d.filledCount >= d.capacity ? (
                            <span className="text-red-400">Full</span>
                          ) : (
                            <span>{d.filledCount}/{d.capacity || '∞'} seats</span>
                          )}
                        </span>
                        {d.capacity > 0 && (
                          <span className="text-xs text-slate-400">
                            {Math.round((d.filledCount / d.capacity) * 100)}% filled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-sm border ${
                    selected.includes(d.deptId) 
                      ? 'border-red-500/30 text-red-400'
                      : d.capacity > 0 && d.filledCount >= d.capacity
                        ? 'border-gray-500/30 text-gray-400'
                        : 'border-cyscom/30 text-cyscom group-hover:border-cyscom/60 transition-colors'
                  }`}>
                    {selected.includes(d.deptId) ? 'Selected' : 
                    d.capacity > 0 && d.filledCount >= d.capacity ? 'Full' : 'Select'}
                  </div>
                </div>
                
                {selected.includes(d.deptId) && (
                  <div className="mt-3 text-xs text-red-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Click to deselect
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Link href="/dashboard" className="px-4 py-2 rounded bg-black/30 text-white border border-white/10 hover:bg-black/40 transition-colors">
              Back to Dashboard
            </Link>
            <div>
              <button 
                onClick={confirm} 
                disabled={locked || loading || selected.length !== 2} 
                className="px-6 py-2 rounded relative overflow-hidden group
                  transition-all duration-300 transform
                  disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed
                  bg-cyscom hover:bg-cyscom/90 text-black"
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : locked ? (
                  <span>Selections Confirmed</span>
                ) : (
                  <span>Confirm Selection{selected.length !== 2 ? ` (${selected.length}/2)` : ''}</span>
                )}
                {!loading && !locked && selected.length === 2 && (
                  <span className="absolute right-0 top-0 h-full w-10 bg-white/10 transform -skew-x-20 transition-all 
                    duration-700 -translate-x-20 group-hover:translate-x-40"></span>
                )}
              </button>
              
              {locked && (
                <div className="mt-3 flex items-center text-sm text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Your selections are locked. Contact an admin to change.
                </div>
              )}
              
              {!locked && selected.length > 0 && selected.length < 2 && (
                <div className="mt-3 text-sm text-yellow-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Please select {2 - selected.length} more department{selected.length === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
