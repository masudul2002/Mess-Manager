# SSTU Guest House Meal Manager

A modern, real-time web application to efficiently manage a university guest house's daily meals, market expenses, shared costs, and user deposits. Built with vanilla JavaScript, modern CSS, and a Firebase backend.

## ✨ Features

This application is split into two distinct dashboards for managers and users, providing a seamless and real-time experience.

### 🔒 NEW: User Approval System
* **Pending Status:** New users who sign up (via Email or Google) are created with a `pending` status.
* **Manager Approval:** Managers have a new "Status" column in their "Users" dashboard. They can see pending users and "Approve" them with a single click.
* **Secure Access:** Pending users cannot log in. They are shown a message that their account is awaiting approval.
* **Safe Calculations:** Pending users are automatically excluded from all financial calculations (meal rate, shared costs, balances) until they are approved.

### 🧑‍💼 Manager Dashboard (Admin)

* **📈 Real-Time Overview:** A live dashboard showing key mess statistics like total balance, meal rate, total costs, and total deposits for all *approved* users.
* **📊 Data Visualization:** Interactive pie and bar charts showing a breakdown of all costs and total meals per user.
* **👥 User Management:**
    * Approve or delete pending users.
    * Delete existing (approved) users.
    * Add new users (who are approved by default).
* **💸 Cost Management:** Full CRUD (Create, Read, Update, Delete) functionality for all mess expenses:
    * **Market Costs:** Log daily market expenses.
    * **Shared Costs:** Log monthly expenses shared by all approved users.
    * **Individual Costs:** Assign specific costs to individual users.
* **💵 Deposit Management:** Full CRUD functionality to add, edit, or delete user deposits.
* **🍴 Meal Management:**
    * Enter daily meals (breakfast, lunch, dinner) for all *approved* users on a single page.
    * Ability to edit meal records for any previous date for any user.
* **⚙️ Global Settings:** Configure the default meal values.

### 🙍‍♂️ User Dashboard (Border)

* **📊 Real-Time Personal Dashboard:** A live dashboard showing the user's personal summary, including their total meals, total deposit, current balance, and a full breakdown of their costs (meal cost, shared cost, individual cost).
* **📅 Meal Calendar:** A view-only calendar showing the meal data entered by the manager.
* **💰 Deposit History:** A view-only table showing a history of all deposits made by the user.
* **⚙️ Personal Settings:** Ability for users to set their own default meal values.

## 🚀 Tech Stack

* **Frontend:** Vanilla HTML, CSS, and JavaScript (ES6+ Modules)
* **Backend:** Google Firebase
    * **Authentication:** Firebase Auth (Email/Password & Google Sign-In)
    * **Database:** Cloud Firestore (utilizing real-time `onSnapshot` listeners)
* **Data Visualization:** Chart.js
* **Deployment:** Vercel

## 🔧 Running Locally

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/kawsarafat/sstu-guest-house.git](https://github.com/kawsarafat/sstu-guest-house.git)
    cd sstu-guest-house
    ```

2.  **Firebase Setup:**
    * This project is already configured to point to a specific Firebase project.
    * To run with your own Firebase project, you must:
        1.  Create a new project on the [Firebase Console](https://console.firebase.google.com/).
        2.  Enable **Authentication** (Email/Password and Google providers).
        3.  Create a **Cloud Firestore** database.
        4.  In your Firebase project settings, create a new "Web App".
        5.  Copy the `firebaseConfig` object.

3.  **Update Config:**
    * Paste your `firebaseConfig` object into `firebase-config.js`.

4.  **Run the application:**
    * The easiest way to run this locally (due to ES6 Modules) is with a simple live server.
    * If you have VS Code, you can use the **"Live Server"** extension.
    * If you have Node.js, you can use `serve`:
        ```sh
        npm install -g serve
        serve
        ```
    * Open `http://localhost:3000` (or the URL provided by your server) in your browser.
