import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getDbClient, getAuthClient } from '../../lib/firebase'
import Navigation from '../../components/Navigation'
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
      <div className="min-h-screen bg-black text-white">
        <Navigation userRole={null} />
        <main className="page-shell py-8 sm:py-10">
          <div className="ascii-card text-center space-y-3">
            <span className="ascii-card-top" aria-hidden="true">+----------------------+</span>
            <p className="text-xs uppercase tracking-[0.12em]">Loading project data...</p>
            <p className="text-sm" aria-hidden="true">[ \\ ] [ | ] [ / ] [ - ]</p>
            <span className="ascii-card-bottom" aria-hidden="true">+----------------------+</span>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation userRole={null} />
        <main className="page-shell py-8 sm:py-10">
          <div className="ascii-stack gap-6">
            <header className="space-y-2">
              <h1 className="ascii-title text-2xl sm:text-3xl">Project Not Found</h1>
              <hr className="ascii-rule" />
              <p className="ascii-footnote">The requested project could not be found.</p>
            </header>
            
            <div className="flex justify-center">
              <Link href="/projects" className="ascii-button text-xs py-2">
                Back to Projects
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isMember = (project.members || []).includes(userId);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation userRole={null} />
      <main className="page-shell py-8 sm:py-10">
        <div className="ascii-stack gap-6">
          {/* Header */}
          <header className="space-y-2">
            <div className="flex justify-between items-center">
              <h1 className="ascii-title text-2xl sm:text-3xl">{project.name}</h1>
              {project.department && (
                <span className="ascii-tag">
                  {getDepartmentName(project.department)}
                </span>
              )}
            </div>
            <hr className="ascii-rule" />
            <div className="text-xs sm:text-sm uppercase tracking-[0.14em] sm:tracking-[0.16em]">
              <Link href="/projects" className="flex items-center gap-2 hover:underline">
                <span>⟵</span>
                <span>Projects</span>
              </Link>
            </div>
            <p className="text-sm leading-relaxed">{project.description}</p>
          </header>

          {/* Members Section */}
          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <div className="flex justify-between items-center">
              <p className="ascii-meta">Project Members</p>
              <div className="text-xs tracking-wide">
                {members.length}/4 members
              </div>
            </div>

            {members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map(m => (
                  <div key={m.uid} className="border border-white/50 p-3 flex items-center">
                    <div className="w-8 h-8 border border-white flex items-center justify-center mr-3">
                      {m.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-sm">{m.name || 'Unknown'}</div>
                      <div className="text-xs opacity-70">{m.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm opacity-70 uppercase tracking-wide">
                No members yet
              </div>
            )}
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          {/* Project Contributions Section */}
          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <div className="flex justify-between items-center">
              <p className="ascii-meta">Contributions</p>
              {isMember && (
                <Link href={`/contributions?projectId=${project.projectId}`} className="text-xs uppercase tracking-wide hover:underline">
                  + Submit New
                </Link>
              )}
            </div>

            {isMember ? (
              <div className="space-y-4">
                <p className="text-sm">Submit your contributions for this project to earn points!</p>
                <div className="border border-white/40 p-3">
                  <ul className="ascii-list text-xs space-y-2">
                    <li>Include details of your work</li>
                    <li>Add screenshots or images if applicable</li>
                    <li>Admins will review and award points</li>
                  </ul>
                </div>
                <div className="flex justify-end">
                  <Link href={`/contributions?projectId=${project.projectId}`} className="ascii-button text-xs py-2">
                    Add Contribution
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-center py-2 text-sm">Join this project to submit contributions</p>
                
                {!isMember && userId && (
                  <div className="flex justify-center">
                    {hasPendingRequest ? (
                      <div className="space-y-3 text-center">
                        <div className="text-sm uppercase tracking-wide opacity-70">Request Pending</div>
                        <button 
                          onClick={withdrawRequest} 
                          className="ascii-button text-xs py-2"
                        >
                          Withdraw
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={requestToJoin} 
                        disabled={requesting}
                        className="ascii-button text-xs py-2"
                      >
                        Request to Join
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          {/* Project Reviews Section */}
          <section className="ascii-card space-y-4">
            <span className="ascii-card-top" aria-hidden="true">+-----------------------+</span>
            <div className="flex justify-between items-center">
              <p className="ascii-meta">Reviews</p>
              <div className="text-xs tracking-wide">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </div>
            </div>

            {isMember ? (
              <div className="space-y-3">
                <textarea 
                  value={comment} 
                  onChange={(e)=>setComment(e.target.value)} 
                  placeholder="ADD YOUR REVIEW..."
                  className="ascii-input"
                  rows={3}
                />
                <div className="flex justify-end">
                  <button 
                    onClick={submitReview} 
                    disabled={submitting || !comment.trim()}
                    className="ascii-button text-xs py-2"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm uppercase tracking-wider opacity-70">Join this project to add reviews</p>
                <Link href="/projects" className="ascii-button text-xs py-2">
                  Go to Projects
                </Link>
              </div>
            )}

            <div className="space-y-3">
              {reviews.length > 0 ? (
                reviews.map(r => (
                  <div key={r.id} className="border border-white p-4 space-y-3">
                    <p className="text-sm">{r.comment}</p>
                    <div className="flex flex-wrap justify-between items-center gap-2 text-xs uppercase tracking-wider opacity-70">
                      <div>By {r.userName || r.userId.substring(0, 8)}</div>
                      <div>{new Date(r.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs uppercase tracking-wider opacity-50">
                  No reviews yet
                </div>
              )}
            </div>
            <span className="ascii-card-bottom" aria-hidden="true">+-----------------------+</span>
          </section>

          {/* Footer */}
          <footer className="flex justify-center">
            <Link href="/projects" className="ascii-button text-xs py-2">
              Back to Projects
            </Link>
          </footer>
        </div>
      </main>
    </div>
  )
}
