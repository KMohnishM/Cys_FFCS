// setup-admin-client.js
// This script uses the client-side Firebase SDK to create admin users
// It can be run in a browser environment or with Node.js

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} = require('firebase/auth');
const { 
  getFirestore, 
  doc, 
  setDoc
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

// Admin credentials
const adminEmail = 'admin@vitstudent.ac.in';
const adminPassword = 'cyscom2025admin';
const adminName = 'Cyscom Admin';

// Super admin credentials
const superAdminEmail = 'superadmin@vitstudent.ac.in';
const superAdminPassword = 'cyscom2025superadmin';
const superAdminName = 'Cyscom Super Admin';

async function createUserIfNotExists(email, password, displayName, role) {
  console.log(`Creating/updating user: ${email}`);
  
  try {
    // Try to create the user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    console.log(`Created new user with UID: ${userId}`);
    
    // Create user document
    await setDoc(doc(db, 'users', userId), {
      userId: userId,
      name: displayName,
      email: email,
      role: role,
      departments: [],
      totalPoints: 0,
      projectId: null
    });
    
    console.log(`Created Firestore document for user: ${userId}`);
    return userId;
  } catch (error) {
    // If user already exists, try to sign in and update
    if (error.code === 'auth/email-already-in-use') {
      console.log(`User ${email} already exists, signing in to update`);
      
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        
        // Update the Firestore document
        await setDoc(doc(db, 'users', userId), {
          userId: userId,
          name: displayName,
          email: email,
          role: role,
          departments: [],
          totalPoints: 0,
          projectId: null
        }, { merge: true });
        
        console.log(`Updated Firestore document for user: ${userId}`);
        return userId;
      } catch (signInError) {
        console.error(`Error signing in as ${email}:`, signInError);
        throw signInError;
      }
    } else {
      console.error(`Error creating user ${email}:`, error);
      throw error;
    }
  }
}

async function setupAdmin() {
  try {
    // Create or update admin user
    const adminUid = await createUserIfNotExists(adminEmail, adminPassword, adminName, 'admin');
    
    // Create or update super admin user
    const superAdminUid = await createUserIfNotExists(superAdminEmail, superAdminPassword, superAdminName, 'superadmin');
    
    console.log('\nAdmin credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Role: admin`);
    
    console.log('\nSuper Admin credentials:');
    console.log(`Email: ${superAdminEmail}`);
    console.log(`Password: ${superAdminPassword}`);
    console.log(`Role: superadmin`);
    
    console.log('\nNote: In production, use more secure passwords!');
    console.log('Admin setup complete');
    
    // Sign out after setup
    await auth.signOut();
    
    return { adminUid, superAdminUid };
  } catch (error) {
    console.error('Error setting up admin users:', error);
    throw error;
  }
}

// Run the setup
setupAdmin()
  .then(() => {
    console.log('Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });