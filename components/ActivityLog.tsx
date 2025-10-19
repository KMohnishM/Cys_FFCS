import React, { useEffect, useState } from 'react';
import { getDbClient } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';

interface ActivityEvent {
  eventId: string;
  eventType: string;
  userId: string;
  timestamp: Timestamp;
  path?: string;
  displayName?: string;
  photoURL?: string;
  metadata?: Record<string, any>;
}

interface ActivityLogProps {
  limitCount?: number;
}

const eventTypeLabels: Record<string, string> = {
  'login': 'Signed In',
  'logout': 'Signed Out',
  'page_view': 'Viewed Page',
  'department_select': 'Selected Department',
  'project_join': 'Joined Project',
  'project_leave': 'Left Project',
  'contribution_submit': 'Submitted Contribution',
  'contribution_approve': 'Approved Contribution',
  'contribution_reject': 'Rejected Contribution',
  'user_register': 'Registered'
};

const getEventTypeColor = (eventType: string): string => {
  switch (eventType) {
    case 'login':
      return 'bg-green-500/20 text-green-400';
    case 'logout':
      return 'bg-amber-500/20 text-amber-400';
    case 'department_select':
      return 'bg-purple-500/20 text-purple-400';
    case 'project_join':
      return 'bg-blue-500/20 text-blue-400';
    case 'project_leave':
      return 'bg-red-500/20 text-red-400';
    case 'contribution_submit':
      return 'bg-cyscom/20 text-cyscom';
    case 'contribution_approve':
      return 'bg-green-500/20 text-green-400';
    case 'contribution_reject':
      return 'bg-red-500/20 text-red-400';
    case 'user_register':
      return 'bg-blue-500/20 text-blue-400';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
};

const formatTime = (timestamp: Timestamp | null): string => {
  if (!timestamp) return 'Unknown time';
  
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  
  if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffMins < 1440) { // Less than a day
    return `${Math.round(diffMins / 60)}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

const ActivityLog: React.FC<ActivityLogProps> = ({ limitCount = 10 }) => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const db = getDbClient();
    
    const eventsQuery = query(
      collection(db, 'analytics_events'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    try {
      const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
        const activitiesData: ActivityEvent[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data() as ActivityEvent;
          activitiesData.push({
            ...data,
            eventId: doc.id,
          });
        });
        
        setActivities(activitiesData);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching activity log:', err);
        setError('Failed to load activity log');
        setLoading(false);
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up activity log listener:', err);
      setError('Failed to connect to activity log');
      setLoading(false);
      return () => {};
    }
  }, [limitCount]);
  
  if (loading) {
    return (
      <div className="p-4 rounded-lg bg-black/30">
        <div className="animate-pulse flex items-center space-x-2">
          <div className="h-4 w-4 bg-cyberdark-700 rounded-full"></div>
          <div className="h-4 w-20 bg-cyberdark-700 rounded"></div>
          <div className="h-4 flex-1 bg-cyberdark-700 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-900/20 text-red-400">
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1 cyber-scrollbar">
      {activities.length === 0 ? (
        <div className="text-center text-slate-500 py-4">No recent activity</div>
      ) : (
        activities.map((activity) => (
          <div key={activity.eventId} className="p-2 rounded bg-black/30 border border-slate-800 hover:border-cyscom/30 transition-colors">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded ${getEventTypeColor(activity.eventType)}`}>
                {eventTypeLabels[activity.eventType] || activity.eventType}
              </span>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {activity.displayName || activity.userId.substring(0, 6)}
                  {activity.path && (
                    <span className="text-slate-400"> • {activity.path}</span>
                  )}
                </p>
              </div>
              
              <div className="text-xs text-slate-500">
                {formatTime(activity.timestamp || null)}
              </div>
            </div>
            
            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
              <div className="mt-1 text-xs text-slate-400 pl-16">
                {activity.metadata.projectName && <span>Project: {activity.metadata.projectName}</span>}
                {activity.metadata.departmentName && <span> • Dept: {activity.metadata.departmentName}</span>}
                {activity.metadata.points && <span> • Points: {activity.metadata.points}</span>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ActivityLog;