import { getCurrentUser } from './auth.js';
import {
    displayMessage,
    renderArchivedMessage,
    renderChatListItem,
    clearChatBox,
    clearChatList,
    updateChatTitle,
    scrollToBottom,
    showLoading,
    addCopyButtonsToBotMessage
} from './ui.js';

let chats = {};
let activeChatId = null;
const CHATS_STORAGE_KEY = 'aiChatbotSessions'; // Consider prefixing with username if storing per user

let currentBotMessageDiv = null;
let currentBotMessageWrapper = null;

// --- Chat State Management ---
export function loadChats() {
    if (!getCurrentUser()) return; // Need user context if storing per user

    const storedChats = localStorage.getItem(CHATS_STORAGE_KEY); // Load generic key for now
    if (storedChats) {
        chats = JSON.parse(storedChats);
        const chatIds = Object.keys(chats);
        if (chatIds.length > 0) {
            // Sort by timestamp (newest first) to make the latest active
             chatIds.sort((a, b) => parseInt(b.substring(5)) - parseInt(a.substring(5)));
             activeChatId = chatIds[0]; // Activate the newest chat
        } else {
            createNewChat();
        }
    } else {
        createNewChat();
    }
    renderChatListUI(); // Use UI function
    loadActiveChatUI(); // Use UI function
}

function saveChats() {
    if (!getCurrentUser()) return;
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
}

export function createNewChat() {
    const newChatId = `chat_${Date.now()}`;
    const newChatNumber = Object.keys(chats).length + 1;
    chats[newChatId] = { history: [], title: `Chat ${newChatNumber}` };
    activeChatId = newChatId;
    saveChats();
    renderChatListUI();
    loadActiveChatUI();
    console.log(`Created and switched to new chat: ${newChatId}`);
}

function switchChat(chatId) {
    if (!chats[chatId] || chatId === activeChatId) return;
    activeChatId = chatId;
    loadActiveChatUI();
    renderChatListUI(); // Update active state
    console.log(`Switched to chat: ${chatId}`);
}

function deleteChat(chatIdToDelete) {
     if (!chats[chatIdToDelete]) return;
     const chatTitle = chats[chatIdToDelete].title || `Chat ${chatIdToDelete.substring(5)}`;
     if (!confirm(`Are you sure you want to delete "${chatTitle}"?`)) return;

     console.log(`Deleting chat: ${chatIdToDelete}`);
     delete chats[chatIdToDelete];

     if (activeChatId === chatIdToDelete) {
        const remainingChatIds = Object.keys(chats);
         if (remainingChatIds.length > 0) {
             remainingChatIds.sort((a, b) => parseInt(b.substring(5)) - parseInt(a.substring(5)));
             activeChatId = remainingChatIds[0]; // Switch to newest remaining
         } else {
             activeChatId = null;
             createNewChat(); // Creates and sets new activeChatId
             saveChats();
             renderChatListUI();
             loadActiveChatUI();
             return; // Exit as createNewChat handles the rest
         }
     }
     saveChats();
     renderChatListUI();
     // If the active chat was deleted, load the new active one
     if (activeChatId === chatIdToDelete) { // This condition should now be true if deleted
         loadActiveChatUI();
     }
}

function deleteAllChats() {
     if (!confirm(`Are you sure you want to delete ALL chats?`)) return;
     console.log("Deleting all chats...");
     chats = {};
     activeChatId = null;
     localStorage.removeItem(CHATS_STORAGE_KEY);
     createNewChat(); // Start fresh
}

function clearActiveChatHistory() {
     if (!activeChatId || !chats[activeChatId]) return;
     const chatTitle = chats[activeChatId].title || `Chat ${activeChatId.substring(5)}`;
     if (!confirm(`Clear history for "${chatTitle}"?`)) return;

     console.log(`Clearing history for chat: ${activeChatId}`);
     chats[activeChatId].history = [];
     saveChats();
     loadActiveChatUI(); // Reload empty chat
}

// --- UI Rendering Wrappers ---
function renderChatListUI() {
    clearChatList(); // Use UI function
    const chatIds = Object.keys(chats);
    chatIds.sort((a, b) => parseInt(b.substring(5)) - parseInt(a.substring(5))); // Sort newest first
    chatIds.forEach(chatId => {
        renderChatListItem(chatId, chats[chatId], chatId === activeChatId, switchChat, deleteChat); // Use UI function
    });
}

function loadActiveChatUI() {
    clearChatBox(); // Use UI function
    if (activeChatId && chats[activeChatId]) {
        const chat = chats[activeChatId];
        updateChatTitle(chat.title); // Use UI function
        chat.history.forEach(message => {
            const sender = message.role === 'user' ? 'user' : 'bot';
            const content = message.parts[0]?.text || '';
            if (content) {
                renderArchivedMessage(content, sender); // Use UI function
            }
        });
        scrollToBottom(); // Use UI function
    } else {
         updateChatTitle(null); // Reset title if no active chat
    }
}


