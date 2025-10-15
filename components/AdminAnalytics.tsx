import React, { useEffect, useState } from 'react';
import { getDbClient } from '../lib/firebase';
import { collection, query, getDocs, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { getActiveUsersCount, onActiveUsersCountChange } from '../lib/analytics';
import ActivityLog from './ActivityLog';
import AnalyticsCharts from './AnalyticsCharts';

interface DepartmentAnalytics {
  deptId: string;
  name: string;
  capacity: number;
  filledCount: number;
  fillPercentage: number;
}

interface ProjectAnalytics {
  projectId: string;
  name: string;
  department: string;
  memberCount: number;
  maxMembers: number;
  contributionCount: number;
}

interface UserActivity {
  userId: string;
  displayName: string;
  email: string;
  lastActive: Date;
  status: 'online' | 'offline';
}

const AdminAnalytics: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [departments, setDepartments] = useState<DepartmentAnalytics[]>([]);
  const [projects, setProjects] = useState<ProjectAnalytics[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserActivity[]>([]);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [pendingContributions, setPendingContributions] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Get active users count and set up real-time listener
    const unsubscribe = onActiveUsersCountChange(count => {
      setActiveUsers(count);
    });

    loadAnalytics();

    return () => {
      unsubscribe();
    };
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const db = getDbClient();

      // Load departments
      const deptQuery = query(collection(db, 'departments'));
      const deptSnapshot = await getDocs(deptQuery);
      const deptData: DepartmentAnalytics[] = [];

      deptSnapshot.forEach(doc => {
        const data = doc.data();
        deptData.push({
          deptId: doc.id,
          name: data.name || 'Unknown Department',
          capacity: data.capacity || 0,
          filledCount: data.filledCount || 0,
          fillPercentage: data.capacity > 0 ? (data.filledCount / data.capacity) * 100 : 0
        });
      });
      setDepartments(deptData);

      // Load projects
      const projectQuery = query(collection(db, 'projects'));
      const projectSnapshot = await getDocs(projectQuery);
      const projectData: ProjectAnalytics[] = [];

      projectSnapshot.forEach(doc => {
        const data = doc.data();
        projectData.push({
          projectId: doc.id,
          name: data.name || 'Unknown Project',
          department: data.departmentId || 'Unknown',
          memberCount: (data.members || []).length,
          maxMembers: data.maxMembers || 4,
          contributionCount: data.contributionCount || 0
        });
      });
      setProjects(projectData);

      // Count all users
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      setTotalUsers(usersSnapshot.size);

      // Get recent active users
      const presenceQuery = query(
        collection(db, 'presence'),
        orderBy('lastActive', 'desc'),
        limit(10)
      );
      
      const presenceSnapshot = await getDocs(presenceQuery);
      const recentUsersData: UserActivity[] = [];
      
      presenceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.lastActive) {
          recentUsersData.push({
            userId: doc.id,
            displayName: data.displayName || 'Anonymous User',
            email: data.email || '',
            lastActive: data.lastActive.toDate(),
            status: data.status || 'offline'
          });
        }
      });
      setRecentUsers(recentUsersData);

      // Count contributions
      const contribQuery = query(collection(db, 'contributions'));
      const contribSnapshot = await getDocs(contribQuery);
      setTotalContributions(contribSnapshot.size);

      // Count pending contributions
      const pendingQuery = query(
        collection(db, 'contributions'),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      setPendingContributions(pendingSnapshot.size);

      setLoading(false);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setLoading(false);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSecs < 60) {
      return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-black/30 rounded-lg animate-pulse">
        <div className="h-8 w-2/3 bg-cyberdark-700 rounded mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-cyberdark-700 rounded"></div>
          <div className="h-24 bg-cyberdark-700 rounded"></div>
          <div className="h-24 bg-cyberdark-700 rounded"></div>
          <div className="h-24 bg-cyberdark-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-medium text-white mb-4 border-b border-cyscom/30 pb-2">
        Dashboard Analytics
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Active Users Stat */}
        <div className="bg-black/30 rounded-lg p-4 border border-cyscom/20 hover:border-cyscom/40 transition-all hover:animate-glow">
          <div className="flex justify-between items-center">
            <h4 className="text-cyscom font-medium">Active Users</h4>
            <div className="w-8 h-8 rounded-full bg-cyscom/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyscom" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-white">{activeUsers}</div>
            <div className="text-xs text-slate-400">out of {totalUsers} total users</div>
          </div>
        </div>

        {/* Department Fill Rate */}
        <div className="bg-black/30 rounded-lg p-4 border border-cyscom/20 hover:border-cyscom/40 transition-all hover:animate-glow">
          <div className="flex justify-between items-center">
            <h4 className="text-cyscom font-medium">Department Fill Rate</h4>
            <div className="w-8 h-8 rounded-full bg-cyscom/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyscom" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-white">
              {departments.length > 0
                ? Math.round(
                    (departments.reduce((sum, dept) => sum + dept.filledCount, 0) /
                      departments.reduce((sum, dept) => sum + dept.capacity, 0)) *
                      100
                  )
                : 0}%
            </div>
            <div className="text-xs text-slate-400">overall capacity utilization</div>
          </div>
        </div>

        {/* Projects Status */}
        <div className="bg-black/30 rounded-lg p-4 border border-cyscom/20 hover:border-cyscom/40 transition-all hover:animate-glow">
          <div className="flex justify-between items-center">
            <h4 className="text-cyscom font-medium">Projects</h4>
            <div className="w-8 h-8 rounded-full bg-cyscom/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyscom" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-white">{projects.length}</div>
            <div className="text-xs text-slate-400">active projects</div>
          </div>
        </div>

        {/* Contributions */}
        <div className="bg-black/30 rounded-lg p-4 border border-cyscom/20 hover:border-cyscom/40 transition-all hover:animate-glow">
          <div className="flex justify-between items-center">
            <h4 className="text-cyscom font-medium">Contributions</h4>
            <div className="w-8 h-8 rounded-full bg-cyscom/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyscom" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-white">{totalContributions}</div>
            <div className="text-xs text-slate-400">
              {pendingContributions > 0 ? (
                <span className="text-amber-400">{pendingContributions} pending review</span>
              ) : (
                'all contributions reviewed'
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Breakdown */}
        <div className="bg-black/30 rounded-lg p-4 border border-cyscom/20">
          <h3 className="text-lg font-medium text-cyscom mb-3">Department Distribution</h3>
          
          <div className="mb-4">
            <AnalyticsCharts 
              type="bar"
              data={departments.map(dept => ({
                label: dept.name,
                value: dept.filledCount,
                color: dept.fillPercentage > 90 
                  ? 'bg-red-500' 
                  : dept.fillPercentage > 70 
                    ? 'bg-amber-500' 
                    : 'bg-green-500'
              }))}
            />
          </div>
          
          <div className="space-y-3">
            {departments.map((dept) => (
              <div key={dept.deptId}>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white">{dept.name}</span>
                  <span className="text-slate-300">
                    {dept.filledCount}/{dept.capacity}
                  </span>
                </div>
                <div className="w-full bg-cyberdark-700 rounded-full h-2 mt-1 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      dept.fillPercentage > 90 ? 'bg-red-500' : dept.fillPercentage > 70 ? 'bg-amber-500' : 'bg-green-500'
                    } animate-pulse-slow`}
                    style={{ width: `${Math.min(100, dept.fillPercentage)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Activity */}
        <div className="bg-black/30 rounded-lg p-4 overflow-hidden">
          <h3 className="text-lg font-medium text-cyscom mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
            User Activity Log
          </h3>
          
          <ActivityLog limitCount={8} />
          
          <h3 className="text-lg font-medium text-cyscom mb-3 mt-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
            Online Users
          </h3>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 cyber-scrollbar">
            {recentUsers.filter(user => user.status === 'online').map((user) => (
              <div key={user.userId} className="flex items-center space-x-3 p-2 rounded bg-black/20">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{user.displayName}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <div className="text-xs text-slate-400">{getTimeAgo(user.lastActive)}</div>
              </div>
            ))}
            {recentUsers.filter(user => user.status === 'online').length === 0 && (
              <div className="text-center text-slate-500 py-2">No users online</div>
            )}
          </div>
        </div>

        {/* Project Status */}
        <div className="bg-black/30 rounded-lg p-4">
          <h3 className="text-lg font-medium text-cyscom mb-3">Project Status</h3>
          
          <div className="mb-4">
            <AnalyticsCharts
              type="pie"
              title="Project Enrollment"
              data={projects.slice(0, 5).map(project => ({
                label: project.name,
                value: project.memberCount
              }))}
            />
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2 cyber-scrollbar">
            {projects.slice(0, 5).map((project) => (
              <div key={project.projectId} className="p-2 rounded bg-black/20">
                <div className="flex justify-between">
                  <p className="text-sm text-white font-medium">{project.name}</p>
                  <span className="text-xs bg-cyscom/20 text-cyscom px-2 rounded-full">
                    {project.memberCount}/{project.maxMembers}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {project.contributionCount} contribution{project.contributionCount !== 1 ? 's' : ''}
                </p>
                {/* Member fill bar */}
                <div className="w-full bg-cyberdark-700 rounded-full h-1.5 mt-2">
                  <div
                    className="h-1.5 rounded-full bg-cyscom animate-pulse-slow"
                    style={{ width: `${(project.memberCount / project.maxMembers) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-center text-slate-500 py-2">No projects available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;