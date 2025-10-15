import admin from 'firebase-admin';
import { initializeApp } from '../lib/firebase-admin';

// Initialize Firebase Admin
const app = initializeApp();
const db = admin.firestore();

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

// Function to add projects to Firestore
async function addProjects() {
  try {
    console.log('Deleting existing projects...');
    
    // Get all existing projects
    const existingProjectsSnapshot = await db.collection('projects').get();
    
    // Delete them in batches
    const batchSize = 500; // Firestore can delete 500 documents in a single batch
    const batches: admin.firestore.WriteBatch[] = [];
    
    let currentBatch = db.batch();
    let operationCounter = 0;
    
    existingProjectsSnapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref);
      operationCounter++;
      
      if (operationCounter >= batchSize) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCounter = 0;
      }
    });
    
    // Push the last batch if it has operations
    if (operationCounter > 0) {
      batches.push(currentBatch);
    }
    
    // Commit all batches
    await Promise.all(batches.map(batch => batch.commit()));
    
    console.log(`Deleted ${existingProjectsSnapshot.size} existing projects`);
    
    // Add new projects
    console.log('Adding new projects...');
    for (const project of projects) {
      await db.collection('projects').add({
        ...project,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log(`Successfully added ${projects.length} projects`);
    process.exit(0);
  } catch (error) {
    console.error('Error adding projects:', error);
    process.exit(1);
  }
}

// Run the function
addProjects();