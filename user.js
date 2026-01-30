// user.js - User Dashboard with Real-time Updates

import {
  checkAuth,
  setupSidebar,
  setupLogout,
  displayCurrentMonth,
  updateUserInfo,
  utils,
} from './dashboard-common.js';

import {
  subscribeToSummaryData,
  onUserMealsUpdate,
  onDepositsUpdate,
  getUserDefaultMeals,
  updateUserDefaultMeals,
} from './api.js';

// ========== GLOBAL STATE ==========
let currentUser = null;
let currentMonth = utils.getCurrentMonth();
let unsubscribers = [];

// ========== INITIALIZATION ==========

async function init() {
  try {
    console.log('[User] Starting initialization...');
    utils.showLoading(true);

    // --- UPDATED: Check for 'border' role and 'approved' status ---
    const { user, userData } = await checkAuth('border');
    currentUser = user;

    updateUserInfo(userData);
    setupSidebar();
    setupLogout();
    displayCurrentMonth();
    setupEventListeners();

    // Subscribe to real-time data
    subscribeToAllData();

    console.log('[User] Initialization complete');
  } catch (error) {
    console.error('[User] Initialization error:', error);
  }
}

// ========== REAL-TIME SUBSCRIPTIONS ==========

function subscribeToAllData() {
  // Clear existing subscriptions
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  // 1. Subscribe to Summary Data (for dashboard stats)
  const unsubSummary = subscribeToSummaryData(currentMonth, (summary) => {
    renderDashboardUI(summary);
    utils.showLoading(false);
  });
  unsubscribers.push(unsubSummary);

  // 2. Subscribe to User's Meals (for meal calendar)
  const unsubMeals = onUserMealsUpdate(currentUser.uid, currentMonth, (meals) => {
    renderMealsUI(meals);
  });
  unsubscribers.push(unsubMeals);

  // 3. Subscribe to User's Deposits
  const unsubDeposits = onDepositsUpdate(currentUser.uid, currentMonth, (deposits) => {
    renderDepositsUI(deposits);
  });
  unsubscribers.push(unsubDeposits);
}

// ========== RENDER FUNCTIONS ==========

function renderDashboardUI(summary) {
  try {
    // --- Render Personal Stats ---
    const userSummary = summary.userSummaries.find(s => s.userId === currentUser.uid);

    if (userSummary) {
      utils.updateTextContent('myTotalMeals', userSummary.totalMeals.toFixed(1));
      utils.updateTextContent('myTotalDeposit', utils.formatCurrency(userSummary.totalDeposit));
      
      const balanceEl = document.getElementById('myBalance');
      if (balanceEl) {
        balanceEl.textContent = utils.formatCurrency(userSummary.balance);
        balanceEl.className = 'stat-value ' + (userSummary.balance >= 0 ? 'text-success' : 'text-danger');
      }
      
      utils.updateTextContent('myMealCost', utils.formatCurrency(userSummary.mealCost));
      utils.updateTextContent('mySharedCost', utils.formatCurrency(userSummary.sharedCost));
      utils.updateTextContent('myIndividualCost', utils.formatCurrency(userSummary.individualCost));
      utils.updateTextContent('myTotalCost', utils.formatCurrency(userSummary.totalCost));
      utils.updateTextContent('myMealCostBreakdown', utils.formatCurrency(userSummary.mealCost));
      utils.updateTextContent('myTotalCostBreakdown', utils.formatCurrency(userSummary.totalCost));
    } else {
      // User not found in summary (might be new, no data yet, or not approved)
      console.warn('[User] User summary not found. User might not be in calculations.');
      utils.updateTextContent('myTotalMeals', '0');
      utils.updateTextContent('myTotalDeposit', '৳0.00');
      utils.updateTextContent('myBalance', '৳0.00');
      utils.updateTextContent('myMealCost', '৳0.00');
      utils.updateTextContent('mySharedCost', '৳0.00');
      utils.updateTextContent('myIndividualCost', '৳0.00');
      utils.updateTextContent('myTotalCost', '৳0.00');
      utils.updateTextContent('myMealCostBreakdown', '৳0.00');
      utils.updateTextContent('myTotalCostBreakdown', '৳0.00');
    }

    // --- Render Global Stats ---
    utils.updateTextContent('mealRate', utils.formatCurrency(summary.mealRate));
    // --- NEW: Populate Global Stat Cards ---
    utils.updateTextContent('messBalance', utils.formatCurrency(summary.messBalance));
    utils.updateTextContent('totalDeposit', utils.formatCurrency(summary.totalAllDeposits));
    // --- END NEW ---

    // --- NEW: Populate Summary Table ---
    updateSummaryTable(summary);
    // --- END NEW ---

  } catch (error) {
    console.error('[User] Render dashboard error:', error);
    utils.showToast('Failed to update dashboard', 'error');
  }
}

