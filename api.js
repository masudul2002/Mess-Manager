import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot, // Import onSnapshot for real-time listeners
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// deleteDoc is exported for use in manager.js
// --- FIX: Removed updateUser from this line ---
export { deleteDoc };

// ============ REAL-TIME SUBSCRIPTIONS (onSnapshot) ============

/**
 * Subscribes to changes in the users collection.
 * @param {function} callback Function to call with the users array on update.
 * @returns {function} Unsubscribe function.
 */
export function onUsersUpdate(callback) {
  const q = query(collection(window.db, 'users'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(users);
    },
    (error) => {
      console.error('Error listening to users:', error);
      callback([], error);
    }
  );
}

/**
 * Subscribes to changes in a user's meals for a specific month.
 * @param {string} userId The user's ID.
 * @param {string} month The month (YYYY-MM).
 * @param {function} callback Function to call with the meals array on update.
 * @returns {function} Unsubscribe function.
 */
export function onUserMealsUpdate(userId, month, callback) {
  const q = query(
    collection(window.db, 'meals'),
    where('userId', '==', userId),
    where('month', '==', month),
    orderBy('date', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(meals);
    },
    (error) => {
      console.error('Error listening to user meals:', error);
      callback([], error);
    }
  );
}

/**
 * Subscribes to changes in all meals for a specific month.
 * @param {string} month The month (YYYY-MM).
 * @param {function} callback Function to call with the meals array on update.
 * @returns {function} Unsubscribe function.
 */
export function onAllMealsUpdate(month, callback) {
  const q = query(
    collection(window.db, 'meals'),
    where('month', '==', month)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(meals);
    },
    (error) => {
      console.error('Error listening to all meals:', error);
      callback([], error);
    }
  );
}

/**
 * Subscribes to deposits for a specific month (all users or one user).
 * @param {string} userId 'all' for all users, or a specific user ID.
 * @param {string} month The month (YYYY-MM).
 * @param {function} callback Function to call with the deposits array on update.
 * @returns {function} Unsubscribe function.
 */
export function onDepositsUpdate(userId, month, callback) {
  let q;
  if (userId === 'all') {
    q = query(
      collection(window.db, 'deposits'),
      where('month', '==', month),
      orderBy('date', 'desc')
    );
  } else {
    q = query(
      collection(window.db, 'deposits'),
      where('userId', '==', userId),
      where('month', '==', month),
      orderBy('date', 'desc')
    );
  }

  return onSnapshot(q, async (snapshot) => {
    try {
      const users = await getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));

      const deposits = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          userName: userMap.get(data.userId) || 'Unknown User'
        };
      });
      callback(deposits);
    } catch (error) {
      console.error('Error mapping user names to deposits:', error);
      callback([], error);
    }
  }, (error) => {
    console.error('Error listening to deposits:', error);
    callback([], error);
  });
}

/**
 * Subscribes to all costs for a specific month.
 * @param {string} month The month (YYYY-MM).
 * @param {function} callback Function to call with the costs array on update.
 * @returns {function} Unsubscribe function.
 */
export function onCostsUpdate(month, callback) {
  const q = query(
    collection(window.db, 'costs'),
    where('month', '==', month),
    orderBy('date', 'desc')
  );
  
  return onSnapshot(q, async (snapshot) => {
    try {
      const users = await getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));
      
      const costs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          userName: userMap.get(data.userId) || 'Unknown User'
        };
      });
      callback(costs);
    } catch (error) {
      console.error('Error mapping user names to costs:', error);
      callback([], error);
    }
  }, (error) => {
    console.error('Error listening to costs:', error);
    callback([], error);
  });
}

/**
 * Subscribes to changes in the mess settings.
 * @param {function} callback Function to call with the settings object on update.
 * @returns {function} Unsubscribe function.
 */
export function onSettingsUpdate(callback) {
  const docRef = doc(window.db, 'settings', 'mess-settings');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        const defaultSettings = {
          defaultMeals: { breakfast: 0.5, lunch: 1, dinner: 1 },
          currentMonth: new Date().toISOString().substring(0, 7),
          lastResetDate: null,
        };
        callback(defaultSettings);
        setDoc(docRef, defaultSettings).catch(e => console.error("Failed to write default settings", e));
      }
    },
    (error) => {
      console.error('Error listening to settings:', error);
      callback(null, error);
    }
  );
}

// ============ ONE-TIME READS (getDoc / getDocs) ============

/**
 * Fetches all users.
 * Required by manager.js for modal dropdowns.
 */
export async function getAllUsers() {
  try {
    const q = query(collection(window.db, 'users'), orderBy('name', 'asc'));
    const usersSnapshot = await getDocs(q);
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

/**
 * Fetches all meals for a month.
 * Required by manager.js for "Track Meals by Date".
 */
export async function getAllMealsByMonth(month) {
  try {
    const q = query(
      collection(window.db, 'meals'),
      where('month', '==', month)
    );
    
    const mealsSnapshot = await getDocs(q);
    return mealsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all meals:', error);
    throw error;
  }
}

/**
 * Fetches default meals for a user, falling back to global settings.
 * Required by user.js for the settings page.
 */
export async function getUserDefaultMeals(userId) {
  try {
    const userDoc = await getDoc(doc(window.db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.defaultMeals) {
        return userData.defaultMeals;
      }
    }
    const settings = await getSettings();
    return settings.defaultMeals;
  } catch (error) {
    console.error('Error getting user default meals:', error);
    return { breakfast: 0.5, lunch: 1, dinner: 1 };
  }
}

/**
 * Fetches a single meal record for a specific user and date.
 * If no meal exists, it returns the user's default meals.
 * Used for "Edit Today's Meals" to pre-fill.
 */
export async function getMealByDate(userId, date) {
  try {
    const q = query(
      collection(window.db, 'meals'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    
    const mealsSnapshot = await getDocs(q);
    
    if (!mealsSnapshot.empty) {
      const doc = mealsSnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } else {
      const defaults = await getUserDefaultMeals(userId);
      return { 
        breakfast: defaults.breakfast, 
        lunch: defaults.lunch, 
        dinner: defaults.dinner, 
        userId, 
        date 
      };
    }
  } catch (error) {
    console.error('Error getting meal by date:', error);
    return { breakfast: 0.5, lunch: 1, dinner: 1 };
  }
}

/**
 * Fetches a single meal record for "Track Meals by Date".
 * If no meal exists, it returns null (so UI can show 0).
 */
export async function getMealByDate_Track(userId, date) {
  try {
    const q = query(
      collection(window.db, 'meals'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    
    const mealsSnapshot = await getDocs(q);
    if (!mealsSnapshot.empty) {
      const doc = mealsSnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null; // Return null if not found
  } catch (error) {
    console.error('Error getting meal by date (track):', error);
    throw error; // Let the caller handle the error
  }
}


/**
 * Fetches the global settings document.
 * Required by manager.js and user.js.
 */
export async function getSettings() {
  try {
    const settingsDoc = await getDoc(doc(window.db, 'settings', 'mess-settings'));
    if (settingsDoc.exists()) {
      return settingsDoc.data();
    }
    
    return {
      defaultMeals: {
        breakfast: 0.5,
        lunch: 1,
        dinner: 1
      },
      currentMonth: new Date().toISOString().substring(0, 7),
      lastResetDate: null
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
}

// ============ WRITE OPERATIONS (addDoc, updateDoc, deleteDoc) ============

// --- This function is now correctly exported only here ---
export async function updateUser(userId, data) {
  try {
    await updateDoc(doc(window.db, 'users', userId), data);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

export async function deleteUser(userId) {
  try {
    await deleteDoc(doc(window.db, 'users', userId));
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function updateUserDefaultMeals(userId, defaultMeals) {
  try {
    await updateDoc(doc(window.db, 'users', userId), {
      defaultMeals
    });
  } catch (error) {
    console.error('Error updating user default meals:', error);
    throw error;
  }
}

export async function saveMeal(userId, date, mealData) {
  try {
    const month = date.substring(0, 7);
    const totalMeals = (mealData.breakfast || 0) + (mealData.lunch || 0) + (mealData.dinner || 0);
    
    const q = query(
      collection(window.db, 'meals'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    const existingMealSnapshot = await getDocs(q);
    
    if (!existingMealSnapshot.empty) {
      const mealDoc = existingMealSnapshot.docs[0];
      await updateDoc(doc(window.db, 'meals', mealDoc.id), {
        ...mealData,
        totalMeals,
        month,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(window.db, 'meals'), {
        userId,
        date,
        month,
        ...mealData,
        totalMeals,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving meal:', error);
    throw error;
  }
}

// --- UPDATED Function ---
export async function addDeposit(userId, amount, date, description) {
  try {
    const month = date.substring(0, 7);
    
    await addDoc(collection(window.db, 'deposits'), {
      userId,
      amount: parseFloat(amount), // Ensure it's a number (allows negatives)
      date,
      month,
      description: description || 'N/A', // Add description
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding deposit:', error);
    throw error;
  }
}

// --- UPDATED Function ---
export async function updateDeposit(depositId, data) {
  try {
    if (data.date) {
      data.month = data.date.substring(0, 7);
    }
    // Ensure amount is a number
    if (data.amount) {
      data.amount = parseFloat(data.amount);
    }
    
    await updateDoc(doc(window.db, 'deposits', depositId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating deposit:', error);
    throw error;
  }
}

export async function addCost(costData) {
  try {
    const month = costData.date.substring(0, 7);
    
    await addDoc(collection(window.db, 'costs'), {
      ...costData,
      month,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding cost:', error);
    throw error;
  }
}

export async function updateCost(costId, data) {
  try {
    if (data.date) {
      data.month = data.date.substring(0, 7);
    }
    await updateDoc(doc(window.db, 'costs', costId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating cost:', error);
    throw error;
  }
}

export async function deleteCost(costId) {
  try {
    await deleteDoc(doc(window.db, 'costs', costId));
  } catch (error) {
    console.error('Error deleting cost:', error);
    throw error;
  }
}

export async function updateSettings(settings) {
  try {
    await setDoc(doc(window.db, 'settings', 'mess-settings'), settings, { merge: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}


// ============ REAL-TIME SUMMARY CALCULATION ============

export function subscribeToSummaryData(month, callback) {
  let users = [];
  let allMeals = [];
  let allDeposits = [];
  let allCosts = [];

  const calculateAndBroadcast = () => {
    if (!users || !allMeals || !allDeposits || !allCosts) {
      return;
    }

    try {
      const totalMeals = allMeals.reduce((sum, meal) => sum + (meal.totalMeals || 0), 0);
      const totalMarketCost = allCosts
        .filter(cost => cost.type === 'market')
        .reduce((sum, cost) => sum + cost.amount, 0);
      const totalSharedCost = allCosts
        .filter(cost => cost.type === 'shared')
        .reduce((sum, cost) => sum + cost.amount, 0);
      
      // This calculation already supports negative numbers
      const totalAllDeposits = allDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

      const mealRate = totalMeals > 0 ? totalMarketCost / totalMeals : 0;
      
      // --- UPDATED: Only include 'approved' users in calculations ---
      const participatingUsers = users.filter(u => 
          (u.role === 'border' || u.role === 'manager') && 
          u.status !== 'pending'
      );
      // --- END UPDATE ---
      
      const sharedCostPerUser = participatingUsers.length > 0 ? totalSharedCost / participatingUsers.length : 0;

      const userSummaries = participatingUsers.map(user => {
        const userMeals = allMeals
          .filter(meal => meal.userId === user.id)
          .reduce((sum, meal) => sum + (meal.totalMeals || 0), 0);
        
        const userDeposits = allDeposits
          .filter(deposit => deposit.userId === user.id)
          .reduce((sum, deposit) => sum + deposit.amount, 0);
        
        const userIndividualCosts = allCosts
          .filter(cost => cost.type === 'individual' && cost.userId === user.id)
          .reduce((sum, cost) => sum + cost.amount, 0);
        
        const mealCost = userMeals * mealRate;
        const totalCost = mealCost + sharedCostPerUser + userIndividualCosts;
        const balance = userDeposits - totalCost;
        
        return {
          userId: user.id,
          userName: user.name,
          totalMeals: userMeals,
          totalDeposit: userDeposits,
          mealCost,
          sharedCost: sharedCostPerUser,
          individualCost: userIndividualCosts,
          totalCost,
          balance
        };
      });
      
      const totalAllCosts = userSummaries.reduce((sum, user) => sum + user.totalCost, 0);
      const messBalance = totalAllDeposits - totalAllCosts;
      const totalOtherCosts = totalSharedCost + 
        userSummaries.reduce((sum, user) => sum + user.individualCost, 0);

      callback({
        month,
        totalMeals,
        totalMarketCost,
        totalSharedCost,
        totalOtherCosts,
        totalAllDeposits,
        messBalance,
        mealRate,
        sharedCostPerUser,
        userCount: participatingUsers.length,
        userSummaries
      });

    } catch (error) {
      console.error('Error during summary calculation:', error);
    }
  };

  const unsubUsers = onUsersUpdate((data, error) => {
    if (error) return;
    users = data; // Get ALL users (so manager.js can see pending)
    calculateAndBroadcast(); // Calculation will filter them
  });

  const unsubMeals = onAllMealsUpdate(month, (data, error) => {
    if (error) return;
    allMeals = data;
    calculateAndBroadcast();
  });

  const unsubDeposits = onDepositsUpdate('all', month, (data, error) => {
    if (error) return;
    allDeposits = data;
    calculateAndBroadcast();
  });

  const unsubCosts = onCostsUpdate(month, (data, error) => {
    if (error) return;
    allCosts = data;
    calculateAndBroadcast();
  });
  
  return () => {
    unsubUsers();
    unsubMeals();
    unsubDeposits();
    unsubCosts();
  };
}
