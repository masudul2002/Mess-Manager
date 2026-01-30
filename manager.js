// manager.js - Manager Dashboard with Real-time Updates

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
    onUsersUpdate,
    onCostsUpdate,
    onDepositsUpdate,
    onSettingsUpdate,
    getAllUsers,
    getAllMealsByMonth,
    getMealByDate,
    getMealByDate_Track, 
    addCost,
    deleteCost,
    updateCost,
    updateSettings,
    saveMeal,
    addDeposit,
    deleteUser,
    deleteDoc,
    updateDeposit,
    updateUser, // --- NEW: Import updateUser ---
} from './api.js';

import { createAuthApp } from './firebase-config.js';

import {
    createUserWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    doc,
    setDoc,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ========== GLOBAL STATE ==========
let currentMonth = utils.getCurrentMonth();
let currentUser = null;
let unsubscribers = [];
let costBreakdownChart = null;
let mealsPerUserChart = null;

// Store users globally to avoid re-fetching for modals
let allUsersCache = [];

// ========== INITIALIZATION ==========

async function initializeManager() {
    try {
        console.log('[Manager] Starting initialization...');
        utils.showLoading(true);
        
        // --- UPDATED: Check for 'manager' role and 'approved' status ---
        const authResult = await checkAuth('manager', 'approved');
        currentUser = authResult.user;
        const userData = authResult.userData;

        setupSidebar();
        setupLogout();
        displayCurrentMonth();
        updateUserInfo(userData);
        setupEventListeners();

        // Subscribe to real-time data
        subscribeToAllData();

        console.log('[Manager] Initialization complete');
    } catch (error) {
        console.error('[Manager] Initialization error:', error);
    }
}

// ========== REAL-TIME SUBSCRIPTIONS ==========

function subscribeToAllData() {
    // Clear existing subscriptions
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];

    // 1. Subscribe to Summary Data
    const unsubSummary = subscribeToSummaryData(currentMonth, (summary) => {
        renderOverviewSection(summary);
        utils.showLoading(false);
    });
    unsubscribers.push(unsubSummary);

    // 2. Subscribe to Users
    const unsubUsers = onUsersUpdate((users) => {
        allUsersCache = users; // Update the cache
        renderUsersSection(users);

        // --- Filter out pending users from meal editor ---
        loadTodayMealsEditor(users.filter(u => u.status === 'approved'));
    });
    unsubscribers.push(unsubUsers);

    // 3. Subscribe to Costs
    const unsubCosts = onCostsUpdate(currentMonth, (costs) => {
        renderCostsSection(costs);
    });
    unsubscribers.push(unsubCosts);

    // 4. Subscribe to Deposits
    const unsubDeposits = onDepositsUpdate('all', currentMonth, (deposits) => {
        renderDepositsSection(deposits);
    });
    unsubscribers.push(unsubDeposits);

    // 5. Subscribe to Settings
    const unsubSettings = onSettingsUpdate((settings) => {
        renderSettingsSection(settings);
    });
    unsubscribers.push(unsubSettings);
}

// ========== RENDER FUNCTIONS ==========

function renderOverviewSection(summary) {
    // Update stat cards
    // --- UPDATED: Only count approved users ---
    utils.updateTextContent('totalUsers', summary.userCount); 
    utils.updateTextContent('messBalance', utils.formatCurrency(summary.messBalance));
    utils.updateTextContent('totalDeposit', utils.formatCurrency(summary.totalAllDeposits));
    utils.updateTextContent('messTotalMeal', summary.totalMeals.toFixed(1));
    utils.updateTextContent('mealRate', utils.formatCurrency(summary.mealRate));
    utils.updateTextContent('totalOtherCosts', utils.formatCurrency(summary.totalOtherCosts));

    utils.updateTextContent('totalMealCost', utils.formatCurrency(summary.totalMarketCost));
    const totalAllCosts = summary.totalMarketCost + summary.totalOtherCosts;
    utils.updateTextContent('totalCost', utils.formatCurrency(totalAllCosts));

    // Update charts
    updateCostBreakdownChart(summary);
    updateMealsPerUserChart(summary);

    // Update summary table
    updateSummaryTable(summary);
}

function updateCostBreakdownChart(summary) {
    const ctx = document.getElementById('costBreakdownChart');
    if (!ctx) return;

    const data = {
        labels: ['Market Cost', 'Shared Cost', 'Individual Cost'],
        datasets: [{
            data: [
                summary.totalMarketCost,
                summary.totalSharedCost,
                summary.userSummaries.reduce((sum, u) => sum + u.individualCost, 0)
            ],
            backgroundColor: [
                'rgba(14, 165, 233, 0.8)',
                'rgba(139, 92, 246, 0.8)',
                'rgba(236, 72, 153, 0.8)'
            ],
            borderColor: [
                'rgba(14, 165, 233, 1)',
                'rgba(139, 92, 246, 1)',
                'rgba(236, 72, 153, 1)'
            ],
            borderWidth: 2
        }]
    };

    if (costBreakdownChart) {
        costBreakdownChart.data = data;
        costBreakdownChart.update();
    } else {
        costBreakdownChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }
}

function updateMealsPerUserChart(summary) {
    const ctx = document.getElementById('mealsPerUserChart');
    if (!ctx) return;

    const data = {
        labels: summary.userSummaries.map(u => u.userName),
        datasets: [{
            label: 'Total Meals',
            data: summary.userSummaries.map(u => u.totalMeals),
            backgroundColor: 'rgba(14, 165, 233, 0.8)',
            borderColor: 'rgba(14, 165, 233, 1)',
            borderWidth: 2
        }]
    };

    if (mealsPerUserChart) {
        mealsPerUserChart.data = data;
        mealsPerUserChart.update();
    } else {
        mealsPerUserChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

function updateSummaryTable(summary) {
    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;

    if (summary.userSummaries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No data available</td></tr>`;
        return;
    }

    tbody.innerHTML = summary.userSummaries.map((user, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${utils.escapeHTML(user.userName)}</td>
            <td>${user.totalMeals.toFixed(1)}</td>
            <td>${utils.formatCurrency(user.mealCost)}</td>
            <td>${utils.formatCurrency(user.sharedCost)}</td>
            <td>${utils.formatCurrency(user.individualCost)}</td>
            <td>${utils.formatCurrency(user.totalDeposit)}</td>
            <td class="${user.balance >= 0 ? 'text-success' : 'text-danger'}">
                ${utils.formatCurrency(user.balance)}
            </td>
        </tr>
    `).join('');
}

// --- UPDATED Function ---
function renderUsersSection(users) {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No users found</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map((user, index) => {
        const status = user.status || 'approved'; // Default to 'approved' if not set
        let statusBadge;
        let actions;

        if (status === 'pending') {
            statusBadge = `<span class="badge badge-warning">Pending</span>`;
            actions = `
                <button class="btn btn-success btn-sm" onclick="window.updateUserStatus('${user.id}', 'approved')">Approve</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteUserItem('${user.id}')">Delete</button>
            `;
        } else {
            statusBadge = `<span class="badge badge-success">Approved</span>`;
            actions = `
                <button class="btn btn-danger btn-sm" onclick="window.deleteUserItem('${user.id}')">Delete</button>
            `;
        }
        
        // Prevent manager from deleting themselves
        if (user.id === currentUser.uid) {
            actions = '<span class="text-secondary">N/A</span>';
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${utils.escapeHTML(user.name)}</td>
                <td>${utils.escapeHTML(user.email)}</td>
                <td><span class="badge badge-${user.role}">${user.role}</span></td>
                <td>${statusBadge}</td>
                <td class="user-actions">${actions}</td>
            </tr>
        `;
    }).join('');
}


function renderCostsSection(costs) {
    const tbody = document.querySelector('#costsTable tbody');
    if (!tbody) return;

    if (costs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No costs recorded</td></tr>`;
        return;
    }

    tbody.innerHTML = costs.map((cost, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${utils.formatDate(cost.date)}</td>
            <td><span class="badge badge-${cost.type}">${cost.type}</span></td>
            <td>${utils.escapeHTML(cost.description || 'N/A')}</td>
            <td>${utils.formatCurrency(cost.amount)}</td>
            <td>${utils.escapeHTML(cost.userName || 'N/A')}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick='showEditCostModal(${JSON.stringify(cost)})'>Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCostItem('${cost.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderDepositsSection(deposits) {
    const tbody = document.querySelector('#depositsTable tbody');
    if (!tbody) return;

    if (deposits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No deposits recorded</td></tr>`;
        return;
    }

    tbody.innerHTML = deposits.map((deposit, index) => {
        // Add color class based on amount
        const amountClass = deposit.amount >= 0 ? 'text-success' : 'text-danger';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${utils.escapeHTML(deposit.userName || 'N/A')}</td>
                <td>${utils.escapeHTML(deposit.description || 'N/A')}</td>
                <td class="${amountClass}">${utils.formatCurrency(deposit.amount)}</td>
                <td>${utils.formatDate(deposit.date)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick='showEditDepositModal(${JSON.stringify(deposit)})'>Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDepositItem('${deposit.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderSettingsSection(settings) {
    const bfEl = document.getElementById('defaultBreakfast');
    const lunchEl = document.getElementById('defaultLunch');
    const dinnerEl = document.getElementById('defaultDinner');

    if (bfEl) bfEl.value = settings.defaultMeals.breakfast;
    if (lunchEl) lunchEl.value = settings.defaultMeals.lunch;
    if (dinnerEl) dinnerEl.value = settings.defaultMeals.dinner;
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    // Add User Button
    utils.addClickListener('addUserBtn', showAddUserModal);

    // Add Cost Buttons
    utils.addClickListener('addMarketCostBtn', () => showAddCostModal('market'));
    utils.addClickListener('addSharedCostBtn', () => showAddCostModal('shared'));
    utils.addClickListener('addIndividualCostBtn', () => showAddCostModal('individual'));

    // Add Deposit Button
    utils.addClickListener('addDepositBtn', showAddDepositModal);

    // Settings Form
    const settingsForm = document.getElementById('defaultMealsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSaveSettings);
    }

    // Meal Tracking
    utils.addClickListener('filterMealsBtn', handleFilterMeals);

    // Set today's date as default
    const mealTrackingDate = document.getElementById('mealTrackingDate');
    if (mealTrackingDate) {
        mealTrackingDate.value = utils.getTodayDate();
    }
}

// ========== MODAL HANDLERS ==========

async function showAddUserModal() {
    const modalId = utils.createModal(
        'Add New User',
        `<form id="addUserForm">
            <div class="form-group">
                <label for="newUserName">Name <span style="color: red;">*</span></label>
                <input type="text" id="newUserName" required placeholder="Enter user name" />
            </div>
            <div class="form-group">
                <label for="newUserEmail">Email <span style="color: red;">*</span></label>
                <input type="email" id="newUserEmail" required placeholder="Enter email address" />
            </div>
            <div class="form-group">
                <label for="newUserPassword">Password <span style="color: red;">*</span></label>
                <input type="password" id="newUserPassword" required placeholder="Minimum 6 characters" />
            </div>
            <div class="form-group">
                <label for="newUserRole">Role <span style="color: red;">*</span></label>
                <select id="newUserRole">
                    <option value="border">Border</option>
                    <option value="manager">Manager</option>
                </select>
            </div>
        </form>`,
        [
            {
                label: 'Add User',
                class: 'btn-primary',
                onclick: 'handleSaveNewUser()'
            },
            {
                label: 'Cancel',
                class: 'btn-secondary',
                onclick: "utils.closeModal('addUserModal')"
            }
        ],
        'addUserModal'
    );
}

// Re-usable function to get user options
function getUserOptions(selectedUserId = null) {
    // --- UPDATED: Only show approved users in dropdowns ---
    const approvedUsers = allUsersCache.filter(u => u.status === 'approved');
    
    if (approvedUsers.length === 0) {
        console.warn("Approved user cache is empty. Cannot build user options.");
        return '<option value="">-- No Approved Users --</option>';
    }
    return approvedUsers.map(u => 
        `<option value="${u.id}" ${selectedUserId === u.id ? 'selected' : ''}>
            ${utils.escapeHTML(u.name)}
        </option>`
    ).join('');
}


async function showAddCostModal(type) {
    // --- UPDATED: Check for *approved* users ---
    const approvedUsers = allUsersCache.filter(u => u.status === 'approved');
    if (approvedUsers.length === 0) {
        utils.showToast('No approved users available to assign costs.', 'error');
        return;
    }
    const userOptions = getUserOptions();
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

    const modalId = utils.createModal(
        `Add ${typeLabel} Cost`,
        `<form id="addCostForm">
            <div class="form-group">
                <label for="costDate">Date <span style="color: red;">*</span></label>
                <input type="date" id="costDate" value="${utils.getTodayDate()}" required />
            </div>
            <div class="form-group">
                <label for="costDescription">Description</label>
                <input type="text" id="costDescription" placeholder="e.g., Rice purchase, Utilities" />
            </div>
            <div class="form-group">
                <label for="costAmount">Amount (৳) <span style="color: red;">*</span></label>
                <input type="number" id="costAmount" step="0.01" min="0" required placeholder="0.00" />
            </div>
            <div class="form-group">
                <label for="costUser">${type === 'individual' ? 'User' : 'Marketeer'} <span style="color: red;">*</span></label>
                <select id="costUser" required>
                    <option value="">-- Select User --</option>
                    ${userOptions}
                </select>
            </div>
            <input type="hidden" id="costType" value="${type}" />
        </form>`,
        [
            {
                label: 'Add Cost',
                class: 'btn-primary',
                onclick: 'handleSaveNewCost()'
            },
            {
                label: 'Cancel',
                class: 'btn-secondary',
                onclick: "utils.closeModal('addCostModal')"
            }
        ],
        'addCostModal'
    );
}

window.showEditCostModal = function(cost) {
    const userOptions = getUserOptions(cost.userId);
    const typeLabel = cost.type.charAt(0).toUpperCase() + cost.type.slice(1);

    const modalId = utils.createModal(
        `Edit ${typeLabel} Cost`,
        `<form id="editCostForm">
            <div class="form-group">
                <label for="editCostDate">Date <span style="color: red;">*</span></label>
                <input type="date" id="editCostDate" value="${cost.date}" required />
            </div>
            <div class="form-group">
                <label for="editCostDescription">Description</label>
                <input type="text" id="editCostDescription" value="${utils.escapeHTML(cost.description || '')}" />
            </div>
            <div class="form-group">
                <label for="editCostAmount">Amount (৳) <span style="color: red;">*</span></label>
                <input type="number" id="editCostAmount" step="0.01" min="0" value="${cost.amount}" required />
            </div>
            <div class="form-group">
                <label for="editCostUser">${cost.type === 'individual' ? 'User' : 'Marketeer'} <span style="color: red;">*</span></label>
                <select id="editCostUser" required>
                    ${userOptions}
                </select>
            </div>
            <input type="hidden" id="editCostId" value="${cost.id}" />
        </form>`,
        [
            {
                label: 'Save Changes',
                class: 'btn-primary',
                onclick: 'handleUpdateCost()'
            },
            {
                label: 'Cancel',
                class: 'btn-secondary',
                onclick: `utils.closeModal('editCostModal-${cost.id}')`
            }
        ],
        `editCostModal-${cost.id}`
    );
}

// --- UPDATED Function ---
async function showAddDepositModal() {
    // --- UPDATED: Check for *approved* users ---
    const approvedUsers = allUsersCache.filter(u => u.status === 'approved');
    if (approvedUsers.length === 0) {
        utils.showToast('No approved users available to add deposits.', 'error');
        return;
    }
    const userOptions = getUserOptions();

    const modalId = utils.createModal(
        'Add Deposit',
        `<form id="addDepositForm">
            <div class="form-group">
                <label for="depositUser">User <span style="color: red;">*</span></label>
                <select id="depositUser" required>
                    <option value="">-- Select User --</option>
                    ${userOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="depositDescription">Description</label>
                <input type="text" id="depositDescription" placeholder="e.g., Monthly fee, Fine for..." />
            </div>
            <div class="form-group">
                <label for="depositAmount">Amount (৳) <span style="color: red;">*</span></label>
                <input type="number" id="depositAmount" step="0.01" required placeholder="0.00 (can be negative)" />
            </div>
            <div class="form-group">
                <label for="depositDate">Date <span style="color: red;">*</span></label>
                <input type="date" id="depositDate" value="${utils.getTodayDate()}" required />
            </div>
        </form>`,
        [
            {
                label: 'Add Deposit',
                class: 'btn-primary',
                onclick: 'handleSaveNewDeposit()'
            },
            {
                label: 'Cancel',
                class: 'btn-secondary',
                onclick: "utils.closeModal('addDepositModal')"
            }
        ],
        'addDepositModal'
    );
}

// --- UPDATED Function ---
window.showEditDepositModal = function(deposit) {
    const userOptions = getUserOptions(deposit.userId);

    const modalId = utils.createModal(
        'Edit Deposit',
        `<form id="editDepositForm">
            <div class="form-group">
                <label for="editDepositUser">User <span style="color: red;">*</span></label>
                <select id="editDepositUser" required>
                    ${userOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="editDepositDescription">Description</label>
                <input type="text" id="editDepositDescription" value="${utils.escapeHTML(deposit.description || 'N/A')}" />
            </div>
            <div class="form-group">
                <label for="editDepositAmount">Amount (৳) <span style="color: red;">*</span></label>
                <input type="number" id="editDepositAmount" step="0.01" value="${deposit.amount}" required />
            </div>
            <div class="form-group">
                <label for="editDepositDate">Date <span style="color: red;">*</span></label>
                <input type="date" id="editDepositDate" value="${deposit.date}" required />
            </div>
            <input type="hidden" id="editDepositId" value="${deposit.id}" />
        </form>`,
        [
            {
                label: 'Save Changes',
                class: 'btn-primary',
                onclick: 'handleUpdateDeposit()'
            },
            {
                label: 'Cancel',
                class: 'btn-secondary',
                onclick: `utils.closeModal('editDepositModal-${deposit.id}')`
            }
        ],
        `editDepositModal-${deposit.id}`
    );
}

// ========== ACTION HANDLERS ==========

// --- NEW Function ---
window.updateUserStatus = async function(userId, status) {
    const action = status === 'approved' ? 'approve' : 'update';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    utils.showLoading(true);
    try {
        await updateUser(userId, { status: status });
        utils.showToast(`User ${status} successfully!`, 'success');
    } catch (error) {
        console.error(`Error ${action}ing user:`, error);
        utils.showToast(`Failed to ${action} user`, 'error');
    } finally {
        utils.showLoading(false);
    }
};


window.handleSaveNewUser = async function() {
    const name = document.getElementById('newUserName')?.value?.trim();
    const email = document.getElementById('newUserEmail')?.value?.trim();
    const password = document.getElementById('newUserPassword')?.value;
    const role = document.getElementById('newUserRole')?.value;

    if (!name || !email || !password || !role) {
        utils.showToast('Please fill all required fields', 'error');
        return;
    }
    if (password.length < 6) {
        utils.showToast('Password must be at least 6 characters', 'error');
        return;
    }

    utils.showLoading(true);
    let authWorker; 

    try {
        authWorker = await createAuthApp();
        const userCredential = await createUserWithEmailAndPassword(authWorker.authInstance, email, password);
        
        const settings = await onSettingsUpdate(() => {}); 
        const defaultMeals = settings.defaultMeals || { breakfast: 0.5, lunch: 1, dinner: 1 };

        await setDoc(doc(window.db, 'users', userCredential.user.uid), {
            name: name,
            email: email,
            role: role,
            status: 'approved', // --- NEW: Managers add users as 'approved' by default ---
            createdAt: serverTimestamp(),
            defaultMeals: defaultMeals
        });

        utils.showToast(`User "${name}" added successfully!`, 'success');
        utils.closeModal('addUserModal');
        
    } catch (error) {
        console.error('Error adding user:', error);
        let errorMsg = 'Failed to add user';
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'This email is already registered';
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = 'Invalid email address';
        }
        utils.showToast(errorMsg, 'error');
    } finally {
        utils.showLoading(false);
        if (authWorker && authWorker.cleanup) {
            await authWorker.cleanup();
        }
    }
};

window.handleSaveNewCost = async function() {
    const date = document.getElementById('costDate')?.value;
    const type = document.getElementById('costType')?.value;
    const description = document.getElementById('costDescription')?.value?.trim() || 'N/A';
    const amount = document.getElementById('costAmount')?.value;
    const userId = document.getElementById('costUser')?.value;

    if (!date || !type || !amount || !userId) {
        utils.showToast('Please fill all required fields', 'error');
        return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        utils.showToast('Amount must be a positive number', 'error');
        return;
    }

    try {
        utils.showLoading(true);
        await addCost({ date, type, description, amount: amountNum, userId });
        utils.showToast('Cost added successfully!', 'success');
        utils.closeModal('addCostModal');
    } catch (error) {
        console.error('Error adding cost:', error);
        utils.showToast('Failed to add cost', 'error');
    } finally {
        utils.showLoading(false);
    }
};

window.handleUpdateCost = async function() {
    const costId = document.getElementById('editCostId')?.value;
    const date = document.getElementById('editCostDate')?.value;
    const description = document.getElementById('editCostDescription')?.value?.trim() || 'N/A';
    const amount = document.getElementById('editCostAmount')?.value;
    const userId = document.getElementById('editCostUser')?.value;

    if (!costId || !date || !amount || !userId) {
        utils.showToast('Please fill all required fields', 'error');
        return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        utils.showToast('Amount must be a positive number', 'error');
        return;
    }

    try {
        utils.showLoading(true);
        await updateCost(costId, { date, description, amount: amountNum, userId });
        utils.showToast('Cost updated successfully!', 'success');
        utils.closeModal(`editCostModal-${costId}`);
    } catch (error) {
        console.error('Error updating cost:', error);
        utils.showToast('Failed to update cost', 'error');
    } finally {
        utils.showLoading(false);
    }
};

// --- UPDATED Function ---
window.handleSaveNewDeposit = async function() {
    const userId = document.getElementById('depositUser')?.value;
    const amount = document.getElementById('depositAmount')?.value;
    const date = document.getElementById('depositDate')?.value;
    const description = document.getElementById('depositDescription')?.value?.trim() || 'N/A';

    if (!userId || !amount || !date) {
        utils.showToast('Please fill all required fields', 'error');
        return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) { // Allow 0 and negative numbers
        utils.showToast('Amount must be a valid number', 'error');
        return;
    }

    try {
        utils.showLoading(true);
        await addDeposit(userId, amountNum, date, description); // Pass description
        utils.showToast('Deposit added successfully!', 'success');
        utils.closeModal('addDepositModal');
    } catch (error) {
        console.error('Error adding deposit:', error);
        utils.showToast('Failed to add deposit', 'error');
    } finally {
        utils.showLoading(false);
    }
};

// --- UPDATED Function ---
window.handleUpdateDeposit = async function() {
    const depositId = document.getElementById('editDepositId')?.value;
    const userId = document.getElementById('editDepositUser')?.value;
    const amount = document.getElementById('editDepositAmount')?.value;
    const date = document.getElementById('editDepositDate')?.value;
    const description = document.getElementById('editDepositDescription')?.value?.trim() || 'N/A';

    if (!depositId || !userId || !amount || !date) {
        utils.showToast('Please fill all required fields', 'error');
        return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) { // Allow 0 and negative numbers
        utils.showToast('Amount must be a valid number', 'error');
        return;
    }

    try {
        utils.showLoading(true);
        // Pass description in data object
        await updateDeposit(depositId, { userId, amount: amountNum, date, description });
        utils.showToast('Deposit updated successfully!', 'success');
        utils.closeModal(`editDepositModal-${depositId}`);
    } catch (error) {
        console.error('Error updating deposit:', error);
        utils.showToast('Failed to update deposit', 'error');
    } finally {
        utils.showLoading(false);
    }
};

window.deleteCostItem = async function(costId) {
    if (!confirm('Are you sure you want to delete this cost?')) return;
    try {
        utils.showLoading(true);
        await deleteCost(costId);
        utils.showToast('Cost deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting cost:', error);
        utils.showToast('Failed to delete cost', 'error');
    } finally {
        utils.showLoading(false);
    }
};

window.deleteDepositItem = async function(depositId) {
    if (!confirm('Are you sure you want to delete this deposit?')) return;
    try {
        utils.showLoading(true);
        await deleteDoc(doc(window.db, 'deposits', depositId));
        utils.showToast('Deposit deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting deposit:', error);
        utils.showToast('Failed to delete deposit', 'error');
    } finally {
        utils.showLoading(false);
    }
};

window.deleteUserItem = async function(userId) {
    // --- UPDATED: Find user to show name in confirm dialog ---
    const user = allUsersCache.find(u => u.id === userId);
    const confirmMsg = user
        ? `Are you sure you want to delete "${user.name}"? This action cannot be undone.`
        : 'Are you sure you want to delete this user? This action cannot be undone.';
        
    if (!confirm(confirmMsg)) return;
    
    try {
        utils.showLoading(true);
        await deleteUser(userId);
        utils.showToast('User deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting user:', error);
        // --- UPDATED: Show more specific error for auth/requires-recent-login ---
        if (error.code === 'auth/requires-recent-login') {
            utils.showToast('Delete failed: Please log out and log back in to delete this user.', 'error');
        } else {
            utils.showToast('Failed to delete user', 'error');
        }
    } finally {
        utils.showLoading(false);
    }
};

async function handleSaveSettings(e) {
    e.preventDefault();
    const breakfast = parseFloat(document.getElementById('defaultBreakfast')?.value || 0.5);
    const lunch = parseFloat(document.getElementById('defaultLunch')?.value || 1);
    const dinner = parseFloat(document.getElementById('defaultDinner')?.value || 1);

    try {
        utils.showLoading(true);
        await updateSettings({
            defaultMeals: { breakfast, lunch, dinner },
            currentMonth: currentMonth
        });
        utils.showToast('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        utils.showToast('Failed to save settings', 'error');
    } finally {
        utils.showLoading(false);
    }
}

// ==========================================================
// ========== MEALS SECTION HANDLERS ========================
// ==========================================================

async function handleFilterMeals() {
    const date = document.getElementById('mealTrackingDate')?.value;
    if (!date) {
        utils.showToast('Please select a date', 'error');
        return;
    }
    
    utils.showLoading(true);
    const tbody = document.querySelector('#mealTrackingTable tbody');
    if (!tbody) return;

    try {
        // --- UPDATED: Only get approved users ---
        const users = allUsersCache.filter(u => u.status === 'approved');
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No approved users found</td></tr>`;
            return;
        }

        let tbodyHTML = '';
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            
            const meal = await getMealByDate_Track(user.id, date);
            
            const breakfast = meal ? meal.breakfast : 0;
            const lunch = meal ? meal.lunch : 0;
            const dinner = meal ? meal.dinner : 0;
            const total = breakfast + lunch + dinner;

            tbodyHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${utils.escapeHTML(user.name)}</td>
                    <td>
                        <input type="number" step="0.5" min="0" class="meal-filter-input"
                               id="filter_breakfast_${user.id}" value="${breakfast}" 
                               onchange="updateFilteredTotal('${user.id}')" />
                    </td>
                    <td>
                        <input type="number" step="0.5" min="0" class="meal-filter-input"
                               id="filter_lunch_${user.id}" value="${lunch}" 
                               onchange="updateFilteredTotal('${user.id}')" />
                    </td>
                    <td>
                        <input type="number" step="0.5" min="0" class="meal-filter-input"
                               id="filter_dinner_${user.id}" value="${dinner}" 
                               onchange="updateFilteredTotal('${user.id}')" />
                    </td>
                    <td class="total-meals" id="filter_total_${user.id}">
                        ${total.toFixed(1)}
                    </td>
                </tr>
            `;
        }

        const userIds = users.map(u => u.id);
        const saveButtonHTML = `
            <tr>
                <td colspan="6" style="text-align: right; padding: 1rem; border-top: 2px solid var(--border-color);">
                    <button class="btn btn-primary" 
                            onclick='saveFilteredMeals(${JSON.stringify(userIds)}, "${date}")'>
                        Save All Meals for ${utils.formatDate(date)}
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML = tbodyHTML + saveButtonHTML;

    } catch (error) {
        console.error('Error filtering meals:', error);
        utils.showToast('Failed to load meals', 'error');
    } finally {
        utils.showLoading(false);
    }
}

// Helper to update total in the filtered table
window.updateFilteredTotal = function(userId) {
    const breakfast = parseFloat(document.getElementById(`filter_breakfast_${userId}`)?.value || 0);
    const lunch = parseFloat(document.getElementById(`filter_lunch_${userId}`)?.value || 0);
    const dinner = parseFloat(document.getElementById(`filter_dinner_${userId}`)?.value || 0);
    const totalEl = document.getElementById(`filter_total_${userId}`);
    if (totalEl) {
        totalEl.textContent = (breakfast + lunch + dinner).toFixed(1);
    }
};

// Helper to save all meals from the filtered table
window.saveFilteredMeals = async function(userIds, date) {
    if (!Array.isArray(userIds) || !date) {
        utils.showToast('Error: Missing data to save', 'error');
        return;
    }
    utils.showLoading(true);
    utils.showToast(`Saving all meals for ${date}...`, 'success');

    try {
        const savePromises = userIds.map(userId => {
            const breakfast = parseFloat(document.getElementById(`filter_breakfast_${userId}`)?.value || 0);
            const lunch = parseFloat(document.getElementById(`filter_lunch_${userId}`)?.value || 0);
            const dinner = parseFloat(document.getElementById(`filter_dinner_${userId}`)?.value || 0);
            return saveMeal(userId, date, { breakfast, lunch, dinner });
        });
        await Promise.all(savePromises);
        utils.showToast('All meals saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving filtered meals:', error);
        utils.showToast('Failed to save meals', 'error');
    } finally {
        utils.showLoading(false);
    }
};


// "Edit Today's Meals" function (uses getMealByDate to pull defaults)
// --- UPDATED: Accepts list of users ---
async function loadTodayMealsEditor(users) {
    const today = utils.getTodayDate();
    
    const titleEl = document.getElementById('todayMealsTitle');
    if (titleEl) {
        titleEl.textContent = `Edit Meals for Today (${utils.formatDate(today)})`;
    }

    const tbody = document.querySelector('#todayMealTrackingTable tbody');
    if (!tbody) return;

    try {
        // const users = allUsersCache; // <-- No longer needed, passed as arg
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No approved users found.</td></tr>`;
            return;
        }

        let tbodyHTML = '';
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const meal = await getMealByDate(user.id, today); // This one still gets defaults
            const total = (meal.breakfast || 0) + (meal.lunch || 0) + (meal.dinner || 0);

            tbodyHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${utils.escapeHTML(user.name)}</td>
                    <td>
                        <input type="number" step="0.5" min="0" class="meal-filter-input"
                               id="today_breakfast_${user.id}" value="${meal.breakfast}" 
                               onchange="updateTodayTotal('${user.id}')" />
                    </td>
                    <td>
                        <input type="number" step="0.5" min="0" class="meal-filter-input"
                               id="today_lunch_${user.id}" value="${meal.lunch}" 
                               onchange="updateTodayTotal('${user.id}')" />
                    </td>
                    <td>
                        <input type="number" step="0.5" min="0" class="meal-filter-input"
                               id="today_dinner_${user.id}" value="${meal.dinner}" 
                               onchange="updateTodayTotal('${user.id}')" />
                    </td>
                    <td class="total-meals" id="today_total_${user.id}">
                        ${total.toFixed(1)}
                    </td>
                </tr>
            `;
        }
        
        const userIds = users.map(u => u.id);
        const saveButtonHTML = `
            <tr>
                <td colspan="6" style="text-align: right; padding: 1rem; border-top: 2px solid var(--border-color);">
                    <button class="btn btn-primary" 
                            onclick='saveAllTodayMeals(${JSON.stringify(userIds)}, "${today}")'>
                        Save All Today's Meals
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML = tbodyHTML + saveButtonHTML;
        
    } catch (error) {
        console.error('Error loading meal editor:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading meal editor</td></tr>`;
    }
}

// Helper to update total in today's table
window.updateTodayTotal = function(userId) {
    const breakfast = parseFloat(document.getElementById(`today_breakfast_${userId}`)?.value || 0);
    const lunch = parseFloat(document.getElementById(`today_lunch_${userId}`)?.value || 0);
    const dinner = parseFloat(document.getElementById(`today_dinner_${userId}`)?.value || 0);
    const totalEl = document.getElementById(`today_total_${userId}`);
    if (totalEl) {
        totalEl.textContent = (breakfast + lunch + dinner).toFixed(1);
    }
};

// Helper to save all meals from today's table
window.saveAllTodayMeals = async function(userIds, date) {
    if (!Array.isArray(userIds) || !date) {
        utils.showToast('Error: No users to save', 'error');
        return;
    }
    utils.showLoading(true);
    utils.showToast('Saving all meals...', 'success');

    try {
        const savePromises = userIds.map(userId => {
            const breakfast = parseFloat(document.getElementById(`today_breakfast_${userId}`)?.value || 0);
            const lunch = parseFloat(document.getElementById(`today_lunch_${userId}`)?.value || 0);
            const dinner = parseFloat(document.getElementById(`today_dinner_${userId}`)?.value || 0);
            return saveMeal(userId, date, { breakfast, lunch, dinner });
        });
        await Promise.all(savePromises);
        utils.showToast('All meals saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving all meals:', error);
        utils.showToast('Failed to save all meals', 'error');
    } finally {
        utils.showLoading(false);
    }
};


// ========== INITIALIZE ON LOAD ==========

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeManager);
} else {
    initializeManager();
}
