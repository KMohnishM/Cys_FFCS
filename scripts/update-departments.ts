/*
  Update departments script - run this to update departments with club names
  Usage: npm run update-departments
*/
import admin from 'firebase-admin';
import { initializeApp } from '../lib/firebase-admin';

// Initialize Firebase Admin
const app = initializeApp();
const db = admin.firestore();

async function main(){
  try {
    // Delete all existing departments
    const deptSnapshot = await db.collection('departments').get()
    const batch = db.batch()
    
    // Mark old departments for deletion
    deptSnapshot.docs.forEach(doc => {
      console.log(`Marking for deletion: ${doc.id}`)
      batch.delete(doc.ref)
    })
    
    // Create new departments
    const departments = [
      {deptId:'technical', name:'Technical', capacity:30, filledCount:0},
      {deptId:'development', name:'Development', capacity:20, filledCount:0},
      {deptId:'events', name:'Events', capacity:25, filledCount:0},
      {deptId:'social', name:'Social Media', capacity:20, filledCount:0},
      {deptId:'content', name:'Content', capacity:10, filledCount:0},
      {deptId:'design', name:'Design', capacity:15, filledCount:0},
    ]
    
    // Add new departments
    for(const d of departments){
      const deptRef = db.doc(`departments/${d.deptId}`)
      batch.set(deptRef, {
        name: d.name,
        capacity: d.capacity,
        filledCount: d.filledCount
      })
      console.log(`Creating department: ${d.name} with capacity: ${d.capacity}`)
    }
    
    // Commit the batch
    await batch.commit()
    
    console.log('Successfully updated departments')

    // Update project departments
    const projectsSnapshot = await db.collection('projects').get()
    const projectBatch = db.batch()
    
    // Club departments
    const deptIds = departments.map(d => d.deptId)
    
    // Update each project with a club department
    projectsSnapshot.docs.forEach((doc, index) => {
      const dept = deptIds[index % deptIds.length]
      projectBatch.update(doc.ref, { department: dept })
      console.log(`Updated project ${doc.id} with department: ${dept}`)
    })
    
    await projectBatch.commit()
    console.log('Successfully updated project departments')
    
    // Reset user department selections to allow users to choose again
    const usersSnapshot = await db.collection('users').get()
    const userBatch = db.batch()
    
    usersSnapshot.docs.forEach(doc => {
      userBatch.update(doc.ref, { departments: [] })
      console.log(`Reset departments for user: ${doc.id}`)
    })
    
    await userBatch.commit()
    console.log('Successfully reset user department selections')
    
    return true
  } catch (error) {
    console.error('Error updating departments:', error)
    return false
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })