// dashboard-common.js - Shared utilities for manager and user dashboards

import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ========== UTILITY FUNCTIONS ==========

export const utils = {
  /**
   * Closes a modal and removes it from the DOM
   */
  closeModal: (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  },

  /**
   * Formats a number as currency (e.g., ৳1,234.50)
   */
  formatCurrency: (amount) => {
    return `৳${parseFloat(amount || 0).toFixed(2)}`;
  },
  
  /**
   * Formats a YYYY-MM-DD string or Firestore Timestamp to a readable date (e.g., 31/10/2025)
   */
  formatDate: (date) => {
    if (!date) return '';
    
    // Handle Firestore Timestamps
    if (date.toDate) {
      date = date.toDate();
      return date.toLocaleDateString('en-GB');
    }
    
    // Handle YYYY-MM-DD strings safely
    if (typeof date === 'string' && date.includes('-')) {
      const parts = date.split('T')[0].split('-'); // Get YYYY-MM-DD part
      if (parts.length === 3) {
        const [year, month, day] = parts;
        // Manually reformat to DD/MM/YYYY to avoid timezone bugs
        return `${day}/${month}/${year}`;
      }
    }
    
    // Fallback for any other date object or string
    try {
      return new Date(date).toLocaleDateString('en-GB');
    } catch (e) {
      return 'Invalid Date';
    }
  },
  
  /**
   * Gets the current month as a YYYY-MM string
   */
  getCurrentMonth: () => {
    return new Date().toISOString().substring(0, 7);
  },
  
  /**
   * Gets a display-friendly month name (e.g., October 2025)
   */
  getMonthName: (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },
  
  /**
   * Gets today's date as a YYYY-MM-DD string
   */
  getTodayDate: () => {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Safely escapes HTML to prevent XSS attacks
   */
  escapeHTML: (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (match) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[match];
    });
  },
  
  /**
   * Shows or hides the global loading overlay
   */
  showLoading: (show = true) => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      if (show) {
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
    }
  },
  
  /**
   * Displays a short-lived toast message
   */
  showToast: (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  /**
   * Creates and injects a modal into the DOM
   */
  createModal: (title, content, actions = [], modalId = null) => {
    if (!modalId) {
      modalId = 'modal-' + Date.now();
    }
    
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const actionsHTML = actions.map(action => {
      return `<button class="btn ${action.class || 'btn-secondary'}" onclick="${action.onclick}" type="button">${action.label}</button>`;
    }).join('');
    
    const modalHTML = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close" onclick="utils.closeModal('${modalId}')" type="button" aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          <div class="modal-footer">
            ${actionsHTML}
          </div>
        </div>
      </div>
    `;
    
    const container = document.getElementById('modalContainer') || document.body;
    container.insertAdjacentHTML('beforeend', modalHTML);
    
    const overlay = document.getElementById(modalId);
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) {
          utils.closeModal(modalId);
        }
      });
    }
    
    return modalId;
  },
  
  /**
   * Safely adds a click listener to an element
   */
  addClickListener: (id, handler) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', handler);
    }
  },

  /**
   * Safely updates the text content of an element
   */
  updateTextContent: (id, text) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
    }
  }
};

// Make utils globally available for onclick handlers
window.utils = utils;

// ========== AUTHENTICATION CHECK (UPDATED) ==========

export async function checkAuth(requiredRole = null) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(window.auth, async (user) => {
      unsubscribe();
      
      if (!user) {
        window.location.replace('index.html');
        reject(new Error('Not authenticated'));
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(window.db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          utils.showToast('User data not found. Logging out.', 'error');
          await signOut(window.auth);
          window.location.replace('index.html');
          reject(new Error('User data not found'));
          return;
        }
        
        const userData = userDoc.data();
        
        // --- NEW STATUS CHECK ---
        // Check if user is approved BEFORE checking role
        if (userData.status !== 'approved') {
          if (userData.status === 'pending') {
            utils.showToast('Your account is pending approval.', 'error');
          } else {
            utils.showToast('Access denied. Account not approved.', 'error');
          }
          await signOut(window.auth);
          window.location.replace('index.html');
          reject(new Error('Account not approved'));
          return;
        }
        // --- END NEW STATUS CHECK ---
        
        // Now check for role
        if (requiredRole && userData.role !== requiredRole) {
          utils.showToast('Access denied. Redirecting...', 'error');
          // User is approved, but wrong role, send to their correct dashboard
          window.location.replace(userData.role === 'manager' ? 'manager.html' : 'user.html');
          reject(new Error('Unauthorized role'));
          return;
        }
        
        // User is authenticated, approved, and has correct role
        resolve({ user, userData });

      } catch (error) {
        console.error('Auth check error:', error);
        utils.showToast('Authentication error. Logging out.', 'error');
        await signOut(window.auth);
        window.location.replace('index.html');
        reject(error);
      }
    });
  });
}

// ========== SIDEBAR & NEW MOBILE UI ==========

export function setupSidebar() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) return;
  
  const toggleSidebar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.toggle('active');
  };
  
  // Desktop sidebar toggle
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }
  // Mobile sidebar toggle
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener('click', toggleSidebar);
  }
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
      if (
        !sidebar.contains(e.target) && 
        mobileSidebarToggle && 
        !mobileSidebarToggle.contains(e.target)
      ) {
        sidebar.classList.remove('active');
      }
    }
  });
  
  // Close sidebar on window resize if > 768
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('active');
    }
  });
  
  // --- Setup Navigation Links ---
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.content-section');
  const sectionTitle = document.getElementById('sectionTitle');
  const mobileSectionTitle = document.getElementById('mobileSectionTitle'); // New
  
  if (navLinks.length === 0) return;
  
  navLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const currentSection = link.getAttribute('data-section');
      if (!currentSection) return;
      
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      sections.forEach(section => {
        section.classList.remove('active');
      });
      
      const targetSectionId = currentSection + 'Section';
      const targetSection = document.getElementById(targetSectionId);
      if (targetSection) {
        targetSection.classList.add('active');
      }
      
      const title = link.textContent.trim();
      if (sectionTitle) sectionTitle.textContent = title;
      if (mobileSectionTitle) mobileSectionTitle.textContent = title; // New
      
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
      }
      
      // Call the corresponding load function for the section
      const functionName = 'load' + currentSection.charAt(0).toUpperCase() + currentSection.slice(1);
      if (window[functionName] && typeof window[functionName] === 'function') {
        try {
          await window[functionName]();
        } catch (error) {
          console.error(`Error calling ${functionName}:`, error);
        }
      }
    });
  });

  // --- Setup New Mobile FAB Menu (REMOVED) ---
  // setupMobileFab(navLinks);
}

// NEW function to power the FAB menu (REMOVED)
/*
function setupMobileFab(navLinks) {
  const fabContainer = document.getElementById('fabContainer');
  const fabToggle = document.getElementById('fabToggle');
  const fabMenu = document.getElementById('fabMenu');

  if (!fabContainer || !fabToggle || !fabMenu) return;

  // 1. Populate the FAB menu from the sidebar nav links
  let fabHTML = '';
  navLinks.forEach(link => {
    fabHTML += `
      <a href="#" class="fab-item" data-section="${link.dataset.section}">
        <span class="label">${link.textContent.trim()}</span>
        <span class="fab-icon">${link.querySelector('.icon').innerHTML}</span>
      </a>
    `;
  });
  fabMenu.innerHTML = fabHTML;

  // 2. Add click listener to the main FAB toggle
  fabToggle.addEventListener('click', () => {
    fabToggle.classList.toggle('active');
    fabMenu.classList.toggle('active');
  });

  // 3. Add click listeners to the new menu items
  const fabItems = fabMenu.querySelectorAll('.fab-item');
  fabItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Find the corresponding *sidebar* link and click it
      const section = item.dataset.section;
      const correspondingNavLink = document.querySelector(`.nav-link[data-section="${section}"]`);
      if (correspondingNavLink) {
        correspondingNavLink.click();
      }

      // Close the FAB menu
      fabToggle.classList.remove('active');
      fabMenu.classList.remove('active');
    });
  });
}
*/

// ========== LOGOUT ==========

export function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn'); // New

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      utils.showLoading(true);
      try {
        await signOut(window.auth);
        window.location.replace('index.html');
      } catch (error) {
        console.error('Logout error:', error);
        utils.showToast('Logout failed. Please try again.', 'error');
      } finally {
        utils.showLoading(false);
      }
    }
  };

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  if (mobileLogoutBtn) { // New
    mobileLogoutBtn.addEventListener('click', handleLogout);
  }
}

// ========== DISPLAY HELPERS ==========

export function displayCurrentMonth() {
  const currentMonthEl = document.getElementById('currentMonth');
  if (currentMonthEl) {
    currentMonthEl.textContent = utils.getMonthName(utils.getCurrentMonth());
  }
}

export function updateUserInfo(userData) {
  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  
  if (userNameEl) {
    userNameEl.textContent = utils.escapeHTML(userData.name);
  }
  
  if (userAvatarEl && userData.name) {
    userAvatarEl.textContent = userData.name.charAt(0).toUpperCase();
  }
}
