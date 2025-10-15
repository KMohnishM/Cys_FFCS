import Link from 'next/link'
import { useEffect, useState, FormEvent } from 'react'
import { getAuthClient, getDbClient, getStorageClient } from '../lib/firebase'
import { useRouter } from 'next/router'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { UserProgress } from '../lib/useAuthGuard'
import WorkflowSteps from '../components/WorkflowSteps'
import ActivityLog from '../components/ActivityLog'
import AnalyticsCharts from '../components/AnalyticsCharts'
import { trackEvent } from '../lib/analytics'

// Quick contribution form component
function QuickContributionForm({ userId, userProject }: { userId?: string, userProject: any }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  // Handle file input change and generate preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null
    setFile(selectedFile)
    
    // Create a preview URL
    if (selectedFile) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      setPreviewUrl(null)
    }
  }
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) {
      return
    }
    
    if (!text.trim()) {
      alert('Please enter a description for your contribution')
      return
    }
    
    setSubmitting(true)
    
    try {
      let imageUrl: string | null = null
      
      // Upload image if there is one
      if (file) {
        const storage = getStorageClient()
        const path = `contributions/${userId}/${Date.now()}_${file.name}`
        const sRef = storageRef(storage, path)
        const uploadTask = uploadBytesResumable(sRef, file)
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            () => {},
            (err) => reject(err),
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref)
              resolve()
            }
          )
        })
      }
      
      // Add contribution to Firestore
      const db = getDbClient()
      const col = collection(db, 'contributions')
      const docRef = await addDoc(col, {
        userId: userId,
        projectId: userProject?.id || null,
        text: text.trim(),
        imageUrl: imageUrl,
        status: 'pending',
        pointsAwarded: 0,
        createdAt: serverTimestamp(),
      })
      
      // Update with the contribution ID
      await updateDoc(doc(db, 'contributions', docRef.id), { contribId: docRef.id })
      
      // Reset form
      setText('')
      setFile(null)
      setPreviewUrl(null)
      setSuccessMessage('Contribution submitted successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
      
      // Refresh the page to update the contributions list
      setTimeout(() => {
        router.reload()
      }, 2000)
    } catch (err) {
      console.error('Error submitting contribution:', err)
      alert('Failed to submit contribution. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <textarea 
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you contribute?"
        className="w-full min-h-[80px] p-3 bg-black/30 rounded-lg text-white text-sm border border-cyberblue-700/30 focus:border-cyberblue-500 focus:ring-1 focus:ring-cyberblue-500 outline-none transition"
      />
      
      {/* File upload input */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded-lg text-sm text-cyberblue-300 cursor-pointer hover:bg-black/40 border border-cyberblue-700/30 transition">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          <span>{file ? file.name.substring(0, 15) + (file.name.length > 15 ? '...' : '') : 'Add Image'}</span>
          <input 
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        
        <button 
          type="submit" 
          disabled={submitting || !text.trim()}
          className="px-4 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg text-sm font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-cyberblue-500/20 transition"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
      
      {/* Image preview */}
      {previewUrl && (
        <div className="mt-3 relative">
          <div className="max-h-48 overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="max-w-full h-auto" />
          </div>
          <button 
            type="button"
            onClick={() => {
              setFile(null)
              setPreviewUrl(null)
            }}
            className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-black/80"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Success message */}
      {successMessage && (
        <div className="mt-3 py-2 px-3 bg-green-600/20 text-green-300 rounded text-sm">
          {successMessage}
        </div>
      )}
    </form>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [userProject, setUserProject] = useState<any>(null)
  const [userDepartments, setUserDepartments] = useState<any[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [contributions, setContributions] = useState<any[]>([])
  const [contributionsCount, setContributionsCount] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  
  // Function to get department name from ID
  const getDepartmentName = (deptId: string): string => {
    if (!deptId) return "Unknown";
    
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

  useEffect(() => {
    // Track page view
    trackEvent('page_view', { path: '/dashboard', title: 'User Dashboard' });
    
    const auth = getAuthClient()
    const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        router.push('/')
        return
      }
      
      setUser(currentUser)
      
      // Get user data from Firestore
      try {
        const db = getDbClient()
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        
        if (!userSnap.exists()) {
          setUserProgress(UserProgress.NEEDS_DEPARTMENTS)
          setLoading(false)
          return
        }
        
        const userDataFromDb = userSnap.data()
        setUserData(userDataFromDb)
        
        // Fetch user's departments details
        if (userDataFromDb.departments && userDataFromDb.departments.length > 0) {
          const departmentsData = [];
          for (const deptId of userDataFromDb.departments) {
            const deptRef = doc(db, 'departments', deptId);
            const deptSnap = await getDoc(deptRef);
            if (deptSnap.exists()) {
              departmentsData.push({ id: deptId, ...deptSnap.data() });
            }
          }
          setUserDepartments(departmentsData);
        }
        
        // Fetch user's project details
        if (userDataFromDb.projectId) {
          const projectRef = doc(db, 'projects', userDataFromDb.projectId);
          const projectSnap = await getDoc(projectRef);
          if (projectSnap.exists()) {
            setUserProject({ id: projectSnap.id, ...projectSnap.data() });
          }
        }
        
        // Fetch user's contributions
        const contributionsQuery = query(
          collection(db, 'contributions'), 
          where('userId', '==', currentUser.uid)
        );
        const contributionsSnap = await getDocs(contributionsQuery);
        const contributionsData = contributionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContributions(contributionsData);
        setContributionsCount(contributionsData.length);
        
        // Calculate total points
        const points = contributionsData.reduce((total, contrib: any) => total + (contrib.pointsAwarded || 0), 0);
        setTotalPoints(points);
        
        // Set user progress
        if (!userDataFromDb.departments || userDataFromDb.departments.length < 2) {
          setUserProgress(UserProgress.NEEDS_DEPARTMENTS)
        } else if (!userDataFromDb.projectId) {
          setUserProgress(UserProgress.NEEDS_PROJECT)
        } else {
          setUserProgress(UserProgress.COMPLETE)
        }
        
        // Log user activity for analytics
        trackEvent('dashboard_load', {
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Anonymous',
          progress: userDataFromDb.departments?.length < 2 ? 'needs_departments' : 
                   !userDataFromDb.projectId ? 'needs_project' : 'complete',
          departments: userDataFromDb.departments?.length || 0,
          hasProject: !!userDataFromDb.projectId,
          contributions: contributionsData.length,
          points: points
        });
        
        setLoading(false)
      } catch (error) {
        console.error('Error fetching user data:', error)
        setLoading(false)
      }
    })
    
    return () => unsubAuth()
  }, [router])
  
  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyscom border-t-transparent rounded-full"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-pagebg to-cyberdark-900">
      <div className="container max-w-4xl mx-auto">
        <div className="bg-cyberdark-800/80 rounded-xl p-5 md:p-6 backdrop-blur-xl shadow-xl border border-cyberblue-900/30">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-cyberblue-300 bg-clip-text text-transparent">Dashboard</h2>
          
          {user && (
            <div className="mt-4 p-4 bg-cyberblue-700/30 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xl font-medium text-white">{user.displayName}</div>
                <div className="text-sm text-cyberblue-300">{user.email}</div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-cyberblue-400">{totalPoints}</div>
                <div className="text-sm text-cyberblue-300">
                  {contributionsCount} Contribution{contributionsCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}
          
          {/* Progress tracker */}
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4 text-cyberblue-300">Progress</h3>
            <div className="relative flex items-center justify-between mb-6">
              {/* Progress bar */}
              <div className="absolute left-0 top-1/2 w-full h-2 bg-cyberdark-700 rounded-full -translate-y-1/2"></div>
              <div 
                className="absolute left-0 top-1/2 h-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-400 rounded-full -translate-y-1/2 transition-all duration-500"
                style={{ 
                  width: userProgress === UserProgress.NEEDS_DEPARTMENTS ? '0%' :
                         userProgress === UserProgress.NEEDS_PROJECT ? '50%' : '100%' 
                }}
              ></div>
              
              {/* Step 1: Sign In */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 flex items-center justify-center text-black shadow-lg shadow-cyberblue-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="mt-2 text-center text-sm font-medium text-white">Sign In</div>
              </div>
              
              {/* Step 2: Departments */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${userProgress !== UserProgress.NEEDS_DEPARTMENTS ? 'bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 text-black shadow-cyberblue-500/20' : 'bg-cyberdark-700 text-white shadow-black/20'}`}>
                  {userProgress !== UserProgress.NEEDS_DEPARTMENTS ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : '2'}
                </div>
                <div className="mt-2 text-center text-sm font-medium text-white">Departments</div>
              </div>
              
              {/* Step 3: Projects */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${userProgress === UserProgress.COMPLETE ? 'bg-gradient-to-r from-cyberblue-500 to-cyberblue-400 text-black shadow-cyberblue-500/20' : 'bg-cyberdark-700 text-white shadow-black/20'}`}>
                  {userProgress === UserProgress.COMPLETE ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : '3'}
                </div>
                <div className="mt-2 text-center text-sm font-medium text-white">Projects</div>
              </div>
            </div>
          </div>
          
          {/* Selections Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Departments */}
            <div className="p-4 bg-cyberdark-700/70 rounded-lg border border-cyberblue-700/30">
              <h4 className="font-medium text-cyberblue-400 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Departments
              </h4>
              
              {userDepartments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {userDepartments.map(dept => (
                    <div key={dept.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-cyberblue-700/20">
                      <div className="text-white font-medium">{getDepartmentName(dept.id)}</div>
                      <div className="px-2 py-1 bg-cyberdark-800 rounded text-xs text-cyberblue-300">
                        {dept.filledCount || 0}/{dept.capacity || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-center py-4">
                  <Link href="/departments" className="inline-block px-5 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition">
                    Select Departments
                  </Link>
                </div>
              )}
              
              {userDepartments.length > 0 && userDepartments.length < 2 && (
                <div className="mt-3">
                  <Link href="/departments" className="inline-block px-4 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition">
                    Add Department
                  </Link>
                </div>
              )}
            </div>
            
            {/* Project */}
            <div className="p-4 bg-cyberdark-700/70 rounded-lg border border-cyberblue-700/30">
              <h4 className="font-medium text-cyberblue-400 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                  <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
                </svg>
                Project
              </h4>
              
              {userProject ? (
                <div className="mt-3">
                  <div className="p-4 bg-black/20 rounded-lg border border-cyberblue-700/20">
                    <Link href={`/project/${userProject.id}`} className="text-white font-medium hover:text-cyberblue-400 transition-colors">
                      {userProject.name}
                    </Link>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="px-2 py-1 bg-cyberdark-800 rounded text-xs text-cyberblue-300">
                        {getDepartmentName(userProject.department)}
                      </span>
                      <span className="px-2 py-1 bg-cyberdark-800 rounded text-xs text-cyberblue-300">
                        {userProject.members?.length || 0}/4
                      </span>
                    </div>
                    <div className="mt-4">
                      <Link href={`/project/${userProject.id}`} className="w-full block text-center px-4 py-2 bg-cyberdark-800 hover:bg-cyberdark-700 text-cyberblue-400 rounded-lg border border-cyberblue-700/30 transition">
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-center py-4">
                  <Link href="/projects" className="inline-block px-5 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition">
                    Browse Projects
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Analytics and Stats Section */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Activity Stats */}
            <div className="p-4 bg-cyberdark-700/70 rounded-lg border border-cyberblue-700/30">
              <h4 className="font-medium text-cyberblue-400 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Stats
              </h4>
              
              <div className="mt-4">
                <AnalyticsCharts 
                  type="bar" 
                  title=""
                  height={160}
                  data={[
                    { label: 'Contributions', value: contributions.length },
                    { label: 'Departments', value: userDepartments.length },
                    { label: 'Projects', value: userProject ? 1 : 0 }
                  ]}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-black/30 p-3 rounded-lg border border-cyberblue-700/20 flex flex-col items-center">
                  <div className="text-xl font-bold text-cyberblue-300">{contributions.length}</div>
                  <div className="text-xs text-cyberblue-500">Contributions</div>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-cyberblue-700/20 flex flex-col items-center">
                  <div className="text-xl font-bold text-cyberblue-300">{totalPoints}</div>
                  <div className="text-xs text-cyberblue-500">Points</div>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-cyberblue-700/20 flex flex-col items-center">
                  <div className="text-xl font-bold text-cyberblue-300">{userDepartments.length || 0}/2</div>
                  <div className="text-xs text-cyberblue-500">Departments</div>
                </div>
              </div>
            </div>
            
            {/* Contributions Summary */}
            <div className="p-4 bg-cyberdark-700/70 rounded-lg border border-cyberblue-700/30">
              <h4 className="font-medium text-cyberblue-400 flex items-center justify-between">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  Contributions
                </span>
                <Link href="/contributions" className="text-xs text-cyberblue-400 hover:underline">
                  View All
                </Link>
              </h4>
              
              {contributions.length > 0 ? (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {contributions.slice(0, 3).map(contrib => (
                    <div key={contrib.id} className="p-3 bg-black/30 rounded-lg border border-cyberblue-700/20 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="text-sm text-white">{contrib.text?.substring(0, 40)}{contrib.text?.length > 40 ? '...' : ''}</div>
                        <div className="text-xs text-cyberblue-500 mt-1">
                          {contrib.createdAt && new Date(contrib.createdAt.seconds * 1000).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-cyberblue-300 font-bold">
                        +{contrib.pointsAwarded || 0}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-center py-6">
                  <Link href="/contributions" className="inline-block px-5 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition">
                    Add Contribution
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-6 p-4 bg-cyberdark-700/70 rounded-lg border border-cyberblue-700/30">
            <h4 className="font-medium text-cyberblue-400 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Recent Activity
            </h4>
            
            <div className="mt-3">
              <ActivityLog limitCount={5} />
            </div>
          </div>
          
          {/* Add contribution form */}
          {userProgress === UserProgress.COMPLETE && (
            <div className="mt-6 p-4 bg-cyberdark-700/70 rounded-lg border border-cyberblue-700/30">
              <h4 className="font-medium text-cyberblue-400 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                New Contribution
              </h4>
              <QuickContributionForm userId={user?.uid} userProject={userProject} />
            </div>
          )}

          {/* Next step guidance */}
          <div className="mt-6 p-5 bg-gradient-to-b from-cyberdark-700/80 to-cyberdark-700/50 rounded-lg border border-cyberblue-600/30 shadow-lg shadow-cyberblue-900/10">
            <h4 className="font-medium text-cyberblue-400">Next Step</h4>
            {userProgress === UserProgress.NEEDS_DEPARTMENTS && (
              <>
                <p className="mt-1 text-white">Choose your departments</p>
                <Link href="/departments" className="mt-3 inline-block px-5 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition">
                  Select Departments
                </Link>
              </>
            )}
            {userProgress === UserProgress.NEEDS_PROJECT && (
              <>
                <p className="mt-1 text-white">Join a project</p>
                <Link href="/projects" className="mt-3 inline-block px-5 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition">
                  Browse Projects
                </Link>
              </>
            )}
            {userProgress === UserProgress.COMPLETE && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Link href={`/contributions${userProject ? `?projectId=${userProject.id}` : ''}`} 
                    className="inline-block px-4 py-2 bg-gradient-to-r from-cyberblue-600 to-cyberblue-500 text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyberblue-500/20 transition text-center">
                    Submit Contribution
                  </Link>
                  <Link href={`/project/${userProject?.id}`} 
                    className="inline-block px-4 py-2 bg-black/30 text-cyberblue-300 border border-cyberblue-700/30 rounded-lg font-medium text-center hover:bg-black/50 transition">
                    View Project
                  </Link>
                </div>
              </>
            )}
          </div>
          
          {/* Workflow Explainer */}
          <WorkflowSteps currentStep={userProgress} showDetails={false} />
          
          {/* Navigation */}
          <div className="mt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/departments" className="p-3 bg-cyberdark-700/70 rounded-lg hover:bg-cyberdark-700/90 border border-cyberblue-700/20 transition-all text-center text-white group">
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-cyberblue-400 group-hover:text-cyberblue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Departments
                </div>
              </Link>
              <Link href="/projects" className="p-3 bg-cyberdark-700/70 rounded-lg hover:bg-cyberdark-700/90 border border-cyberblue-700/20 transition-all text-center text-white group">
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-cyberblue-400 group-hover:text-cyberblue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Projects
                </div>
              </Link>
              <Link href="/contributions" className="p-3 bg-cyberdark-700/70 rounded-lg hover:bg-cyberdark-700/90 border border-cyberblue-700/20 transition-all text-center text-white group">
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-cyberblue-400 group-hover:text-cyberblue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Contributions
                </div>
              </Link>
              <Link href="/leaderboard" className="p-3 bg-cyberdark-700/70 rounded-lg hover:bg-cyberdark-700/90 border border-cyberblue-700/20 transition-all text-center text-white group">
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-cyberblue-400 group-hover:text-cyberblue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Leaderboard
                </div>
              </Link>
            </div>
            
            {/* Admin link if user is admin */}
            {userData && (userData.role === 'admin' || userData.role === 'superadmin') && (
              <div className="mt-3">
                <Link href="/admin" className="p-3 bg-gradient-to-r from-cyberblue-700/30 to-cyberblue-600/20 rounded-lg hover:from-cyberblue-700/40 hover:to-cyberblue-600/30 border border-cyberblue-600/30 transition-all text-center block text-cyberblue-300 font-medium group">
                  <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                    Admin Panel
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
