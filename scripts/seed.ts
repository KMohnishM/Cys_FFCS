/*
  Seed script using Firebase Admin SDK.
  Usage: npm run seed
*/
import admin from 'firebase-admin';
import { initializeApp } from '../lib/firebase-admin';

// Initialize Firebase Admin
const app = initializeApp();
const db = admin.firestore();

async function main(){
  const departments = [
    {deptId:'technical', name:'Technical', capacity:30, filledCount:0},
    {deptId:'development', name:'Development', capacity:20, filledCount:0},
    {deptId:'events', name:'Events', capacity:25, filledCount:0},
    {deptId:'social', name:'Social Media', capacity:20, filledCount:0},
    {deptId:'content', name:'Content', capacity:10, filledCount:0},
    {deptId:'design', name:'Design', capacity:15, filledCount:0},
  ]

  for(const d of departments){
    await db.doc(`departments/${d.deptId}`).set({name:d.name,capacity:d.capacity,filledCount:0})
    console.log('seeded department', d.deptId)
  }

  const projects = new Array(15).fill(null).map((_,i)=>({projectId:`p${i+1}`,name:`Project ${i+1}`,description:`Sample project ${i+1}`}))
  // assign departments to projects round-robin
  const deptIds = departments.map(d=>d.deptId)
  for(const [idx,p] of projects.entries()){
    const dept = deptIds[idx % deptIds.length]
    await db.doc(`projects/${p.projectId}`).set({name:p.name,description:p.description,members:[],department:dept})
    console.log('seeded project', p.projectId, 'dept', dept)
  }

  // Optionally create an auth user for superadmin if email+password provided
  let superAdminUid = process.env.SUPERADMIN_UID || ''
  const superEmail = process.env.SUPERADMIN_EMAIL
  const superPass = process.env.SUPERADMIN_PASSWORD
  if (superEmail && superPass) {
    try {
      // try to find existing user
      const u = await admin.auth().getUserByEmail(superEmail)
      superAdminUid = u.uid
      console.log('found existing auth user for superadmin', superAdminUid)
    } catch (err) {
      // not found -> create
      const created = await admin.auth().createUser({ email: superEmail, password: superPass, displayName: 'Super Admin' })
      superAdminUid = created.uid
      console.log('created auth user for superadmin', superAdminUid)
    }
  }

  if (!superAdminUid) {
    superAdminUid = 'superadmin'
    console.log('No superadmin auth created; using fallback uid:', superAdminUid)
  }

  // create users collection entries (including superadmin)
  const users = [
    { userId: superAdminUid, name: 'Super Admin', email: superEmail || 'admin@vitstudent.ac.in', role: 'superadmin', departments: [], totalPoints: 0, projectId: null },
  ]
  // create a few sample users
  for (let i = 1; i <= 5; i++) {
    users.push({ userId: `u${i}`, name: `Student ${i}`, email: `student${i}@vitstudent.ac.in`, role: 'member', departments: [], totalPoints: Math.floor(Math.random()*50), projectId: null })
  }
  for (const u of users) {
    await db.doc(`users/${u.userId}`).set(u)
    console.log('seeded user', u.userId)
  }

  // sample contributions
  const contribs = []
  for (let i = 1; i <= 8; i++) {
    contribs.push({
      title: `Contribution ${i}`,
      description: `This is a sample contribution ${i}`,
      userId: users[i % users.length].userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      imagePath: null,
    })
  }
  for (const c of contribs) {
    const ref = await db.collection('contributions').add(c)
    console.log('seeded contribution', ref.id)
  }

  // sample reviews
  for (let i = 1; i <= 5; i++) {
    await db.collection('reviews').add({
      projectId: `p${(i%15)+1}`,
      userId: users[(i%users.length)].userId,
      rating: Math.ceil(Math.random()*5),
      comment: `Sample review ${i}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log('seeded review', i)
  }

  console.log('seeded superadmin user doc (ensure auth user exists with same uid if applicable)')
}

main().then(()=>{console.log('Done');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})
