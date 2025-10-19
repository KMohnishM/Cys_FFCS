import React, { useEffect, useState } from 'react'
import { getAuthClient, getDbClient, getStorageClient, signOut } from '../lib/firebase'
import { collection, query, where, onSnapshot, doc, runTransaction, updateDoc, getDocs, setDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore'
import { ref } from 'firebase/storage'
import type { Contribution, User, Department, Project } from '../types'
import AdminAnalytics from '../components/AdminAnalytics'
import ActivityLog from '../components/ActivityLog'
import { trackEvent } from '../lib/analytics'

export default function Admin() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribFilter, setContribFilter] = useState<'pending'|'all'|'verified'|'rejected'>('pending')
  const [loadingIds, setLoadingIds] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTab, setActiveTab] = useState<'analytics' | 'contributions' | 'users' | 'projects' | 'join-requests'>('analytics')
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerZoom, setViewerZoom] = useState<number>(1)
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [userDepartmentSelections, setUserDepartmentSelections] = useState<Record<string, string[]>>({})

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
  }, [contribFilter])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const db = getDbClient()
    const col = collection(db, 'contributions')
    const q = contribFilter === 'all' ? query(col) : query(col, where('status', '==', contribFilter))

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
          status: data.status,
          pointsAwarded: data.pointsAwarded,
          createdAt,
          verifiedBy: data.verifiedBy,
          verifiedAt: data.verifiedAt,
        })
      })

      list.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })

      setContributions(list)
    }, (err) => {
      console.error('Failed to load contributions for admin', err)
      setContributions([])
    })

    return () => unsub()
  }, [contribFilter])
  
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
      
      // Initialize department selections state
      const selections: Record<string, string[]> = {}
      list.forEach(user => {
        selections[user.userId] = user.departments || []
      })
      setUserDepartmentSelections(selections)
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
  
  // Load projects
  useEffect(() => {
    if (typeof window === 'undefined' || userRole !== 'admin' && userRole !== 'superadmin') return
    const db = getDbClient()
    const col = collection(db, 'projects')
    const q = query(col)
    const unsub = onSnapshot(q, (snap) => {
      const list: Project[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        list.push({
          projectId: d.id,
          name: data.name,
          description: data.description,
          members: data.members || [],
          department: data.department || null
        })
      })
      setProjects(list)
    })
    return () => unsub()
  }, [userRole])

  // Load join requests
  useEffect(() => {
    if (typeof window === 'undefined' || userRole !== 'admin' && userRole !== 'superadmin') return
    const db = getDbClient()
    const col = collection(db, 'joinRequests')
    const q = query(col, where('status', '==', 'pending'))
    const unsub = onSnapshot(q, async (snap) => {
      const list: any[] = []
      for (const d of snap.docs) {
        const data = d.data() as any
        // Get user and project details
        const userSnap = await getDoc(doc(db, 'users', data.userId))
        const projectSnap = await getDoc(doc(db, 'projects', data.projectId))
        if (userSnap.exists() && projectSnap.exists()) {
          list.push({
            requestId: d.id,
            ...data,
            user: { userId: userSnap.id, ...userSnap.data() },
            project: { projectId: projectSnap.id, ...projectSnap.data() }
          })
        }
      }
      setJoinRequests(list)
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
      
      // Update local state to reflect the changes
      setUsers(prev => prev.map(u => 
        u.userId === userId ? { ...u, departments: departments } : u
      ))
      setUserDepartmentSelections(prev => ({
        ...prev,
        [userId]: departments
      }))
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
      
      // Update local state to reflect the reset
      setUsers(prev => prev.map(u => 
        u.userId === userId ? { ...u, departments: [] } : u
      ))
      setUserDepartmentSelections(prev => ({
        ...prev,
        [userId]: []
      }))
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
      let logContext: { userId: string; projectId?: string | null } | null = null
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

        logContext = { userId: c.userId, projectId: c.projectId }
      })

      if (logContext !== null) {
        const { userId: reviewedUserId, projectId } = logContext
        void trackEvent('contribution_approve', {
          metadata: {
            contributionId: contribId,
            reviewedUserId,
            projectId: projectId ?? 'general',
            pointsAwarded: points || 0,
          },
        })
      }
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
      const auth = getAuthClient()
      const current = auth.currentUser
      let logContext: { userId?: string; projectId?: string | null } = {}
      // delete image from storage if present
      const cSnap = await (await import('firebase/firestore')).getDoc(contribRef)
      if (cSnap.exists()){
        const data = cSnap.data() as any
        logContext = { userId: data.userId, projectId: data.projectId }
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
      await updateDoc(contribRef, { status: 'rejected', verifiedBy: current?.uid ?? null, verifiedAt: new Date() })

      if (logContext.userId) {
        const { userId: reviewedUserId, projectId } = logContext
        void trackEvent('contribution_reject', {
          metadata: {
            contributionId: contribId,
            reviewedUserId,
            projectId: projectId ?? 'general',
          },
        })
      }
    } catch (e) {
      console.error('Reject failed', e)
      alert('Failed to reject')
    } finally {
      setLoading(contribId, false)
    }
  }

  const approveJoinRequest = async (requestId: string, userId: string, projectId: string) => {
    const db = getDbClient()
    setLoading(requestId, true)
    try {
      await runTransaction(db, async (tx) => {
        // Get the request
        const requestRef = doc(db, 'joinRequests', requestId)
        const requestSnap = await tx.get(requestRef)
        if (!requestSnap.exists()) throw new Error('Request not found')
        const requestData = requestSnap.data() as any
        if (requestData.status !== 'pending') throw new Error('Request already processed')

        // Get the project
        const projectRef = doc(db, 'projects', projectId)
        const projectSnap = await tx.get(projectRef)
        if (!projectSnap.exists()) throw new Error('Project not found')
        const projectData = projectSnap.data() as any
        const members = projectData.members || []
        if (members.length >= 4) throw new Error('Project is full')
        if (members.includes(userId)) throw new Error('User is already a member')

        // Update project members
        tx.update(projectRef, { members: [...members, userId] })

        // Update request status
        tx.update(requestRef, { 
          status: 'approved', 
          reviewedBy: userRole, 
          reviewedAt: Timestamp.now() 
        })

        // Update user projectId
        const userRef = doc(db, 'users', userId)
        tx.update(userRef, { projectId })
      })
      alert('Join request approved!')
    } catch (e) {
      console.error('Approve join request failed', e)
      alert('Failed to approve: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(requestId, false)
    }
  }

  const rejectJoinRequest = async (requestId: string) => {
    const db = getDbClient()
    setLoading(requestId, true)
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { 
        status: 'rejected', 
        reviewedBy: userRole, 
        reviewedAt: Timestamp.now() 
      })
      alert('Join request rejected!')
    } catch (e) {
      console.error('Reject join request failed', e)
      alert('Failed to reject')
    } finally {
      setLoading(requestId, false)
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
        {/* Header with Sign Out */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Admin Panel</h2>
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
          <button 
            onClick={() => setActiveTab('projects')} 
            className={`px-4 py-2 ${activeTab === 'projects' ? 'text-cyscom border-b-2 border-cyscom' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Project Management
          </button>
          <button 
            onClick={() => setActiveTab('join-requests')} 
            className={`px-4 py-2 ${activeTab === 'join-requests' ? 'text-cyscom border-b-2 border-cyscom' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Join Requests ({joinRequests.length})
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

            <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <h3 className="text-lg font-medium">Contributions</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setContribFilter('pending')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${contribFilter === 'pending' ? 'bg-sky-600 text-white shadow shadow-sky-600/30' : 'bg-black/30 text-slate-200 border border-slate-700 hover:bg-black/40'}`}>
                      Pending ({contributions.filter((c) => c.status === 'pending').length})
                    </button>
                    <button
                      onClick={() => setContribFilter('all')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${contribFilter === 'all' ? 'bg-sky-600 text-white shadow shadow-sky-600/30' : 'bg-black/30 text-slate-200 border border-slate-700 hover:bg-black/40'}`}>
                      All ({contributions.length})
                    </button>
                    <button
                      onClick={() => setContribFilter('verified')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${contribFilter === 'verified' ? 'bg-sky-600 text-white shadow shadow-sky-600/30' : 'bg-black/30 text-slate-200 border border-slate-700 hover:bg-black/40'}`}>
                      Approved ({contributions.filter((c) => c.status === 'verified').length})
                    </button>
                    <button
                      onClick={() => setContribFilter('rejected')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${contribFilter === 'rejected' ? 'bg-sky-600 text-white shadow shadow-sky-600/30' : 'bg-black/30 text-slate-200 border border-slate-700 hover:bg-black/40'}`}>
                      Rejected ({contributions.filter((c) => c.status === 'rejected').length})
                    </button>
                  </div>
                </div>

                {contributions.length === 0 && (
                  <p className="text-slate-300 bg-black/30 border border-slate-800 rounded-lg p-4">No contributions found for this filter.</p>
                )}

                {contributions.map((c: Contribution) => {
                  const isPending = c.status === 'pending'
                  const submittedAt = c.createdAt ? new Date(c.createdAt).toLocaleString() : 'Unknown time'
                  const statusClasses =
                    c.status === 'verified'
                      ? 'bg-green-900/40 text-green-300 border border-green-600/40'
                      : c.status === 'rejected'
                      ? 'bg-red-900/40 text-red-300 border border-red-600/40'
                      : 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/40'

                  return (
                    <div key={c.contribId} className="p-4 rounded-xl bg-black/30 border border-slate-800 hover:border-cyscom/40 transition-colors">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-wider text-slate-500">Submitted</p>
                              <p className="text-sm text-slate-300">{submittedAt}</p>
                              <p className="text-xs text-slate-400">User: <span className="font-mono text-slate-200">{c.userId}</span></p>
                              {c.projectId && (
                                <p className="text-xs text-slate-400">Project: <span className="font-semibold text-cyscom/90">{c.projectId}</span></p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses}`}>
                              {c.status === 'verified' ? 'Approved' : c.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                            </span>
                          </div>

                          <p className="text-slate-200 leading-relaxed">{c.text}</p>

                          {c.imageUrl && (
                            <div className="mt-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={c.imageUrl} alt="contrib" className="max-h-48 rounded-lg border border-slate-700/60" />
                              <button
                                onClick={() => { setViewerUrl(c.imageUrl ?? null); setViewerZoom(1) }}
                                className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-cyberblue-700 text-white rounded text-sm"
                              >
                                View Full
                              </button>
                            </div>
                          )}

                          {!isPending && (
                            <div className="mt-3 text-sm text-slate-400">
                              {c.status === 'verified' && (
                                <span>Awarded Points: <strong className="text-cyscom">{c.pointsAwarded ?? 0}</strong></span>
                              )}
                              {c.status === 'rejected' && <span>No points awarded</span>}
                            </div>
                          )}
                        </div>

                        <div className="w-full md:w-48">
                          <label className="text-sm text-slate-300 block">Points</label>
                          <input
                            id={`points-${c.contribId}`}
                            type="number"
                            defaultValue={c.pointsAwarded ?? 5}
                            className="w-full mt-1 p-2 rounded bg-black/20 text-white border border-slate-700/60"
                            disabled={!isPending}
                          />
                          <div className="mt-3 flex gap-2 justify-end">
                            <button
                              onClick={async () => {
                                const val = (document.getElementById(`points-${c.contribId}`) as HTMLInputElement).value
                                await approve(c.contribId, Number(val))
                              }}
                              disabled={!isPending || loadingIds.includes(c.contribId)}
                              className={`px-3 py-1 rounded text-sm font-semibold ${!isPending || loadingIds.includes(c.contribId) ? 'bg-green-900/40 text-green-300/50 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-500'}`}
                            >
                              {loadingIds.includes(c.contribId) ? 'Processing' : 'Approve'}
                            </button>
                            <button
                              onClick={async () => await reject(c.contribId)}
                              disabled={!isPending || loadingIds.includes(c.contribId)}
                              className={`px-3 py-1 rounded text-sm font-semibold ${!isPending || loadingIds.includes(c.contribId) ? 'bg-red-900/40 text-red-300/50 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-500'}`}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-black/30 border border-slate-800">
                  <h3 className="text-lg font-semibold text-white">Review Activity</h3>
                  <p className="text-sm text-slate-400 mb-3">Latest contribution submissions and moderation actions.</p>
                  <ActivityLog limitCount={15} />
                </div>
              </div>
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
              {users.map((user) => {
                const currentSelections = userDepartmentSelections[user.userId] || []
                const originalDepartments = user.departments || []
                const hasChanges = JSON.stringify(currentSelections.sort()) !== JSON.stringify(originalDepartments.sort())
                
                return (
                  <div key={user.userId} className="p-4 rounded-xl bg-black/30 border border-slate-800">
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
                          {originalDepartments.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {originalDepartments.map(deptId => {
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
                        
                        {hasChanges && (
                          <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/40 rounded-lg">
                            <h6 className="text-sm font-medium text-yellow-400 mb-2">Pending Changes:</h6>
                            {currentSelections.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {currentSelections.map(deptId => {
                                  const dept = departments.find(d => d.deptId === deptId);
                                  return (
                                    <span key={deptId} className="px-2 py-1 bg-yellow-600/40 text-yellow-300 text-xs rounded">
                                      {dept ? dept.name : deptId}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-yellow-300">No departments selected</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="w-full md:w-64">
                        <div className="bg-black/20 p-3 rounded">
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Update Departments:</h5>
                          <div className="max-h-32 overflow-y-auto space-y-2">
                            {departments.map(dept => {
                              const isSelected = currentSelections.includes(dept.deptId)
                              const isAtCapacity = dept.filledCount >= dept.capacity
                              
                              return (
                                <div key={dept.deptId} className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id={`dept-${user.userId}-${dept.deptId}`}
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setUserDepartmentSelections(prev => ({
                                        ...prev,
                                        [user.userId]: checked
                                          ? [...(prev[user.userId] || []), dept.deptId]
                                          : (prev[user.userId] || []).filter(id => id !== dept.deptId)
                                      }))
                                    }}
                                    disabled={isAtCapacity && !isSelected}
                                    className="mr-2"
                                  />
                                  <label 
                                    htmlFor={`dept-${user.userId}-${dept.deptId}`} 
                                    className={`text-sm ${isAtCapacity && !isSelected ? 'text-slate-500' : 'text-slate-300'}`}
                                  >
                                    {dept.name} ({dept.filledCount}/{dept.capacity})
                                    {isAtCapacity && !isSelected && <span className="text-red-400 ml-1">(Full)</span>}
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => {
                                const selectedDepts = userDepartmentSelections[user.userId] || []
                                updateUserDepartments(user.userId, selectedDepts)
                              }}
                              disabled={loadingIds.includes(user.userId) || !hasChanges}
                              className={`flex-1 px-3 py-1 rounded text-sm font-semibold ${
                                loadingIds.includes(user.userId) || !hasChanges
                                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                  : 'bg-cyscom text-black hover:bg-cyscom/90'
                              }`}
                            >
                              {loadingIds.includes(user.userId) ? 'Processing...' : 'Update'}
                            </button>
                            <button
                              onClick={() => {
                                setUserDepartmentSelections(prev => ({
                                  ...prev,
                                  [user.userId]: []
                                }))
                              }}
                              disabled={loadingIds.includes(user.userId) || currentSelections.length === 0}
                              className={`px-3 py-1 rounded text-sm font-semibold ${
                                loadingIds.includes(user.userId) || currentSelections.length === 0
                                  ? 'bg-red-900/40 text-red-300/50 cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-500'
                              }`}
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => resetUserDepartments(user.userId)}
                              disabled={loadingIds.includes(user.userId)}
                              className={`px-3 py-1 rounded text-sm font-semibold ${
                                loadingIds.includes(user.userId)
                                  ? 'bg-orange-900/40 text-orange-300/50 cursor-not-allowed'
                                  : 'bg-orange-600 text-white hover:bg-orange-500'
                              }`}
                            >
                              Reset DB
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
            <h2 className="text-2xl font-semibold text-white">Project Management</h2>
            <p className="text-slate-300 mt-2">Create new projects, manage existing ones, and approve join requests.</p>
            
            <div className="mt-6 space-y-6">
              {/* Create New Project */}
              <div className="p-4 bg-black/30 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-4">Create New Project</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
                    <input
                      type="text"
                      id="new-project-name"
                      className="w-full px-3 py-2 bg-black/20 text-white rounded-lg border border-slate-600 focus:border-cyscom focus:outline-none"
                      placeholder="Enter project name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
                    <select
                      id="new-project-dept"
                      className="w-full px-3 py-2 bg-black/20 text-white rounded-lg border border-slate-600 focus:border-cyscom focus:outline-none"
                    >
                      <option value="">Select department</option>
                      {departments.map(dept => (
                        <option key={dept.deptId} value={dept.deptId}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    id="new-project-desc"
                    rows={3}
                    className="w-full px-3 py-2 bg-black/20 text-white rounded-lg border border-slate-600 focus:border-cyscom focus:outline-none"
                    placeholder="Enter project description"
                  ></textarea>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project Files (optional)</label>
                  <input
                    type="file"
                    id="new-project-files"
                    multiple
                    className="w-full px-3 py-2 bg-black/20 text-white rounded-lg border border-slate-600 focus:border-cyscom focus:outline-none"
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={async () => {
                      const name = (document.getElementById('new-project-name') as HTMLInputElement).value.trim()
                      const dept = (document.getElementById('new-project-dept') as HTMLSelectElement).value
                      const desc = (document.getElementById('new-project-desc') as HTMLTextAreaElement).value.trim()
                      const files = (document.getElementById('new-project-files') as HTMLInputElement).files

                      if (!name || !dept || !desc) {
                        alert('Please fill in all required fields')
                        return
                      }

                      try {
                        const db = getDbClient()
                        const projectId = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
                        const projectRef = doc(db, 'projects', projectId)
                        
                        // Upload files if any
                        let fileUrls: string[] = []
                        if (files && files.length > 0) {
                          // Convert files to base64 data URLs
                          const fileDataArray: Array<{ filename: string; dataUrl: string }> = []
                          
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i]
                            const dataUrl = await new Promise<string>((resolve, reject) => {
                              const reader = new FileReader()
                              reader.onload = () => resolve(reader.result as string)
                              reader.onerror = reject
                              reader.readAsDataURL(file)
                            })
                            
                            fileDataArray.push({
                              filename: file.name,
                              dataUrl: dataUrl
                            })
                          }
                          
                          // Upload to our API
                          const uploadResponse = await fetch('/api/upload-project-files', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              projectId: projectId,
                              files: fileDataArray
                            })
                          })
                          
                          if (!uploadResponse.ok) {
                            const error = await uploadResponse.json()
                            throw new Error(error.error || 'Failed to upload files')
                          }
                          
                          const uploadResult = await uploadResponse.json()
                          fileUrls = uploadResult.urls || []
                        }

                        await setDoc(projectRef, {
                          name,
                          description: desc,
                          department: dept,
                          members: [],
                          fileUrls: fileUrls,
                          createdAt: new Date(),
                          createdBy: userRole
                        })

                        // Clear form
                        ;(document.getElementById('new-project-name') as HTMLInputElement).value = ''
                        ;(document.getElementById('new-project-dept') as HTMLSelectElement).value = ''
                        ;(document.getElementById('new-project-desc') as HTMLTextAreaElement).value = ''
                        ;(document.getElementById('new-project-files') as HTMLInputElement).value = ''

                        alert('Project created successfully!')
                      } catch (e) {
                        console.error('Create project failed', e)
                        alert('Failed to create project: ' + (e instanceof Error ? e.message : String(e)))
                      }
                    }}
                    className="px-6 py-2 bg-cyscom text-black rounded-lg hover:bg-cyscom/90 transition-colors"
                  >
                    Create Project
                  </button>
                </div>
              </div>
              
              {/* Existing Projects */}
              <div className="p-4 bg-black/30 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-4">Existing Projects</h3>
                <div className="space-y-4">
                  {projects.length === 0 && <p className="text-slate-300">No projects found.</p>}
                  {projects.map((project) => (
                    <div key={project.projectId} className="p-4 bg-black/20 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-lg font-medium text-white">{project.name}</h4>
                          <p className="text-slate-300 text-sm mt-1">{project.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                            <span>Department: {departments.find(d => d.deptId === project.department)?.name || project.department}</span>
                            <span>Members: {project.members.length}/4</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              // Approve join requests functionality can be added here
                              alert('Join request approval functionality to be implemented')
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                          >
                            Approve Requests
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('Are you sure you want to delete this project?')) return
                              
                              try {
                                const db = getDbClient()
                                await deleteDoc(doc(db, 'projects', project.projectId))
                                alert('Project deleted successfully')
                              } catch (e) {
                                console.error('Delete project failed', e)
                                alert('Failed to delete project')
                              }
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Join Requests Tab */}
        {activeTab === 'join-requests' && (
          <div className="bg-pagebg/60 rounded-xl p-6 backdrop-blur-md shadow-lg">
            <h2 className="text-2xl font-semibold text-white">Join Requests</h2>
            <p className="text-slate-300 mt-2">Approve or reject pending project join requests.</p>
            
            <div className="mt-6 space-y-4">
              {joinRequests.length === 0 && <p className="text-slate-300">No pending join requests.</p>}
              {joinRequests.map((request) => (
                <div key={request.requestId} className="p-4 rounded bg-black/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-medium text-white">{request.user.name}</h4>
                        <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded">Pending</span>
                      </div>
                      <p className="text-slate-300 text-sm mb-2">{request.user.email}</p>
                      <p className="text-slate-400 text-sm">
                        Requested to join: <span className="text-cyscom">{request.project.name}</span>
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Requested at: {request.requestedAt?.toDate().toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveJoinRequest(request.requestId, request.userId, request.projectId)}
                        disabled={loadingIds.includes(request.requestId)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {loadingIds.includes(request.requestId) ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => rejectJoinRequest(request.requestId)}
                        disabled={loadingIds.includes(request.requestId)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
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
      {/* Image viewer modal */}
      {viewerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative max-w-4xl w-full mx-4">
            <div className="bg-black/90 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2">
                  <button onClick={() => setViewerZoom((z) => Math.max(0.2, z - 0.2))} className="px-3 py-1 bg-slate-700 text-white rounded">-</button>
                  <button onClick={() => setViewerZoom((z) => Math.min(4, z + 0.2))} className="px-3 py-1 bg-slate-700 text-white rounded">+</button>
                  <a href={viewerUrl} download className="px-3 py-1 bg-slate-700 text-white rounded">Download</a>
                </div>
                <button onClick={() => setViewerUrl(null)} className="px-3 py-1 bg-red-600 text-white rounded">Close</button>
              </div>
              <div className="overflow-auto" style={{ maxHeight: '80vh' }}>
                <img src={viewerUrl} alt="viewer" style={{ transform: `scale(${viewerZoom})`, transformOrigin: 'center top', display: 'block', margin: '0 auto' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
