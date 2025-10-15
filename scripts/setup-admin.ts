import admin from 'firebase-admin';
import { initializeApp } from '../lib/firebase-admin';

// Admin credentials to create
const adminEmail = 'admin@vitstudent.ac.in';
const adminPassword = 'cyscom2025admin'; // Change this to a more secure password in production
const adminName = 'Cyscom Admin';

// Initialize Firebase Admin
const app = initializeApp();

const db = admin.firestore()

async function main() {
  console.log('Creating admin user...')
  
  try {
    // Check if admin user already exists
    let adminUid
    try {
      const userRecord = await admin.auth().getUserByEmail(adminEmail)
      adminUid = userRecord.uid
      console.log(`Admin user already exists with UID: ${adminUid}`)
      
      // Update password
      await admin.auth().updateUser(adminUid, {
        password: adminPassword,
        displayName: adminName
      })
      console.log('Admin user credentials updated')
    } catch (error) {
      // User does not exist, create new user
      const userRecord = await admin.auth().createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: adminName,
        emailVerified: true
      })
      adminUid = userRecord.uid
      console.log(`Created new admin user with UID: ${adminUid}`)
    }
    
    // Update or create Firestore user document with admin role
    await db.doc(`users/${adminUid}`).set({
      userId: adminUid,
      name: adminName,
      email: adminEmail,
      role: 'admin',
      departments: [],
      totalPoints: 0,
      projectId: null
    }, { merge: true })
    
    console.log('Admin Firestore document updated')
    
    // Create superadmin user as well
    const superAdminEmail = 'superadmin@vitstudent.ac.in'
    const superAdminPassword = 'cyscom2025superadmin'
    const superAdminName = 'Cyscom Super Admin'
    
    let superAdminUid
    try {
      const userRecord = await admin.auth().getUserByEmail(superAdminEmail)
      superAdminUid = userRecord.uid
      console.log(`Super admin user already exists with UID: ${superAdminUid}`)
      
      // Update password
      await admin.auth().updateUser(superAdminUid, {
        password: superAdminPassword,
        displayName: superAdminName
      })
      console.log('Super admin user credentials updated')
    } catch (error) {
      // User does not exist, create new user
      const userRecord = await admin.auth().createUser({
        email: superAdminEmail,
        password: superAdminPassword,
        displayName: superAdminName,
        emailVerified: true
      })
      superAdminUid = userRecord.uid
      console.log(`Created new super admin user with UID: ${superAdminUid}`)
    }
    
    // Update or create Firestore user document with superadmin role
    await db.doc(`users/${superAdminUid}`).set({
      userId: superAdminUid,
      name: superAdminName,
      email: superAdminEmail,
      role: 'superadmin',
      departments: [],
      totalPoints: 0,
      projectId: null
    }, { merge: true })
    
    console.log('Super admin Firestore document updated')
    
    console.log('\nAdmin credentials:')
    console.log(`Email: ${adminEmail}`)
    console.log(`Password: ${adminPassword}`)
    console.log(`Role: admin`)
    
    console.log('\nSuper Admin credentials:')
    console.log(`Email: ${superAdminEmail}`)
    console.log(`Password: ${superAdminPassword}`)
    console.log(`Role: superadmin`)
    
    console.log('\nNote: In production, use more secure passwords!')
  } catch (error) {
    console.error('Error creating admin users:', error)
    process.exit(1)
  }
}

main()
  .then(() => {
    console.log('Admin setup complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })