import { getDbClient, getAuthClient } from './firebase';
import { doc, setDoc, updateDoc, increment, serverTimestamp, collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';

// Analytics Events Types
export type AnalyticsEventType = 
  | 'page_view'
  | 'login'
  | 'logout'
  | 'department_select'
  | 'project_join'
  | 'project_leave'
  | 'contribution_submit'
  | 'contribution_approve'
  | 'contribution_reject'
  | 'user_register';

// Analytics Context
export interface AnalyticsContext {
  path?: string;
  referrer?: string;
  timestamp?: Date | Timestamp;
  metadata?: Record<string, any>;
}

/**
 * Track an analytics event
 */
export const trackEvent = async (
  eventType: AnalyticsEventType,
  contextOrUserId?: string | AnalyticsContext,
  optionalContext?: AnalyticsContext
) => {
  // Handle overloaded parameters
  let userId: string | undefined;
  let context: AnalyticsContext | undefined;
  
  if (typeof contextOrUserId === 'string') {
    userId = contextOrUserId;
    context = optionalContext;
  } else {
    context = contextOrUserId;
  }
  try {
    const db = getDbClient();
    const auth = getAuthClient();
    const currentUser = auth.currentUser || { uid: userId || 'anonymous' };
    
    // Create event document
    const eventRef = doc(collection(db, 'analytics_events'));
    await setDoc(eventRef, {
      eventId: eventRef.id,
      eventType,
      userId: currentUser.uid,
      timestamp: serverTimestamp(),
      path: context?.path || window.location.pathname,
      referrer: context?.referrer || document.referrer,
      userAgent: navigator.userAgent,
      metadata: context?.metadata || {}
    });

    // Update aggregated stats
    const date = new Date();
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    const statsRef = doc(db, 'analytics_stats', dateString);
    await setDoc(statsRef, {
      date: dateString,
      [`events_${eventType}`]: increment(1),
      total_events: increment(1),
      last_updated: serverTimestamp()
    }, { merge: true });
    
  } catch (error) {
    console.error('Failed to track analytics event:', error);
  }
};

/**
 * Track page view
 */
export const trackPageView = (path?: string, referrer?: string) => {
  return trackEvent('page_view', undefined, { 
    path: path || window.location.pathname,
    referrer: referrer || document.referrer
  });
};

/**
 * Get active users count
 */
export const getActiveUsersCount = async (): Promise<number> => {
  try {
    const db = getDbClient();
    
    // Consider users active if they have a presence within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const presenceQuery = query(
      collection(db, 'presence'),
      where('lastActive', '>=', fiveMinutesAgo)
    );
    
    const snapshot = await getDocs(presenceQuery);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to get active users count:', error);
    return 0;
  }
};

/**
 * Listen to active users count in real-time
 */
export const onActiveUsersCountChange = (callback: (count: number) => void): (() => void) => {
  try {
    const db = getDbClient();
    
    // Set up real-time listener for presence changes
    const unsubscribe = onSnapshot(
      collection(db, 'presence'),
      (snapshot) => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        // Count documents where lastActive is within the last 5 minutes
        const activeUsers = snapshot.docs.filter(doc => {
          const data = doc.data();
          const lastActive = data.lastActive?.toDate();
          return lastActive && lastActive >= fiveMinutesAgo;
        });
        
        callback(activeUsers.length);
      },
      (error) => {
        console.error('Error listening to active users:', error);
        callback(0);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('Failed to set up active users listener:', error);
    return () => {};
  }
};

/**
 * Get analytics data for dashboard
 */
export const getAnalyticsDashboardData = async () => {
  try {
    const db = getDbClient();
    
    // Get today's date
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Get yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    // Get stats for today and yesterday
    const todayStats = await getDoc(doc(db, 'analytics_stats', todayString));
    const yesterdayStats = await getDoc(doc(db, 'analytics_stats', yesterdayString));
    
    // Get active users
    const activeUsers = await getActiveUsersCount();
    
    // Type-safe access to data
    const todayData = todayStats.exists() ? todayStats.data() as Record<string, any> : {};
    const yesterdayData = yesterdayStats.exists() ? yesterdayStats.data() as Record<string, any> : {};
    
    return {
      activeUsers,
      todayPageViews: todayData['events_page_view'] || 0,
      yesterdayPageViews: yesterdayData['events_page_view'] || 0,
      todayContributions: todayData['events_contribution_submit'] || 0,
      yesterdayContributions: yesterdayData['events_contribution_submit'] || 0,
      todayDepartmentSelections: todayData['events_department_select'] || 0,
      yesterdayDepartmentSelections: yesterdayData['events_department_select'] || 0
    };
  } catch (error) {
    console.error('Failed to get analytics dashboard data:', error);
    return {
      activeUsers: 0,
      todayPageViews: 0,
      yesterdayPageViews: 0,
      todayContributions: 0,
      yesterdayContributions: 0,
      todayDepartmentSelections: 0,
      yesterdayDepartmentSelections: 0
    };
  }
};

/**
 * Get user growth over time (last 30 days)
 */
export const getUserGrowthData = async () => {
  try {
    const db = getDbClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usersQuery = query(
      collection(db, 'users'),
      where('createdAt', '>=', thirtyDaysAgo)
    );
    
    const snapshot = await getDocs(usersQuery);
    
    // Group users by day
    const usersByDay: Record<string, number> = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const date = data.createdAt.toDate();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (usersByDay[dateString]) {
          usersByDay[dateString]++;
        } else {
          usersByDay[dateString] = 1;
        }
      }
    });
    
    // Fill in missing days with zero
    const result = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      result.unshift({
        date: dateString,
        count: usersByDay[dateString] || 0
      });
    }
    
    return result;
  } catch (error) {
    console.error('Failed to get user growth data:', error);
    return [];
  }
};

// Helper function to get specific document
async function getDoc(docRef: any) {
  try {
    const snap = await getDocs(query(collection(getDbClient(), docRef.path)));
    if (snap.empty) return { exists: () => false, data: () => ({}) };
    
    // Return first document from collection
    const firstDoc = snap.docs[0];
    return {
      exists: () => true,
      data: () => firstDoc.data()
    };
  } catch (e) {
    console.error('Error in getDoc helper:', e);
    return { exists: () => false, data: () => ({}) };
  }
}