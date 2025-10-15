// Updated updateDepartmentsForClient.js - to run in the client browser
// This script can be added to the dashboard page for easy execution

async function updateDepartments() {
  const db = firebase.firestore();
  
  try {
    console.log("Starting department update...");
    
    // Delete all existing departments
    const deptSnapshot = await db.collection('departments').get();
    const batch = db.batch();
    
    // Mark old departments for deletion
    deptSnapshot.docs.forEach(doc => {
      console.log(`Marking for deletion: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    // Create new departments
    const departments = [
      {deptId:'technical', name:'Technical', capacity:30, filledCount:0},
      {deptId:'development', name:'Development', capacity:20, filledCount:0},
      {deptId:'events', name:'Events', capacity:25, filledCount:0},
      {deptId:'social', name:'Social Media', capacity:20, filledCount:0},
      {deptId:'content', name:'Content', capacity:10, filledCount:0},
      {deptId:'design', name:'Design', capacity:15, filledCount:0},
    ];
    
    // Add new departments
    for(const d of departments){
      const deptRef = db.doc(`departments/${d.deptId}`);
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
    const projectsSnapshot = await db.collection('projects').get();
    const projectBatch = db.batch();
    
    // Club departments
    const deptIds = departments.map(d => d.deptId);
    
    // Update each project with a club department
    projectsSnapshot.docs.forEach((doc, index) => {
      const dept = deptIds[index % deptIds.length];
      projectBatch.update(doc.ref, { department: dept });
      console.log(`Updated project ${doc.id} with department: ${dept}`);
    });
    
    await projectBatch.commit();
    console.log('Successfully updated project departments');
    
    // Reset user department selections to allow users to choose again
    const usersSnapshot = await db.collection('users').get();
    const userBatch = db.batch();
    
    usersSnapshot.docs.forEach(doc => {
      userBatch.update(doc.ref, { departments: [] });
      console.log(`Reset departments for user: ${doc.id}`);
    });
    
    await userBatch.commit();
    console.log('Successfully reset user department selections');
    
    alert("Departments successfully updated!");
  } catch (error) {
    console.error('Error updating departments:', error);
    alert("Error updating departments: " + error.message);
  }
}

// Execute the function when button is clicked
document.getElementById('update-departments-btn')?.addEventListener('click', updateDepartments);

// Add projects function
async function addProjects() {
  const db = firebase.firestore();
  
  try {
    console.log('Deleting existing projects...');
    
    // Get all existing projects
    const existingProjectsSnapshot = await db.collection('projects').get();
    const batch = db.batch();
    let operationCounter = 0;
    
    // Mark projects for deletion
    existingProjectsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      operationCounter++;
      
      if (operationCounter >= 500) {
        batch.commit();
        batch = db.batch();
        operationCounter = 0;
      }
    });
    
    // Commit any remaining deletions
    if (operationCounter > 0) {
      await batch.commit();
    }
    
    console.log(`Deleted ${existingProjectsSnapshot.size} existing projects`);
    
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
    
    // Add new projects in batches
    let projectBatch = db.batch();
    let projectCounter = 0;
    
    for (const project of projects) {
      const projectRef = db.collection('projects').doc();
      projectBatch.set(projectRef, {
        ...project,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      projectCounter++;
      
      if (projectCounter >= 500) {
        await projectBatch.commit();
        projectBatch = db.batch();
        projectCounter = 0;
      }
    }
    
    // Commit any remaining projects
    if (projectCounter > 0) {
      await projectBatch.commit();
    }
    
    console.log(`Successfully added ${projects.length} projects`);
    alert("Projects successfully added!");
  } catch (error) {
    console.error('Error adding projects:', error);
    alert("Error adding projects: " + error.message);
  }
}

// Execute the function when button is clicked
document.getElementById('add-projects-btn')?.addEventListener('click', addProjects);

// Setup Admin
// Make setupAdmin available globally for the setup page
window.setupAdmin = async function setupAdmin() {
  const db = firebase.firestore();
  const auth = firebase.auth();
  
  try {
    // Admin credentials
    const adminEmail = 'admin@vitstudent.ac.in';
    const adminPassword = 'cyscom2025admin';
    const adminName = 'Cyscom Admin';
    
    // Create admin user
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
      const adminUid = userCredential.user.uid;
      
      // Update profile
      await userCredential.user.updateProfile({
        displayName: adminName
      });
      
      console.log(`Created admin user: ${adminUid}`);
      
      // Create admin document
      await db.doc(`users/${adminUid}`).set({
        userId: adminUid,
        name: adminName,
        email: adminEmail,
        role: 'admin',
        departments: [],
        totalPoints: 0,
        projectId: null
      });
      
      console.log('Admin document created');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('Admin user already exists, signing in to update...');
        
        // Sign in as admin
        const userCredential = await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
        const adminUid = userCredential.user.uid;
        
        // Update admin document
        await db.doc(`users/${adminUid}`).set({
          userId: adminUid,
          name: adminName,
          email: adminEmail,
          role: 'admin',
          departments: [],
          totalPoints: 0,
          projectId: null
        }, { merge: true });
        
        console.log('Admin document updated');
      } else {
        throw error;
      }
    }
    
    // Create superadmin user
    const superAdminEmail = 'superadmin@vitstudent.ac.in';
    const superAdminPassword = 'cyscom2025superadmin';
    const superAdminName = 'Cyscom Super Admin';
    
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(superAdminEmail, superAdminPassword);
      const superAdminUid = userCredential.user.uid;
      
      // Update profile
      await userCredential.user.updateProfile({
        displayName: superAdminName
      });
      
      console.log(`Created super admin user: ${superAdminUid}`);
      
      // Create super admin document
      await db.doc(`users/${superAdminUid}`).set({
        userId: superAdminUid,
        name: superAdminName,
        email: superAdminEmail,
        role: 'superadmin',
        departments: [],
        totalPoints: 0,
        projectId: null
      });
      
      console.log('Super admin document created');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('Super admin user already exists, signing in to update...');
        
        // Sign in as super admin
        const userCredential = await auth.signInWithEmailAndPassword(superAdminEmail, superAdminPassword);
        const superAdminUid = userCredential.user.uid;
        
        // Update super admin document
        await db.doc(`users/${superAdminUid}`).set({
          userId: superAdminUid,
          name: superAdminName,
          email: superAdminEmail,
          role: 'superadmin',
          departments: [],
          totalPoints: 0,
          projectId: null
        }, { merge: true });
        
        console.log('Super admin document updated');
      } else {
        throw error;
      }
    }
    
    alert("Admin users created/updated successfully!\n\nAdmin credentials:\nEmail: admin@vitstudent.ac.in\nPassword: cyscom2025admin\n\nSuper Admin credentials:\nEmail: superadmin@vitstudent.ac.in\nPassword: cyscom2025superadmin");
  } catch (error) {
    console.error('Error setting up admin users:', error);
    alert("Error setting up admin users: " + error.message);
  }
}

// Execute the function when button is clicked
document.getElementById('setup-admin-btn')?.addEventListener('click', setupAdmin);