import React, { useEffect, useState } from 'react'
import { getAuthClient, getDbClient, signOut } from '../lib/firebase'
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import type { Department, Project, User } from '../types'

export default function SuperAdmin(){
  const [userRole, setUserRole] = useState<string|null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(()=>{
    if(typeof window==='undefined') return
    const auth = getAuthClient()
    const db = getDbClient()
    const unsub = auth.onAuthStateChanged(async (u:any)=>{
      if(!u) return
      const { doc, getDoc } = await import('firebase/firestore')
      const s = await getDoc(doc(db,'users',u.uid))
      setUserRole(s.exists()? (s.data() as any).role : null)
    })
    return ()=>unsub()
  },[])

  useEffect(()=>{
    const db = getDbClient()
    const col = collection(db,'departments')
    const q = query(col)
    const unsub = onSnapshot(q,(snap)=>{
      const list: Department[] = []
      snap.forEach(d=> list.push({deptId:d.id, ...(d.data() as any)}))
      setDepartments(list)
    })
    return ()=>unsub()
  },[])

  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptCapacity, setNewDeptCapacity] = useState(10)
  const createDept = async ()=>{
    const db = getDbClient()
    const id = newDeptName.toLowerCase().replace(/\s+/g,'-')
    await setDoc(doc(db,'departments',id),{name:newDeptName,capacity:newDeptCapacity,filledCount:0})
    setNewDeptName('')
  }
  const deleteDept = async (id:string)=>{
    const db = getDbClient()
    await deleteDoc(doc(db,'departments',id))
  }

  useEffect(()=>{
    const db = getDbClient()
    const col = collection(db,'projects')
    const q = query(col)
    const unsub = onSnapshot(q,(snap)=>{
      const list: Project[] = []
      snap.forEach(d=> list.push({projectId:d.id, ...(d.data() as any)}))
      setProjects(list)
    })
    return ()=>unsub()
  },[])

  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const createProject = async ()=>{
    const db = getDbClient()
    const id = newProjectName.toLowerCase().replace(/\s+/g,'-')
    await setDoc(doc(db,'projects',id),{name:newProjectName,description:newProjectDesc,members:[]})
    setNewProjectName('')
    setNewProjectDesc('')
  }
  const deleteProject = async (id:string)=>{
    const db = getDbClient()
    await deleteDoc(doc(db,'projects',id))
  }

  useEffect(()=>{
    const db = getDbClient()
    const col = collection(db,'users')
    const q = query(col)
    const unsub = onSnapshot(q,(snap)=>{
      const list: User[] = []
      snap.forEach(d=> list.push({userId:d.id, ...(d.data() as any)}))
      setUsers(list)
    })
    return ()=>unsub()
  },[])

  if(userRole !== 'superadmin'){
    return <div className="min-h-screen p-8 container"><h2 className="text-2xl">Super Admin</h2><p className="text-slate-300 mt-2">Access restricted</p></div>
  }

  return (
    <div className="min-h-screen p-8 container mx-auto">
      <div className="max-w-6xl mx-auto bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
        {/* Header with Sign Out */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl text-white font-semibold">Super Admin</h2>
          <button 
            onClick={async () => {
              try {
                await signOut()
                window.location.href = '/'
              } catch (e) {
                console.error('Sign out failed', e)
                alert('Failed to sign out')
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-white font-medium">Departments</h3>
            <ul className="mt-2 text-slate-300">
              {departments.map(d=> <li key={d.deptId}>{d.name} — {d.filledCount}/{d.capacity} <button onClick={()=>deleteDept(d.deptId)} className="ml-2 text-red-400">Delete</button></li>)}
            </ul>
            <div className="mt-4">
              <input value={newDeptName} onChange={(e)=>setNewDeptName(e.target.value)} placeholder="Department name" className="p-2 rounded bg-black/20 text-white w-full" />
              <input value={String(newDeptCapacity)} onChange={(e)=>setNewDeptCapacity(Number(e.target.value))} type="number" className="p-2 rounded bg-black/20 text-white w-full mt-2" />
              <button onClick={createDept} className="mt-2 px-3 py-1 rounded bg-cyscom text-black">Create Dept</button>
            </div>
          </div>
          <div>
            <h3 className="text-white font-medium">Projects</h3>
            <ul className="mt-2 text-slate-300">
              {projects.map(p=> <li key={p.projectId}>{p.name} — members: {(p as any).members?.length||0} <button onClick={()=>deleteProject(p.projectId)} className="ml-2 text-red-400">Delete</button></li>)}
            </ul>
            <div className="mt-4">
              <input value={newProjectName} onChange={(e)=>setNewProjectName(e.target.value)} placeholder="Project name" className="p-2 rounded bg-black/20 text-white w-full" />
              <input value={newProjectDesc} onChange={(e)=>setNewProjectDesc(e.target.value)} placeholder="Short description" className="p-2 rounded bg-black/20 text-white w-full mt-2" />
              <button onClick={createProject} className="mt-2 px-3 py-1 rounded bg-cyscom text-black">Create Project</button>
            </div>
          </div>
          <div>
            <h3 className="text-white font-medium">Users</h3>
            <ul className="mt-2 text-slate-300">
              {users.map(u=> <li key={u.userId}>{u.name} — {u.email} — {u.role}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
