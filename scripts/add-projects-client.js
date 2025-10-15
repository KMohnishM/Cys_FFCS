// add-projects-client.js
// This script uses the client-side Firebase SDK to add projects
// It can be run in a browser environment or with Node.js

const { initializeApp } = require('firebase/app');
const { 
  getAuth,
  signInWithEmailAndPassword 
} = require('firebase/auth');
const { 
  getFirestore, 
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp
} = require('firebase/firestore');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin credentials for authentication
const adminEmail = 'admin@vitstudent.ac.in';
const adminPassword = 'cyscom2025admin';

// Sample projects data by department
const projects = [
  // Technical Department
  {
    name: 'Security CTF Framework',
    description: 'Develop a Capture The Flag framework for cybersecurity practice with challenges in web exploitation, cryptography, reverse engineering, and binary exploitation.',
    department: 'technical',
    members: []
  },
  {
    name: 'Network Monitoring System',
    description: 'Create a network monitoring tool that can detect intrusions, analyze traffic patterns, and visualize network data for security analysis.',
    department: 'technical',
    members: []
  },
  
  // Development Department
  {
    name: 'Club Management Portal',
    description: 'Enhance the existing club management portal with new features for event tracking, member progress, and resource management.',
    department: 'development',
    members: []
  },
  {
    name: 'Mobile App Development',
    description: 'Create a cross-platform mobile application for club members to access resources, register for events, and receive notifications.',
    department: 'development',
    members: []
  },
  
  // Events Department
  {
    name: 'Hackathon Planning',
    description: 'Organize and execute a 24-hour hackathon event including theme selection, sponsor outreach, logistics, and judging criteria.',
    department: 'events',
    members: []
  },
  {
    name: 'Tech Workshop Series',
    description: 'Develop a series of hands-on technical workshops covering topics like web security, penetration testing, and secure coding practices.',
    department: 'events',
    members: []
  },
  
  // Social Media Department
  {
    name: 'Club Branding Campaign',
    description: 'Create a comprehensive social media strategy to improve the club\'s online presence and engagement across platforms.',
    department: 'social',
    members: []
  },
  {
    name: 'Digital Marketing Analytics',
    description: 'Implement tracking and analytics for club social media accounts to measure engagement and optimize content strategy.',
    department: 'social',
    members: []
  },
  
  // Content Department
  {
    name: 'Technical Blog Series',
    description: 'Create a series of technical blog posts about cybersecurity topics, including tutorials, tool reviews, and industry trends.',
    department: 'content',
    members: []
  },
  {
    name: 'Video Tutorial Series',
    description: 'Produce educational video content explaining cybersecurity concepts and demonstrating security tools for beginners.',
    department: 'content',
    members: []
  },
  
  // Design Department
  {
    name: 'Event Poster Templates',
    description: 'Design a set of poster and promotional material templates for various club events that maintain brand consistency.',
    department: 'design',
    members: []
  },
  {
    name: 'UI/UX Design for Club Website',
    description: 'Redesign the club website with improved user experience, modern aesthetics, and mobile responsiveness.',
    department: 'design',
    members: []
  },
];

async function addProjects() {
  try {
    // Sign in as admin
    console.log(`Signing in as admin (${adminEmail})`);
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      console.log('Signed in successfully as admin');
    } catch (error) {
      console.error('Admin sign-in failed:', error);
      console.log('Please run setup-admin-client first to create admin users');
      throw new Error('Admin authentication failed. Run setup-admin-client first.');
    }
    
    console.log('Deleting existing projects...');
    
    // Get all existing projects
    const existingProjectsSnapshot = await getDocs(collection(db, 'projects'));
    
    let batch = writeBatch(db);
    let operationCounter = 0;
    const BATCH_LIMIT = 500;
    
    // Mark projects for deletion
    existingProjectsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      operationCounter++;
      
      if (operationCounter >= BATCH_LIMIT) {
        console.log(`Committing batch of ${operationCounter} deletions...`);
        batch.commit();
        batch = writeBatch(db);
        operationCounter = 0;
      }
    });
    
    // Commit any remaining deletions
    if (operationCounter > 0) {
      console.log(`Committing final batch of ${operationCounter} deletions...`);
      await batch.commit();
    }
    
    console.log(`Deleted ${existingProjectsSnapshot.size} existing projects`);
    
    // Add new projects in batches
    batch = writeBatch(db);
    operationCounter = 0;
    
    for (const project of projects) {
      const projectRef = doc(collection(db, 'projects'));
      batch.set(projectRef, {
        ...project,
        createdAt: serverTimestamp()
      });
      operationCounter++;
      console.log(`Adding project: ${project.name} (${project.department})`);
      
      if (operationCounter >= BATCH_LIMIT) {
        console.log(`Committing batch of ${operationCounter} projects...`);
        await batch.commit();
        batch = writeBatch(db);
        operationCounter = 0;
      }
    }
    
    // Commit any remaining projects
    if (operationCounter > 0) {
      console.log(`Committing final batch of ${operationCounter} projects...`);
      await batch.commit();
    }
    
    console.log(`Successfully added ${projects.length} projects`);
    
    // Sign out after completion
    await auth.signOut();
    console.log('Signed out');
    
    return { success: true };
  } catch (error) {
    console.error('Error adding projects:', error);
    throw error;
  }
}

// Run the update
addProjects()
  .then(() => {
    console.log('Project addition complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Project addition failed:', error);
    process.exit(1);
  });