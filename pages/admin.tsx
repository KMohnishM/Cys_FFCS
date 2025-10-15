import React, { useEffect, useState } from 'react'
import { getAuthClient, getDbClient, getStorageClient } from '../lib/firebase'
import { collection, query, where, onSnapshot, doc, runTransaction, updateDoc, getDocs } from 'firebase/firestore'
import type { Contribution, User, Department } from '../types'
import AdminAnalytics from '../components/AdminAnalytics'
import { trackEvent } from '../lib/analytics'

export default function Admin() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [pending, setPending] = useState<Contribution[]>([])
  const [loadingIds, setLoadingIds] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [activeTab, setActiveTab] = useState<'analytics' | 'contributions' | 'users'>('analytics')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const auth = getAuthClient()
    const db = getDbClient()

    const unsubAuth = auth.onAuthStateChanged(async (u: any) => {
      if (!u) {
        setUserRole(null)
        return
      }
      // read role from users collection
      try {
        const { getDoc } = await import('firebase/firestore')
        const userRef = doc(db, 'users', u.uid)
        const s = await getDoc(userRef)
        const role = s.exists() ? ((s.data() as any).role ?? null) : null
        setUserRole(role)
        
        // Track admin login for analytics
        if (role === 'admin' || role === 'superadmin') {
          trackEvent('login', u.uid, { 
            metadata: { 
              role: role,
              isAdminPanel: true
            }
          });
        }
      } catch (e) {
        console.error('Failed to read user role', e)
        setUserRole(null)
      }
    })

    return () => unsubAuth()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const db = getDbClient()
    const col = collection(db, 'contributions')
    const q = query(col, where('status', '==', 'pending'))
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
          status: data.status,
          pointsAwarded: data.pointsAwarded,
        })
      })
      setPending(list)
    })
    return () => unsub()
  }, [])
  
  // Load users for department management
  useEffect(() => {
    if (typeof window === 'undefined' || userRole !== 'admin' && userRole !== 'superadmin') return
    const db = getDbClient()
    const col = collection(db, 'users')
    const q = query(col, where('role', '==', 'member'))
    const unsub = onSnapshot(q, (snap) => {
      const list: User[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        list.push({
          userId: d.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'member',
          departments: data.departments || [],
          totalPoints: data.totalPoints || 0,
          projectId: data.projectId || null,
        })
      })
      setUsers(list)
    })
    return () => unsub()
  }, [userRole])
  
  // Load departments
  useEffect(() => {
    if (typeof window === 'undefined' || userRole !== 'admin' && userRole !== 'superadmin') return
    const db = getDbClient()
    const col = collection(db, 'departments')
    const q = query(col)
    const unsub = onSnapshot(q, (snap) => {
      const list: Department[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        list.push({
          deptId: d.id,
          name: data.name,
          capacity: data.capacity,
          filledCount: data.filledCount || 0
        })
      })
      setDepartments(list)
    })
    return () => unsub()
  }, [userRole])

  const setLoading = (id: string, v: boolean) => {
    setLoadingIds((prev) => (v ? [...prev, id] : prev.filter((x) => x !== id)))
  }
  
  const updateUserDepartments = async (userId: string, departments: string[]) => {
    if (departments.length > 2) {
      alert('A user can only be in up to 2 departments')
      return
    }
    
    setLoading(userId, true)
    const db = getDbClient()
    
    try {
      await runTransaction(db, async (tx) => {
        // First, read all existing departments for the user
        const userRef = doc(db, 'users', userId)
        const userSnap = await tx.get(userRef)
        
        if (!userSnap.exists()) {
          throw new Error('User not found')
        }
        
        const userData = userSnap.data()
        const oldDepts = userData.departments || []
        
        // For departments that are being removed, decrement the filledCount
        for (const oldDeptId of oldDepts) {
          if (!departments.includes(oldDeptId)) {
            const deptRef = doc(db, 'departments', oldDeptId)
            const deptSnap = await tx.get(deptRef)
            
            if (deptSnap.exists()) {
              const deptData = deptSnap.data()
              const currentCount = deptData.filledCount || 0
              tx.update(deptRef, { filledCount: Math.max(0, currentCount - 1) })
            }
          }
        }
        
        // For departments that are being added, increment the filledCount
        for (const newDeptId of departments) {
          if (!oldDepts.includes(newDeptId)) {
            const deptRef = doc(db, 'departments', newDeptId)
            const deptSnap = await tx.get(deptRef)
            
            if (deptSnap.exists()) {
              const deptData = deptSnap.data()
              const currentCount = deptData.filledCount || 0
              tx.update(deptRef, { filledCount: currentCount + 1 })
            }
          }
        }
        
        // Update the user's departments
        tx.update(userRef, { departments })
      })
      
      alert('User departments updated successfully')
    } catch (e) {
      console.error('Update departments failed', e)
      alert(`Failed to update departments: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(userId, false)
    }
  }
  
  const resetUserDepartments = async (userId: string) => {
    setLoading(userId, true)
    const db = getDbClient()
    
    try {
      await runTransaction(db, async (tx) => {
        // First, read the user document
        const userRef = doc(db, 'users', userId)
        const userSnap = await tx.get(userRef)
        
        if (!userSnap.exists()) {
          throw new Error('User not found')
        }
        
        const userData = userSnap.data()
        const oldDepts = userData.departments || []
        
        // For each department, decrement the filledCount
        for (const oldDeptId of oldDepts) {
          const deptRef = doc(db, 'departments', oldDeptId)
          const deptSnap = await tx.get(deptRef)
          
          if (deptSnap.exists()) {
            const deptData = deptSnap.data()
            const currentCount = deptData.filledCount || 0
            tx.update(deptRef, { filledCount: Math.max(0, currentCount - 1) })
          }
        }
        
        // Reset the user's departments
        tx.update(userRef, { departments: [] })
      })
      
      alert('User departments reset successfully')
    } catch (e) {
      console.error('Reset departments failed', e)
      alert(`Failed to reset departments: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(userId, false)
    }
  }

  const approve = async (contribId: string, points: number) => {
    const db = getDbClient()
    const contribRef = doc(db, 'contributions', contribId)
    setLoading(contribId, true)
    try {
      const auth = getAuthClient()
      const current = auth.currentUser
      await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(contribRef)
        if (!cSnap.exists()) throw new Error('Contribution not found')
        const c = cSnap.data() as any
        if (c.status !== 'pending') throw new Error('Contribution already processed')

        const userRef = doc(db, 'users', c.userId)
        const uSnap = await tx.get(userRef)
        if (!uSnap.exists()) throw new Error('User not found')
        const u = uSnap.data() as any
        const oldPoints = u.totalPoints ?? 0
        const newPoints = oldPoints + (points || 0)

        tx.update(contribRef, { status: 'verified', pointsAwarded: points || 0, verifiedBy: current?.uid ?? null, verifiedAt: new Date() })
        tx.update(userRef, { totalPoints: newPoints })
      })
    } catch (e) {
      console.error('Approve failed', e)
      alert('Failed to approve')
    } finally {
      setLoading(contribId, false)
    }
  }

  const reject = async (contribId: string) => {
    const db = getDbClient()
    const contribRef = doc(db, 'contributions', contribId)
    setLoading(contribId, true)
    try {
      // delete image from storage if present
      const cSnap = await (await import('firebase/firestore')).getDoc(contribRef)
      if (cSnap.exists()){
        const data = cSnap.data() as any
        if (data.imageUrl){
          try{
            const storage = getStorageClient()
            const { ref, deleteObject } = await import('firebase/storage')
            const url = data.imageUrl as string
            // try to extract path from url; best-effort: use refFromURL when available
            const objRef = ref(storage, url)
            await deleteObject(objRef)
          }catch(err){
            // if deletion fails, ignore
            console.warn('Failed to delete storage object', err)
          }
        }
      }
      await updateDoc(contribRef, { status: 'rejected' })
    } catch (e) {
      console.error('Reject failed', e)
      alert('Failed to reject')
    } finally {
      setLoading(contribId, false)
    }
  }

  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return (
      <div className="min-h-screen p-8 container">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
        <p className="mt-2 text-slate-300">You do not have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 container mx-auto">
      <div className="max-w-4xl mx-auto">
        {/* Admin Tools Section */}
        {userRole === 'superadmin' && (
          <div className="mb-6 bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
            <h2 className="text-2xl font-semibold text-white">Admin Tools</h2>
            <p className="text-slate-300 mt-2">Utilities for database management (superadmin only).</p>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <h3 className="text-lg font-medium text-cyscom mb-2">Update Departments</h3>
                <p className="text-sm text-slate-300 mb-4">Reset and create club departments with capacity limits</p>
                <button 
                  id="update-departments-btn" 
                  className="w-full px-4 py-2 bg-cyscom text-black rounded-lg hover:bg-cyscom/90 transition-colors"
                >
                  Run Update
                </button>
              </div>
              
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <h3 className="text-lg font-medium text-cyscom mb-2">Add Projects</h3>
                <p className="text-sm text-slate-300 mb-4">Add sample projects for each department</p>
                <button 
                  id="add-projects-btn"
                  className="w-full px-4 py-2 bg-cyscom text-black rounded-lg hover:bg-cyscom/90 transition-colors"
                >
                  Add Projects
                </button>
              </div>
              
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <h3 className="text-lg font-medium text-cyscom mb-2">Setup Admin Users</h3>
                <p className="text-sm text-slate-300 mb-4">Create/update admin and superadmin users</p>
                <button 
                  id="setup-admin-btn"
                  className="w-full px-4 py-2 bg-cyscom text-black rounded-lg hover:bg-cyscom/90 transition-colors"
                >
                  Setup Admins
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="mb-4 flex border-b border-slate-700">
          <button 
            onClick={() => setActiveTab('analytics')} 
            className={`px-4 py-2 ${activeTab === 'analytics' ? 'text-cyscom border-b-2 border-cyscom' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Analytics Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('contributions')} 
            className={`px-4 py-2 ${activeTab === 'contributions' ? 'text-cyscom border-b-2 border-cyscom' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Verify Contributions
          </button>
          <button 
            onClick={() => setActiveTab('users')} 
            className={`px-4 py-2 ${activeTab === 'users' ? 'text-cyscom border-b-2 border-cyscom' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Manage Users
          </button>
        </div>
        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
            <h2 className="text-2xl font-semibold text-white">Analytics Dashboard</h2>
            <p className="text-slate-300 mt-2">Real-time analytics and statistics about the FFCS portal.</p>
            
            <div className="mt-6">
              <AdminAnalytics />
            </div>
          </div>
        )}
      
        {/* Contributions Tab */}
        {activeTab === 'contributions' && (
          <div className="bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
            <h2 className="text-2xl font-semibold text-white">Verify Contributions</h2>
            <p className="text-slate-300 mt-2">Approve or reject pending contributions and assign points.</p>

            <div className="mt-6 space-y-4">
              {pending.length === 0 && <p className="text-slate-300">No pending contributions.</p>}
              {pending.map((c) => (
                <div key={c.contribId} className="p-3 rounded bg-black/30">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-slate-200">{c.text}</p>
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt="contrib" className="mt-2 max-h-48 rounded" />
                      )}
                    </div>
                    <div className="w-40 text-right">
                      <label className="text-sm text-slate-300 block">Points</label>
                      <input id={`points-${c.contribId}`} type="number" defaultValue={5} className="w-full mt-1 p-2 rounded bg-black/20 text-white" />
                      <div className="mt-3 flex gap-2 justify-end">
                        <button onClick={async ()=>{ const val = (document.getElementById(`points-${c.contribId}`) as HTMLInputElement).value; await approve(c.contribId, Number(val)) }} disabled={loadingIds.includes(c.contribId)} className="px-3 py-1 rounded bg-green-600 text-white">{loadingIds.includes(c.contribId)?'Processing':'Approve'}</button>
                        <button onClick={async ()=> await reject(c.contribId)} disabled={loadingIds.includes(c.contribId)} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
            <h2 className="text-2xl font-semibold text-white">Manage User Departments</h2>
            <p className="text-slate-300 mt-2">Assign users to departments or reset their selections.</p>
            
            <div className="mt-6 space-y-6">
              {users.length === 0 && <p className="text-slate-300">No users found.</p>}
              {users.map((user) => (
                <div key={user.userId} className="p-4 rounded bg-black/30">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-white">{user.name}</h4>
                      <p className="text-sm text-slate-400">{user.email}</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Points: {user.totalPoints || 0}
                        {user.projectId && <span className="ml-2">| Project ID: {user.projectId}</span>}
                      </p>
                      
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-slate-300 mb-2">Current Departments:</h5>
                        {user.departments && user.departments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {user.departments.map(deptId => {
                              const dept = departments.find(d => d.deptId === deptId);
                              return (
                                <span key={deptId} className="px-2 py-1 bg-slate-700 text-xs rounded">
                                  {dept ? dept.name : deptId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No departments selected</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="w-full md:w-64">
                      <div className="bg-black/20 p-3 rounded">
                        <h5 className="text-sm font-medium text-slate-300 mb-2">Update Departments:</h5>
                        <div className="max-h-32 overflow-y-auto space-y-2">
                          {departments.map(dept => (
                            <div key={dept.deptId} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`dept-${user.userId}-${dept.deptId}`}
                                checked={user.departments?.includes(dept.deptId) || false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const updatedDepts = checked
                                    ? [...(user.departments || []), dept.deptId]
                                    : (user.departments || []).filter(d => d !== dept.deptId);
                                  
                                  // Don't actually update yet, just handle the checkbox UI
                                  // The user will need to click "Update" to apply changes
                                  e.target.checked = checked;
                                }}
                                className="mr-2"
                              />
                              <label htmlFor={`dept-${user.userId}-${dept.deptId}`} className="text-sm text-slate-300">
                                {dept.name} ({dept.filledCount}/{dept.capacity})
                              </label>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              const selectedDepts = departments
                                .filter(dept => (document.getElementById(`dept-${user.userId}-${dept.deptId}`) as HTMLInputElement)?.checked)
                                .map(dept => dept.deptId);
                              updateUserDepartments(user.userId, selectedDepts);
                            }}
                            disabled={loadingIds.includes(user.userId)}
                            className="flex-1 px-3 py-1 rounded bg-cyscom text-black text-sm"
                          >
                            {loadingIds.includes(user.userId) ? 'Processing...' : 'Update'}
                          </button>
                          <button
                            onClick={() => resetUserDepartments(user.userId)}
                            disabled={loadingIds.includes(user.userId) || !(user.departments && user.departments.length > 0)}
                            className="flex-1 px-3 py-1 rounded bg-red-600 text-white text-sm"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Include the admin tools script */}
      <script src="/js/admin-tools.js" async></script>
    </div>
  )
}
