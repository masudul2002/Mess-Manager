// firebase-config.js
// Centralized Firebase initialization - loaded ONCE before all other scripts

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdJ8RtMIQFyOSl-5vKHPZa_pXRUr356wt",
  authDomain: "sstu-afafouse.firebaseapp.com",
  projectId: "sstu-gefav-house",
  storageBucket: "sstu-gfafafse.firebasestorage.app",
  messagingSenderId: "93sffafaf57",
  appId: "1:935427308657:web:e5748c53afawr5f5cafd0",
  measurementId: "G-MDSKHKQ"
};

// Initialize Firebase ONCE (Main App)
let app;
try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
}

// Export initialized services for the MAIN app
export const auth = getAuth(app);
export const db = getFirestore(app);

// Also attach to window for backward compatibility
window.auth = auth;
window.db = db;


// --- FIX for Add User Bug ---
// This function creates a temporary, secondary Firebase app.
// We use this to create a new user without logging the manager out.
export async function createAuthApp() {
    let secondaryApp;
    try {
        // Use a unique name for the secondary app
        secondaryApp = initializeApp(firebaseConfig, 'mess-manager-auth-worker');
        const authInstance = getAuth(secondaryApp);
        
        // Function to clean up the secondary app
        const cleanup = async () => {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
                console.log('✅ Secondary auth app cleaned up.');
            }
        };

        return { authInstance, cleanup };

    } catch (error) {
        console.error('❌ Error creating secondary auth app:', error);
        if (secondaryApp) {
            await deleteApp(secondaryApp); // Clean up on error
        }
        throw error;
    }
}
