import { useEffect, useState } from 'react';
import { getAuthClient, getDbClient } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Hook for tracking user presence in the app
 */
export const usePresenceTracking = () => {
  const [isSetup, setIsSetup] = useState(false);
  
  useEffect(() => {
    const auth = getAuthClient();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // User is signed out, no presence to track
        setIsSetup(false);
        return;
      }
      
      // User is signed in, track their presence
      try {
        const db = getDbClient();
        const uid = user.uid;
        
        // Reference to this user's presence document
        const userStatusRef = doc(db, 'presence', uid);
        
        // Create a reference to the Realtime Database where online/offline status is stored
        const isOfflineData = {
          status: 'offline',
          lastActive: serverTimestamp(),
          displayName: user.displayName || 'Anonymous User',
          email: user.email || null,
          photoURL: user.photoURL || null
        };
        
        const isOnlineData = {
          status: 'online',
          lastActive: serverTimestamp(),
          displayName: user.displayName || 'Anonymous User',
          email: user.email || null,
          photoURL: user.photoURL || null
        };
        
        // Create or update the document with online status
        await setDoc(userStatusRef, isOnlineData);
        
        // Note: Firebase Web SDK doesn't support onDisconnect for Firestore directly
        // We'll rely on the periodic updates instead
        
        // Set up an interval to update the lastActive timestamp periodically while online
        const intervalId = setInterval(async () => {
          try {
            await setDoc(userStatusRef, {
              ...isOnlineData,
              lastActive: serverTimestamp()
            }, { merge: true });
          } catch (error) {
            console.error('Error updating presence timestamp:', error);
          }
        }, 60000); // Update every minute
        
        setIsSetup(true);
        
        // Cleanup
        return () => {
          clearInterval(intervalId);
        };
        
      } catch (error) {
        console.error('Error setting up presence tracking:', error);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return { isSetup };
};

/**
 * Component for tracking user presence
 */
export const PresenceTracker: React.FC = () => {
  usePresenceTracking();
  return null; // This component doesn't render anything
};

export default PresenceTracker;