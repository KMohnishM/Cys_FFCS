// update-departments-client.js
// This script uses the client-side Firebase SDK to update departments
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
  query,
  limit
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

// Club department data
const departments = [
  {deptId:'technical', name:'Technical', capacity:30, filledCount:0},
  {deptId:'development', name:'Development', capacity:20, filledCount:0},
  {deptId:'events', name:'Events', capacity:25, filledCount:0},
  {deptId:'social', name:'Social Media', capacity:20, filledCount:0},
  {deptId:'content', name:'Content', capacity:10, filledCount:0},
  {deptId:'design', name:'Design', capacity:15, filledCount:0},
];

async function updateDepartments() {
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
    
    console.log("Starting department update...");
    
    // Delete all existing departments
    const deptSnapshot = await getDocs(collection(db, 'departments'));
    
    const batch = writeBatch(db);
    
    // Mark old departments for deletion
    deptSnapshot.forEach(doc => {
      console.log(`Marking for deletion: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    // Add new departments
    for(const d of departments){
      const deptRef = doc(db, 'departments', d.deptId);
      batch.set(deptRef, {
        name: d.name,
        capacity: d.capacity,
        filledCount: d.filledCount
      });
      console.log(`Creating department: ${d.name} with capacity: ${d.capacity}`);
    }
    
    // Commit the batch
    await batch.commit();
    console.log('Successfully updated departments');

    // Update project departments
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    const projectBatch = writeBatch(db);
    
    // Club departments
    const deptIds = departments.map(d => d.deptId);
    
    // Update each project with a club department
    let index = 0;
    projectsSnapshot.forEach((doc) => {
      const dept = deptIds[index % deptIds.length];
      projectBatch.update(doc.ref, { department: dept });
      console.log(`Updated project ${doc.id} with department: ${dept}`);
      index++;
    });
    
    await projectBatch.commit();
    console.log('Successfully updated project departments');
    
    // Reset user department selections to allow users to choose again
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const userBatch = writeBatch(db);
    
    usersSnapshot.forEach(doc => {
      userBatch.update(doc.ref, { departments: [] });
      console.log(`Reset departments for user: ${doc.id}`);
    });
    
    await userBatch.commit();
    console.log('Successfully reset user department selections');
    
    // Sign out after completion
    await auth.signOut();
    console.log('Signed out');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating departments:', error);
    throw error;
  }
}

// Run the update
updateDepartments()
  .then(() => {
    console.log('Department update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Department update failed:', error);
    process.exit(1);
  });