function renderMealsUI(meals) {
  try {
    const calendarContainer = document.getElementById('mealCalendar');
    if (!calendarContainer) return;
    
    if (!meals || meals.length === 0) {
      calendarContainer.innerHTML = '<p class="empty-state">No meal data has been entered by the manager for this month.</p>';
      return;
    }

    let calendarHTML = '';

    // Sort meals by date
    meals.sort((a, b) => a.date.localeCompare(b.date));

    meals.forEach(meal => {
      // Add time component to date string to prevent timezone issues
      const dateObj = new Date(meal.date + 'T00:00:00');
      const dayString = dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
      });
      
      const breakfast = meal.breakfast || 0;
      const lunch = meal.lunch || 0;
      const dinner = meal.dinner || 0;
      const total = breakfast + lunch + dinner;

      calendarHTML += `
        <div class="calendar-day">
          <div class="day-header">${dayString}</div>
          <div class="meal-display">
            <div>B: ${breakfast}</div>
            <div>L: ${lunch}</div>
            <div>D: ${dinner}</div>
          </div>
          <div class="day-total">Total: ${total.toFixed(1)}</div>
        </div>
      `;
    });
    
    calendarContainer.innerHTML = calendarHTML;

  } catch (error)
 {
    console.error('[User] Render meal calendar error:', error);
    utils.showToast('Failed to update calendar', 'error');
  }
}

function renderDepositsUI(deposits) {
  try {
    const tbody = document.querySelector('#depositsTable tbody');
    if (!tbody) return;

    if (deposits.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No deposits recorded</td></tr>';
      return;
    }

    tbody.innerHTML = deposits.map(deposit => {
      // Add color class based on amount
      const amountClass = deposit.amount >= 0 ? 'text-success' : 'text-danger';

      return `
        <tr>
          <td>${utils.formatDate(deposit.date)}</td>
          <td>${utils.escapeHTML(deposit.description || 'N/A')}</td>
          <td class="${amountClass}">${utils.formatCurrency(deposit.amount)}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('[User] Render deposits error:', error);
    utils.showToast('Failed to update deposits', 'error');
  }
}

// --- NEW Function: Renders the main summary table ---
function updateSummaryTable(summary) {
  const tbody = document.querySelector('#summaryTable tbody');
  if (!tbody) return;

  if (summary.userSummaries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No data available</td></tr>';
      return;
  }

  tbody.innerHTML = summary.userSummaries.map((user, index) => {
    // Highlight the current user's row
    const isCurrentUser = user.userId === currentUser.uid;
    const rowClass = isCurrentUser ? 'current-user-row' : '';

    return `
        <tr class="${rowClass}">
            <td>${index + 1}</td>
            <td>${utils.escapeHTML(user.userName)} ${isCurrentUser ? '(You)' : ''}</td>
            <td>${user.totalMeals.toFixed(1)}</td>
            <td>${utils.formatCurrency(user.mealCost)}</td>
            <td>${utils.formatCurrency(user.sharedCost)}</td>
            <td>${utils.formatCurrency(user.individualCost)}</td>
            <td>${utils.formatCurrency(user.totalDeposit)}</td>
            <td class="${user.balance >= 0 ? 'text-success' : 'text-danger'}">
                ${utils.formatCurrency(user.balance)}
            </td>
        </tr>
    `;
  }).join('');
}

// ========== LOAD FUNCTIONS (Triggered by Tab Clicks) ==========

window.loadDashboard = () => {
  console.log('[User] Dashboard tab clicked (data already live)');
};

window.loadMeals = () => {
  console.log('[User] Meals tab clicked (data already live)');
};

window.loadDeposits = () => {
  console.log('[User] Deposits tab clicked (data already live)');
};

window.loadSettings = async () => {
  try {
    console.log('[User] Loading settings...');
    utils.showLoading(true);
    const userDefaults = await getUserDefaultMeals(currentUser.uid);

    const bfEl = document.getElementById('userDefaultBreakfast');
    const lunchEl = document.getElementById('userDefaultLunch');
    const dinnerEl = document.getElementById('userDefaultDinner');

    if (bfEl) bfEl.value = userDefaults.breakfast;
    if (lunchEl) lunchEl.value = userDefaults.lunch;
    if (dinnerEl) dinnerEl.value = userDefaults.dinner;

  } catch (error) {
    console.error('[User] Load settings error:', error);
    utils.showToast('Failed to load settings', 'error');
  } finally {
    utils.showLoading(false);
  }
};

// ========== ACTION HANDLERS ==========

async function saveSettings(e) {
  e.preventDefault();
  
  try {
    utils.showLoading(true);
    
    const breakfast = parseFloat(document.getElementById('userDefaultBreakfast').value);
    const lunch = parseFloat(document.getElementById('userDefaultLunch').value);
    const dinner = parseFloat(document.getElementById('userDefaultDinner').value);

    await updateUserDefaultMeals(currentUser.uid, {
      breakfast,
      lunch,
      dinner
    });

    utils.showToast('Your settings saved successfully!', 'success');

  } catch (error) {
    console.error('[User] Save settings error:', error);
    utils.showToast('Failed to save settings', 'error');
  } finally {
    utils.showLoading(false);
  }
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // Settings Form
  const userMealsForm = document.getElementById('userMealsForm');
  if (userMealsForm) {
    userMealsForm.addEventListener('submit', saveSettings);
  }
}

// ========== INITIALIZE ON LOAD ==========

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
