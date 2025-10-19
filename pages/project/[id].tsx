import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getDbClient, getAuthClient } from '../../lib/firebase'
import { doc, getDoc, collection, query, onSnapshot, addDoc, Timestamp, where, getDocs, deleteDoc } from 'firebase/firestore'
import Link from 'next/link'

export default function ProjectPage(){
  const router = useRouter()
  const { id } = router.query
  const [project, setProject] = useState<any|null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [userId, setUserId] = useState<string|null>(null)
  const [userName, setUserName] = useState<string|null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(()=>{
    if(typeof window==='undefined') return
    const auth = getAuthClient()
    const unsub = auth.onAuthStateChanged((u:any|null)=> {
      setUserId(u?.uid ?? null);
      if (u?.uid) {
        // Fetch user name
        const db = getDbClient();
        getDoc(doc(db, 'users', u.uid)).then(snap => {
          if (snap.exists()) {
            setUserName(snap.data().name || null);
          }
        });
      }
    })
    return ()=>unsub()
  },[])

  useEffect(()=>{
    if(!id) return
    setLoading(true)
    const db = getDbClient()
    ;(async ()=>{
      const pdoc = doc(db,'projects',String(id))
      const snap = await getDoc(pdoc)
      if(snap.exists()) {
        setProject({projectId:snap.id, ...(snap.data() as any)})
      } else {
        // Project not found
        router.push('/projects');
      }
      setLoading(false)
    })()

    const rcol = collection(getDbClient(),'reviews')
    const q = query(rcol)
    const unsub = onSnapshot(q,(snap)=>{
      const arr:any[] = []
      snap.forEach(d=>{ 
        const data = d.data() as any; 
        if(data.projectId===id) {
          arr.push({
            id: d.id,
            ...data,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          }) 
        }
      })
      // Sort reviews by date (newest first)
      arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setReviews(arr)
    })
    return ()=>unsub()
  },[id, router])

  useEffect(()=>{
    if(!project) return
    (async ()=>{
      const db = getDbClient()
      const mems = project.members || []
      const users:any[] = []
      for(const m of mems){
        const snap = await getDoc(doc(db,'users',m))
        if(snap.exists()) users.push({uid:m,...snap.data()})
      }
      setMembers(users)
    })()
  },[project])

  useEffect(()=>{
    if(!userId || !id) return
    const db = getDbClient()
    const joinRequestsRef = collection(db, 'joinRequests')
    const q = query(joinRequestsRef, where('userId', '==', userId), where('projectId', '==', id), where('status', '==', 'pending'))
    const unsub = onSnapshot(q, (snapshot) => {
      setHasPendingRequest(!snapshot.empty)
    })
    return () => unsub()
  }, [userId, id])

  // Function to get department name from ID
  const getDepartmentName = (deptId: string | null): string => {
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

  const submitReview = async () => {
    if(!userId) return alert('Sign in required');
    if(!project) return;
    if(!comment.trim()) return alert('Review cannot be empty');
    
    // ensure user is a member
    if(!(project.members||[]).includes(userId)) return alert('Join project to submit review');
    
    setSubmitting(true);
    try {
      const db = getDbClient();
      await addDoc(collection(db,'reviews'), {
        projectId: project.projectId,
        userId,
        userName: userName || 'Anonymous',
        comment,
        createdAt: new Date().toISOString()
      });
      setComment('');
    } catch (error) {
      console.error("Error submitting review:", error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const requestToJoin = async () => {
    if(!userId) return alert('Sign in required');
    if(!project) return;
    if(hasPendingRequest) return alert('You already have a pending request');
    if((project.members||[]).includes(userId)) return alert('You are already a member');

    setRequesting(true);
    try {
      const db = getDbClient();
      await addDoc(collection(db,'joinRequests'), {
        userId,
        projectId: project.projectId,
        status: 'pending',
        requestedAt: Timestamp.now()
      });
      alert('Join request submitted successfully!');
    } catch (error) {
      console.error("Error submitting join request:", error);
      alert('Failed to submit join request. Please try again.');
    } finally {
      setRequesting(false);
    }
  }

  const withdrawRequest = async () => {
    if (!userId) return alert('Sign in required');
    if (!project) return;
    const db = getDbClient();
    try {
      // Find and delete the pending request
      const requests = await getDocs(query(
        collection(db, 'joinRequests'),
        where('userId', '==', userId),
        where('projectId', '==', project.projectId),
        where('status', '==', 'pending')
      ))
      
      if (requests.empty) {
        alert('No pending request found')
        return
      }
      
      // Delete the request
      await Promise.all(requests.docs.map(doc => deleteDoc(doc.ref)))
      
      alert('Join request withdrawn successfully!')
    } catch (error) {
      console.error("Error withdrawing join request:", error);
      alert('Failed to withdraw join request. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyscom"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white py-16 px-4">
        <div className="max-w-3xl mx-auto bg-pagebg/60 rounded-xl p-6 sm:p-8 backdrop-blur-md shadow-lg text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Project not found</h2>
          <p className="text-slate-300 mt-2 text-sm sm:text-base">The requested project could not be found.</p>
          <Link href="/projects" className="mt-6 inline-block px-4 py-2 bg-cyscom text-black rounded hover:bg-cyscom/90 transition-colors text-sm">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const isMember = (project.members || []).includes(userId);

  return (
    <div className="min-h-screen bg-black text-white py-6 sm:py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto bg-pagebg/60 rounded-xl p-5 sm:p-8 backdrop-blur-md shadow-lg space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/projects" className="text-cyscom hover:text-cyscom/90 transition-colors flex items-center text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Projects
          </Link>
          {project.department && (
            <span className="inline-block px-3 py-1 bg-cyscom/20 text-cyscom text-xs rounded">
              {getDepartmentName(project.department)}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white leading-tight">{project.name}</h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{project.description}</p>
        </div>

        <div className="p-4 sm:p-5 rounded bg-black/30 space-y-4">
          <h4 className="text-lg text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Members
            <span className="ml-2 text-sm text-slate-400">({members.length}/4)</span>
          </h4>
          {members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map(m => (
                <div key={m.uid} className="p-2 bg-black/20 rounded flex items-center">
                  <div className="w-8 h-8 rounded-full bg-cyscom/30 text-cyscom flex items-center justify-center mr-2">
                    {m.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="text-white">{m.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 mt-2">No members yet</div>
          )}
        </div>

        {/* Project Contributions Section */}
        <div className="space-y-4">
          <h4 className="text-lg text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Contributions
            </div>
            {isMember && (
              <Link href={`/contributions?projectId=${project.projectId}`} className="text-cyscom text-sm hover:underline flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Submit Contribution
              </Link>
            )}
          </h4>

          {isMember ? (
            <div className="p-4 bg-black/20 rounded space-y-4">
              <p className="text-slate-300 text-sm sm:text-base">Submit your contributions for this project to earn points!</p>
              <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
                <div className="flex-1">
                  <ul className="text-xs sm:text-sm text-slate-400 list-disc pl-5 space-y-1">
                    <li>Include details of your work</li>
                    <li>Add screenshots or images if applicable</li>
                    <li>Admins will review and award points</li>
                  </ul>
                </div>
                <Link href={`/contributions?projectId=${project.projectId}`} className="self-start sm:self-auto px-4 py-2 bg-cyscom text-black rounded hover:bg-cyscom/90 transition-colors text-sm">
                  Add Contribution
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-black/20 rounded text-center space-y-4">
              <p className="text-slate-300 text-sm sm:text-base">Join this project to submit contributions</p>
              {!isMember && userId && (
                <div>
                  {hasPendingRequest ? (
                    <div className="space-y-3">
                      <div className="text-yellow-400 text-sm">Your join request is pending approval</div>
                      <button 
                        onClick={withdrawRequest} 
                        className="px-6 py-2 bg-yellow-600/50 text-yellow-400 border border-yellow-700/50 rounded hover:bg-yellow-600/70 transition-colors text-sm"
                      >
                        Withdraw Request
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={requestToJoin} 
                      disabled={requesting}
                      className={`px-6 py-2 rounded flex items-center justify-center mx-auto text-sm ${
                        requesting 
                          ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                          : 'bg-cyscom text-black hover:bg-cyscom/90 transition-colors'
                      }`}
                    >
                      {requesting && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      Request to Join Project
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Project Reviews Section */}
        <div className="space-y-4">
          <h4 className="text-lg text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Reviews
            <span className="ml-2 text-sm text-slate-400">({reviews.length})</span>
          </h4>

          {isMember ? (
            <div className="p-3 bg-black/20 rounded space-y-3">
              <textarea 
                value={comment} 
                onChange={(e)=>setComment(e.target.value)} 
                placeholder="Add your review..."
                className="w-full p-3 bg-black/20 text-white rounded resize-none focus:outline-none focus:ring-1 focus:ring-cyscom text-sm" 
                rows={3}
              />
              <div className="flex justify-end">
                <button 
                  onClick={submitReview} 
                  disabled={submitting || !comment.trim()}
                  className={`px-4 py-1.5 rounded flex items-center text-sm ${
                    submitting || !comment.trim() 
                      ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                      : 'bg-cyscom text-black hover:bg-cyscom/90 transition-colors'
                  }`}
                >
                  {submitting && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Submit review
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-black/20 rounded text-center space-y-3">
              <p className="text-slate-300 text-sm sm:text-base">Join this project to add reviews</p>
              <Link href="/projects" className="inline-block px-3 py-1 bg-cyscom text-black rounded hover:bg-cyscom/90 transition-colors text-sm">
                Go to Projects
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {reviews.length > 0 ? (
              reviews.map(r => (
                <div key={r.id} className="p-3 bg-black/20 rounded space-y-2">
                  <p className="text-white text-sm sm:text-base leading-relaxed">{r.comment}</p>
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-400">
                    <div className="font-medium">By {r.userName || r.userId}</div>
                    <div>{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 bg-black/20 rounded text-center text-slate-400 text-sm">No reviews yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
