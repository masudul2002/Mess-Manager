// auth.js - Fixed authentication without infinite loops

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail // --- NEW: Import password reset function ---
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ========== UI HELPER FUNCTIONS ==========

function showLoading(show = true) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function hideMessages() {
  const errorEl = document.getElementById('authError');
  const successEl = document.getElementById('authSuccess');
  if (errorEl) errorEl.style.display = 'none';
  if (successEl) successEl.style.display = 'none';
}

function showError(message) {
  hideMessages();
  const errorEl = document.getElementById('authError');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

function showSuccess(message) {
  hideMessages();
  const successEl = document.getElementById('authSuccess');
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
  }
}

// ========== FORM SWITCHING ==========

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const passwordResetForm = document.getElementById('passwordResetForm'); // --- NEW ---

const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');
const showResetPassword = document.getElementById('showResetPassword'); // --- NEW ---
const showLoginFromReset = document.getElementById('showLoginFromReset'); // --- NEW ---

// Helper to switch between forms
function showForm(formToShow) {
    loginForm.classList.remove('active');
    signupForm.classList.remove('active');
    passwordResetForm.classList.remove('active');
    formToShow.classList.add('active');
    hideMessages();
}

if (showSignupLink) {
  showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(signupForm);
  });
}

if (showLoginLink) {
  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(loginForm);
  });
}

// --- NEW Listeners for Password Reset ---
if (showResetPassword) {
    showResetPassword.addEventListener('click', (e) => {
        e.preventDefault();
        showForm(passwordResetForm);
    });
}

if (showLoginFromReset) {
    showLoginFromReset.addEventListener('click', (e) => {
        e.preventDefault();
        showForm(loginForm);
    });
}
// --- END NEW Listeners ---


// ========== EMAIL/PASSWORD LOGIN ==========

const loginFormElement = document.getElementById('loginFormElement');
if (loginFormElement) {
  loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(window.auth, email, password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(window.db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // --- NEW STATUS CHECK ---
        if (userData.status === 'pending') {
          showError('Your account is pending approval from a manager.');
          await signOut(window.auth);
        } else if (userData.status === 'approved') {
          showSuccess('Login successful! Redirecting...');
          setTimeout(() => {
            window.location.href = userData.role === 'manager' ? 'manager.html' : 'user.html';
          }, 500);
        } else {
          showError('Your account status is unknown. Please contact an administrator.');
          await signOut(window.auth);
        }
        // --- END NEW STATUS CHECK ---
        
      } else {
        showError('User data not found. Please contact an administrator.');
        await signOut(window.auth);
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      showError(errorMessage);
    } finally {
      showLoading(false);
    }
  });
}

// ========== EMAIL/PASSWORD SIGNUP ==========

const signupFormElement = document.getElementById('signupFormElement');
if (signupFormElement) {
  signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    if (!name || !email || !password) {
      showError('Please fill all fields');
      return;
    }
    
    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }
    
    showLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(window.db, 'users', user.uid), {
        name: name,
        email: email,
        role: 'border',
        status: 'pending', // --- NEW ---
        createdAt: serverTimestamp(),
        defaultMeals: { 
          breakfast: 0.5,
          lunch: 1,
          dinner: 1
        }
      });
      
      // --- UPDATED: Show success message instead of redirecting ---
      showSuccess('Account created! A manager will approve your account soon.');
      
      // Log out the user so they can't access anything
      await signOut(window.auth);
      
      // Reset the form
      signupFormElement.reset();
      
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Signup failed. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      showError(errorMessage);
    } finally {
      showLoading(false);
    }
  });
}

// ========== GOOGLE SIGN-IN ==========

async function handleGoogleSignIn() {
  showLoading(true);
  hideMessages();
  
  const provider = new GoogleAuthProvider();
  
  try {
    const result = await signInWithPopup(window.auth, provider);
    const user = result.user;
    
    const userDocRef = doc(window.db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    let userData;
    
    if (!userDoc.exists()) {
      userData = {
        name: user.displayName || 'User',
        email: user.email,
        role: 'border',
        status: 'pending', // --- NEW ---
        createdAt: serverTimestamp(),
        defaultMeals: {
          breakfast: 0.5,
          lunch: 1,
          dinner: 1
        }
      };
      await setDoc(userDocRef, userData);
      
      // --- UPDATED: Show success message and log out ---
      showSuccess('Account created! A manager will approve your account soon.');
      await signOut(window.auth);
      
    } else {
      userData = userDoc.data();
      
      // --- NEW STATUS CHECK ---
      if (userData.status === 'pending') {
        showError('Your account is pending approval from a manager.');
        await signOut(window.auth);
      } else if (userData.status === 'approved') {
        showSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = userData.role === 'manager' ? 'manager.html' : 'user.html';
        }, 500);
      } else {
        showError('Your account status is unknown. Please contact an administrator.');
        await signOut(window.auth);
      }
      // --- END NEW STATUS CHECK ---
    }
    
  } catch (error) {
    console.error('Google sign-in error:', error);
    // --- NEW: Handle account linking error ---
    if (error.code === 'auth/account-exists-with-different-credential') {
        showError('An account already exists with this email. Please log in using the method you originally signed up with.');
    } else {
        showError('Google sign-in failed. Please try again.');
    }
  } finally {
    showLoading(false);
  }
}

document.getElementById('googleSignInBtn')?.addEventListener('click', handleGoogleSignIn);
document.getElementById('googleSignInBtn2')?.addEventListener('click', handleGoogleSignIn);


// --- NEW: PASSWORD RESET LOGIC ---
const passwordResetFormElement = document.getElementById('passwordResetFormElement');
if (passwordResetFormElement) {
    passwordResetFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessages();
        
        const email = document.getElementById('resetEmail').value;
        if (!email) {
            showError('Please enter your email address.');
            return;
        }
        
        showLoading(true);
        
        try {
            await sendPasswordResetEmail(window.auth, email);
            showSuccess('Password reset email sent! Please check your inbox (and spam folder).');
        } catch (error) {
            console.error('Password reset error:', error);
            if (error.code === 'auth/user-not-found') {
                // We show a success message even if user not found for security
                // This prevents attackers from guessing which emails are registered.
                showSuccess('Password reset email sent! Please check your inbox (and spam folder).');
            } else {
                showError('Failed to send reset email. Please try again.');
            }
        } finally {
            showLoading(false);
        }
    });
}
// --- END PASSWORD RESET LOGIC ---


// ========== AUTH STATE OBSERVER (FIXED - NO LOOP) ==========

// Check if user is already logged in ONLY on index.html
// This runs ONCE when the page loads
const currentPath = window.location.pathname;
const isAuthPage = currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('/');

if (isAuthPage) {
  // Use a flag to prevent multiple redirects
  let hasRedirected = false;
  
  const unsubscribe = onAuthStateChanged(window.auth, async (user) => {
    // Unsubscribe immediately to prevent multiple calls
    unsubscribe();
    
    if (user && !hasRedirected) {
      hasRedirected = true;
      showLoading(true);
      
      try {
        const userDoc = await getDoc(doc(window.db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // --- NEW STATUS CHECK ---
          if (userData.status === 'approved') {
            window.location.replace(userData.role === 'manager' ? 'manager.html' : 'user.html');
          } else {
            // If pending or other status, log them out and stay on index page
            await signOut(window.auth);
            showLoading(false);
            if(userData.status === 'pending') {
                showError('Your account is pending approval.');
            }
          }
          // --- END NEW STATUS CHECK ---
          
        } else {
          // No user data, log out
          await signOut(window.auth);
          showLoading(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        await signOut(window.auth);
        showLoading(false);
      }
    }
  });
}