// --- Send Message Logic ---
export async function sendMessage() {
    if (!getCurrentUser()) {
        console.error("Cannot send message: User not logged in.");
        return;
    }
     const input = document.getElementById('user-input');
     if (!input) return;
     const message = input.value.trim();

    if (!message || !activeChatId || !chats[activeChatId]) return;

    const currentMessage = message;
    input.value = '';
    input.style.height = 'auto';
    input.style.height = '40px';

    displayMessage(currentMessage, 'user'); // Use UI function
    chats[activeChatId].history.push({ role: 'user', parts: [{ text: currentMessage }] });

    // Update title
    if (chats[activeChatId].history.length === 1 && chats[activeChatId].title.startsWith("Chat ")) {
         chats[activeChatId].title = currentMessage.substring(0, 30) + (currentMessage.length > 30 ? '...' : '');
         renderChatListUI();
         updateChatTitle(chats[activeChatId].title);
    }
    saveChats();

    showLoading(true); // Use UI function
    scrollToBottom(); // Use UI function

    try {
        const response = await fetch('/chat-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: currentMessage, history: chats[activeChatId].history }),
            credentials: 'include'
        });

        showLoading(false); // Hide loading once headers received

        if (response.status === 401) {
            console.error("Unauthorized. Session likely expired.");
            // Potentially call logout function from auth.js
            // handleLogout(); // Needs to be imported or handled differently
            alert("Session expired. Please log in again."); // Simple feedback
            window.location.reload(); // Force reload to trigger login check
            return;
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        if (!response.body) throw new Error("Response body is null.");

        currentBotMessageWrapper = displayMessage("", 'bot', true); // Use UI function
        if (!currentBotMessageWrapper) throw new Error("Failed to create message bubble."); // Check if bubble was created
        currentBotMessageDiv = currentBotMessageWrapper.querySelector('.bot-message');
        if (!currentBotMessageDiv) throw new Error("Failed to find message div in bubble."); // Check if div exists

        let fullResponseText = "";
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // Remove streaming cursor if present
                const cursor = currentBotMessageDiv.querySelector('.streaming-cursor');
                if (cursor) cursor.remove();

                addCopyButtonsToBotMessage(currentBotMessageWrapper, fullResponseText); // Use UI function
                if (fullResponseText && activeChatId && chats[activeChatId]) {
                    chats[activeChatId].history.push({ role: 'model', parts: [{ text: fullResponseText }] });
                    saveChats();
                }
                currentBotMessageDiv = null;
                currentBotMessageWrapper = null;
                break;
            }
            // Process stream chunks
             const lines = value.split('\n');
             for (const line of lines) {
                 if (line.startsWith('data:')) {
                     try {
                         const jsonData = JSON.parse(line.substring(5));
                         if (jsonData.text) {
                             // Remove cursor before appending
                             const cursor = currentBotMessageDiv.querySelector('.streaming-cursor');
                             if (cursor) cursor.remove();
                             // Append new text + cursor
                             currentBotMessageDiv.innerHTML += jsonData.text.replace(/\n/g, '<br>') + '<span class="streaming-cursor">▋</span>';
                             fullResponseText += jsonData.text;
                             scrollToBottom(); // Use UI function
                         } else if (jsonData.type === 'error') {
                             currentBotMessageDiv.innerHTML += `<p class="text-red-500">⚠️ ${jsonData.text}</p>`;
                             fullResponseText += `\nERROR: ${jsonData.text}`;
                         }
                     } catch (e) { /* ignore */ }
                 }
             }
        }

    } catch (error) {
        console.error('Error sending/streaming message:', error);
        showLoading(false);
        displayMessage(`⚠️ Error: ${error.message}`, 'error'); // Use UI function
        currentBotMessageDiv = null;
        currentBotMessageWrapper = null;
    }
}

// --- Initialization ---
export function initializeChat() {
     // Attach listeners for APP buttons related to chat
    const sendButton = document.getElementById('send-btn');
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    else console.error("Send button not found");

    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });
         // Auto-resize listener
         userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
        });
    } else console.error("User input textarea not found");

    const clearHistoryButton = document.getElementById('clear-chat-history-btn');
    if (clearHistoryButton) clearHistoryButton.addEventListener('click', clearActiveChatHistory);
    else console.error("Clear chat history button not found");

    const deleteAllButton = document.getElementById('delete-all-btn');
    if (deleteAllButton) deleteAllButton.addEventListener('click', deleteAllChats);
    else console.error("Delete all chats button not found");

    const newChatButton = document.getElementById('new-chat-btn');
    if (newChatButton) newChatButton.addEventListener('click', createNewChat);
    else console.error("New chat button not found");

    // Note: loadChats is called by auth.js after successful login check
}
