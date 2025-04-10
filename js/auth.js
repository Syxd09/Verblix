import { loadChats } from './chat.js'; // Import necessary chat functions
import { showAppUI, showAuthUI, updateUsernameDisplay } from './ui.js';

let currentUser = null;

export function getCurrentUser() {
    return currentUser;
}

export async function checkLoginStatus() {
    try {
        const response = await fetch('/auth/status', { credentials: 'include' });
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        if (data.loggedIn && data.user) {
            currentUser = data.user;
            console.log('User is logged in:', currentUser.username);
            updateUsernameDisplay(currentUser.username);
            showAppUI();
        } else {
            currentUser = null;
            console.log('User is not logged in.');
            showAuthUI();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        currentUser = null;
        showAuthUI();
    }
}

async function handleLogin() {
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMsg = document.getElementById('login-error');
    if (!loginUsernameInput || !loginPasswordInput || !loginErrorMsg) return;

    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    if (!username || !password) {
        loginErrorMsg.textContent = 'Please enter username and password.';
        return;
    }
    loginErrorMsg.textContent = '';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            updateUsernameDisplay(currentUser.username);
            showAppUI();
        } else {
            loginErrorMsg.textContent = data.message || 'Login failed.';
        }
    } catch (error) {
        console.error('Login request failed:', error);
        loginErrorMsg.textContent = 'Login request failed. Please try again.';
    }
}

async function handleRegister() {
    const registerUsernameInput = document.getElementById('register-username');
    const registerPasswordInput = document.getElementById('register-password');
    const registerErrorMsg = document.getElementById('register-error');
     if (!registerUsernameInput || !registerPasswordInput || !registerErrorMsg) return;

    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();
     if (!username || !password) {
        registerErrorMsg.textContent = 'Please enter username and password.';
        return;
    }
     if (password.length < 6) {
         registerErrorMsg.textContent = 'Password must be at least 6 characters.';
         return;
     }
    registerErrorMsg.textContent = '';

    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
             updateUsernameDisplay(currentUser.username);
            showAppUI();
        } else {
            registerErrorMsg.textContent = data.message || 'Registration failed.';
        }
    } catch (error) {
        console.error('Registration request failed:', error);
        registerErrorMsg.textContent = 'Registration request failed. Please try again.';
    }
}

async function handleLogout() {
    try {
        await fetch('/auth/logout', { method: 'GET', credentials: 'include' });
        currentUser = null;
        // Clear chat state via chat module if needed
        // clearAllLocalChats(); // Assuming a function exists in chat.js
        showAuthUI();
        // Clear UI elements managed by ui.js
        // clearChatListUI();
        // clearChatBoxUI();
        // updateChatTitleUI(null); // Reset title
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

export function initializeAuth() {
    // Attach listeners for AUTH buttons
    const loginButton = document.getElementById('login-btn');
    if (loginButton) loginButton.addEventListener('click', handleLogin);
    else console.error("Login button not found");

    const registerButton = document.getElementById('register-btn');
    if (registerButton) registerButton.addEventListener('click', handleRegister);
    else console.error("Register button not found");

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    else console.error("Logout button not found");

    // Initial check
    checkLoginStatus();
}
