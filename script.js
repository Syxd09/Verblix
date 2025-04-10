// --- Chat History Management ---
let chats = {}; // Object to hold all chat sessions { chatId: { history: [], title: "" } }
let activeChatId = null;
const CHATS_STORAGE_KEY = 'aiChatbotSessions';

function loadChats() {
    const storedChats = localStorage.getItem(CHATS_STORAGE_KEY);
    if (storedChats) {
        chats = JSON.parse(storedChats);
        // Find the most recent chat to make active, or the first one
        const chatIds = Object.keys(chats);
        if (chatIds.length > 0) {
            // Simple approach: make the first one active. Could be improved (e.g., store last active ID)
            activeChatId = chatIds[0];
        } else {
            createNewChat(); // Create a new chat if none exist
        }
    } else {
        createNewChat(); // Create initial chat if storage is empty
    }
    renderChatList();
    loadChat(activeChatId); // Load the active chat messages
    updateChatTitle(); // Update header title on load
}

function saveChats() {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
}

function createNewChat() {
    const newChatId = `chat_${Date.now()}`;
    chats[newChatId] = { history: [], title: `Chat ${Object.keys(chats).length + 1}` }; // Simple title
    activeChatId = newChatId;
    saveChats();
    renderChatList();
    loadChat(activeChatId); // Clear display for the new chat
    console.log(`Created and switched to new chat: ${newChatId}`);
    updateChatTitle(); // Update header title for new chat
}

function switchChat(chatId) {
    if (!chats[chatId] || chatId === activeChatId) return;
    activeChatId = chatId;
    loadChat(activeChatId);
    renderChatList(); // Update active state in the list
    console.log(`Switched to chat: ${chatId}`);
    updateChatTitle(); // Update header title on switch
}

function deleteChat(chatIdToDelete) {
    if (!chats[chatIdToDelete]) return;

    const chatTitle = chats[chatIdToDelete].title || `Chat ${chatIdToDelete.substring(5)}`;
    // Confirmation dialog
    if (!confirm(`Are you sure you want to delete "${chatTitle}"? This cannot be undone.`)) {
        return;
    }

    console.log(`Deleting chat: ${chatIdToDelete}`);
    delete chats[chatIdToDelete]; // Remove from memory

    // If the deleted chat was the active one, switch to another or create new
    if (activeChatId === chatIdToDelete) {
        const remainingChatIds = Object.keys(chats);
        if (remainingChatIds.length > 0) {
            // Switch to the first remaining chat
            activeChatId = remainingChatIds[0];
        } else {
            // No chats left, create a new one
            activeChatId = null; // Prevent loadChat from running before createNewChat sets it
            createNewChat(); // This will set activeChatId and load it
            saveChats(); // Save after creating new chat
            renderChatList(); // Render the new list
            updateChatTitle();
            return; // Exit function as createNewChat handles the rest
        }
    }

    saveChats(); // Save changes to localStorage
    renderChatList(); // Update the sidebar list
    // If the active chat wasn't deleted, we don't need to reload it.
    // If it was, load the new active chat.
    if (activeChatId !== chatIdToDelete) { // This condition might be redundant now due to above logic
       loadChat(activeChatId);
       updateChatTitle();
    } else {
        // This case should be handled by the logic setting a new activeChatId above
         loadChat(activeChatId);
         updateChatTitle();
    }

}

function deleteAllChats() {
     if (!confirm(`Are you sure you want to delete ALL chat history? This cannot be undone.`)) {
        return;
    }
    console.log("Deleting all chats...");
    chats = {}; // Clear in-memory store
    activeChatId = null;
    localStorage.removeItem(CHATS_STORAGE_KEY); // Clear local storage
    createNewChat(); // Start fresh with a new chat
    // createNewChat already calls renderChatList, loadChat, updateChatTitle
}

function clearActiveChatHistory() {
     if (!activeChatId || !chats[activeChatId]) return;

     const chatTitle = chats[activeChatId].title || `Chat ${activeChatId.substring(5)}`;
     if (!confirm(`Are you sure you want to clear the history for "${chatTitle}"? Messages will be removed, but the chat will remain.`)) {
        return;
     }

     console.log(`Clearing history for chat: ${activeChatId}`);
     chats[activeChatId].history = []; // Clear history array
     saveChats(); // Save the change
     loadChat(activeChatId); // Reload the now empty chat view
}

function loadChat(chatId) {
    if (!chats[chatId]) return;
    const chatBox = document.getElementById('chat-box');
    // Clear existing messages (excluding loading indicator structure)
    chatBox.querySelectorAll('.message-container').forEach(el => el.remove());

    const chat = chats[chatId];
    // Render messages from history
    chat.history.forEach(message => {
        // Determine sender based on role ('user' or 'model')
        const sender = message.role === 'user' ? 'user' : 'bot';
        // Pass the text content
        const content = message.parts[0]?.text || '';
        if (content) {
             // Render message without triggering stream logic or adding copy buttons here
             // A simplified render function might be needed, or adapt displayMessage
             renderArchivedMessage(content, sender);
        }
    });
    scrollToBottom();
    updateChatTitle(); // Ensure title is updated when chat loads
}

// Simplified render function for loading history (doesn't add copy buttons initially)
function renderArchivedMessage(content, sender) {
    const chatBox = document.getElementById('chat-box');
    const messageContainer = document.createElement('div');
    const messageBubbleWrapper = document.createElement('div');
    const messageDiv = document.createElement('div');

    messageContainer.classList.add('flex', 'mb-4', 'message-container');
    messageBubbleWrapper.classList.add('message-bubble-wrapper');
    messageDiv.classList.add('p-3', 'rounded-lg', 'shadow-md', 'break-words');

    if (sender === 'user') {
        messageDiv.classList.add('bg-blue-500', 'text-white');
        messageContainer.classList.add('user');
        messageBubbleWrapper.classList.add('ml-auto');
        messageDiv.textContent = content; // Display as plain text
    } else { // bot
        messageDiv.classList.add('bg-gray-100', 'text-gray-900', 'bot-message');
        messageContainer.classList.add('bot');
        messageBubbleWrapper.classList.add('mr-auto');
        // Parse and sanitize stored HTML/Markdown
        const finalHtml = DOMPurify.sanitize(marked.parse(content));
        messageDiv.innerHTML = finalHtml;
        // Optionally add copy buttons here too if desired for loaded history
        addCopyButtonsToBotMessage(messageBubbleWrapper, content); // Add buttons on load
    }

    messageBubbleWrapper.appendChild(messageDiv);
    messageContainer.appendChild(messageBubbleWrapper);
    chatBox.appendChild(messageContainer);
}


function renderChatList() {
    const chatListDiv = document.getElementById('chat-list');
    chatListDiv.innerHTML = ''; // Clear current list
    const chatIds = Object.keys(chats);

    // Sort chats by timestamp (newest first) - assuming IDs are `chat_${timestamp}`
    chatIds.sort((a, b) => parseInt(b.substring(5)) - parseInt(a.substring(5)));


    chatIds.forEach(chatId => {
        const chat = chats[chatId];
        const listItem = document.createElement('div');
        listItem.classList.add('chat-list-item');
        listItem.dataset.chatId = chatId;
        if (chatId === activeChatId) {
            listItem.classList.add('active');
        }

        // Title Span
        const titleSpan = document.createElement('span');
        titleSpan.textContent = chat.title || `Chat ${chatId.substring(5)}`;
        listItem.appendChild(titleSpan);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-chat-btn');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; // Use trash icon
        deleteBtn.title = 'Delete Chat';
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent chat switch when clicking delete
            deleteChat(chatId);
        });
        listItem.appendChild(deleteBtn);


        listItem.addEventListener('click', () => switchChat(chatId));
        chatListDiv.appendChild(listItem);
    });
}

function updateChatTitle() {
    const titleElement = document.getElementById('chat-title');
    if (activeChatId && chats[activeChatId]) {
        titleElement.textContent = chats[activeChatId].title || `Chat ${activeChatId.substring(5)}`;
    } else {
        titleElement.textContent = "AI Chatbot"; // Default title
    }
}

// --- Modify existing functions ---
let conversationHistory = [];
let currentBotMessageDiv = null; // To append stream chunks
let currentBotMessageWrapper = null; // Wrapper for the bot message bubble
let currentEventSource = null; // To manage the EventSource connection

const sendMessage = async () => {
    const input = document.getElementById('user-input');
    const message = input.value.trim();

    if (!message || !activeChatId || !chats[activeChatId]) return; // Check active chat exists

    const currentMessage = message;
    input.value = '';
    input.style.height = 'auto';
    input.style.height = '40px';

    // Display user message immediately in the active chat
    displayMessage(currentMessage, 'user');
    // Add user message to the *active* chat's history
    chats[activeChatId].history.push({ role: 'user', parts: [{ text: currentMessage }] });
    // Update chat title based on first message if it's empty
    if (chats[activeChatId].history.length === 1 && !chats[activeChatId].title.startsWith("Chat ")) {
         chats[activeChatId].title = currentMessage.substring(0, 30) + (currentMessage.length > 30 ? '...' : '');
         renderChatList(); // Update list with new title
    }
    // Update chat title based on first message if it's the default title
    if (chats[activeChatId].history.length === 1 && chats[activeChatId].title.startsWith("Chat ")) {
         chats[activeChatId].title = currentMessage.substring(0, 30) + (currentMessage.length > 30 ? '...' : '');
         renderChatList(); // Update list with new title
         updateChatTitle(); // Update header title
    }
    saveChats(); // Save history immediately

    const loadingIndicator = document.querySelector('.loading-indicator');
    loadingIndicator.classList.remove('hidden');
    scrollToBottom();

    try {
        // Send the current message and the history of the *active* chat
        const response = await fetch('/chat-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: currentMessage, history: chats[activeChatId].history }), // Send active history
        });

        // ... (rest of the fetch stream handling logic remains largely the same) ...
        loadingIndicator.classList.add('hidden');

        if (!response.ok) { /* ... error handling ... */ throw new Error(`HTTP error! status: ${response.status}`); }
        if (!response.body) { /* ... error handling ... */ throw new Error("Response body is null."); }

        currentBotMessageWrapper = displayMessage("", 'bot', true);
        currentBotMessageDiv = currentBotMessageWrapper.querySelector('.bot-message');
        let fullResponseText = "";

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                addCopyButtonsToBotMessage(currentBotMessageWrapper, fullResponseText);
                if (fullResponseText && activeChatId && chats[activeChatId]) { // Check active chat still exists
                    chats[activeChatId].history.push({ role: 'model', parts: [{ text: fullResponseText }] });
                    saveChats(); // Save updated history
                }
                currentBotMessageDiv = null;
                currentBotMessageWrapper = null;
                break;
            }
            // Process stream chunks (same logic as before)
             const lines = value.split('\n');
             for (const line of lines) {
                 if (line.startsWith('data:')) {
                     try {
                         const jsonData = JSON.parse(line.substring(5));
                         if (jsonData.text) {
                             currentBotMessageDiv.innerHTML += jsonData.text.replace(/\n/g, '<br>');
                             fullResponseText += jsonData.text;
                             scrollToBottom();
                         } else if (jsonData.type === 'error') {
                             // Handle error display
                             currentBotMessageDiv.innerHTML += `<p class="text-red-500">⚠️ ${jsonData.text}</p>`;
                             fullResponseText += `\nERROR: ${jsonData.text}`;
                         }
                     } catch (e) { /* ignore */ }
                 }
             }
        }

    } catch (error) {
        console.error('Error sending/streaming message:', error);
        loadingIndicator.classList.add('hidden');
        displayMessage(`⚠️ Error: ${error.message}`, 'error');
        currentBotMessageDiv = null;
        currentBotMessageWrapper = null;
    }
};

// Modify displayMessage slightly - it's mostly okay, but called by loadChat too
// The main change is that it doesn't add to history itself.
const displayMessage = (content, sender, isStreaming = false) => {
    // ... (Function body remains largely the same as previous version) ...
    // It renders the message bubble based on sender and content/streaming state
    // It returns the messageBubbleWrapper
    const chatBox = document.getElementById('chat-box');
    const messageContainer = document.createElement('div');
    const messageBubbleWrapper = document.createElement('div');
    const messageDiv = document.createElement('div');

    messageContainer.classList.add('flex', 'mb-4', 'message-container');
    messageBubbleWrapper.classList.add('message-bubble-wrapper');
    messageDiv.classList.add('p-3', 'rounded-lg', 'shadow-md', 'break-words');

    if (sender === 'user') {
        messageDiv.classList.add('bg-blue-500', 'text-white');
        messageContainer.classList.add('user');
        messageBubbleWrapper.classList.add('ml-auto');
        messageDiv.textContent = content;
    } else if (sender === 'bot') {
        messageDiv.classList.add('bg-gray-100', 'text-gray-900', 'bot-message');
        messageContainer.classList.add('bot');
        messageBubbleWrapper.classList.add('mr-auto');
        if (isStreaming) {
            messageDiv.innerHTML = ''; // Start empty
        } else {
            // Render non-streaming content (e.g., built-in responses)
             const finalHtml = DOMPurify.sanitize(marked.parse(content));
             messageDiv.innerHTML = finalHtml;
        }
    } else { // error
        messageDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
        messageContainer.classList.add('bot');
        messageBubbleWrapper.classList.add('mr-auto');
        messageDiv.textContent = content;
    }

    messageBubbleWrapper.appendChild(messageDiv);
    messageContainer.appendChild(messageBubbleWrapper);
    chatBox.appendChild(messageContainer);

    // Add copy buttons only if NOT streaming (added at end of stream otherwise)
    if (sender === 'bot' && !isStreaming && content) {
        addCopyButtonsToBotMessage(messageBubbleWrapper, content);
    }

     if (!isStreaming) {
         scrollToBottom();
     }

    return messageBubbleWrapper; // Return wrapper
};


// --- Initial Load and Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Load existing chats first
    loadChats();

    // Now attach all event listeners since the DOM is ready
    const sendButton = document.getElementById('send-btn');
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    } else {
        console.error("Send button not found");
    }

    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
            userInput.style.height = 'auto';
            userInput.style.height = '40px';
          }
        });
    } else {
        console.error("User input textarea not found");
    }

    const clearHistoryButton = document.getElementById('clear-chat-history-btn');
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', clearActiveChatHistory);
    } else {
        console.error("Clear chat history button not found");
    }

    const deleteAllButton = document.getElementById('delete-all-btn');
    if (deleteAllButton) {
        deleteAllButton.addEventListener('click', deleteAllChats);
    } else {
        console.error("Delete all chats button not found");
    }

    const newChatButton = document.getElementById('new-chat-btn');
    if (newChatButton) {
        newChatButton.addEventListener('click', createNewChat);
    } else {
        console.error("New chat button not found");
    }

    // Note: The old clear-chat button listener might be redundant or incorrect now
    // Ensure the correct button ID ('clear-chat-history-btn') is used
    // Remove the old listener if it exists targeting a different ID
    /*
    const oldClearChatButton = document.getElementById('clear-chat'); // Example if old ID was different
    if (oldClearChatButton) {
        // Remove or update its listener if necessary
    }
    */

}); // End DOMContentLoaded

// Function to add copy buttons after content is finalized
function addCopyButtonsToBotMessage(bubbleWrapper, fullText) {
    const messageDiv = bubbleWrapper.querySelector('.bot-message');
    if (!messageDiv) return;

    // Re-parse the complete Markdown content now that streaming is done
    const finalHtml = DOMPurify.sanitize(marked.parse(fullText));
    messageDiv.innerHTML = finalHtml;


    // Add general copy button
    const generalCopyButton = document.createElement('button');
    generalCopyButton.classList.add('copy-button');
    generalCopyButton.innerHTML = '<i class="fas fa-copy"></i>';
    generalCopyButton.title = 'Copy all text';
    generalCopyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTextToClipboard(messageDiv.innerText, generalCopyButton); // Copy rendered text
    });
    // Ensure button isn't added multiple times if function is called again
    if (!bubbleWrapper.querySelector('.copy-button')) {
       bubbleWrapper.appendChild(generalCopyButton);
    }


    // Add specific code copy buttons
    const codeBlocks = messageDiv.querySelectorAll('pre');
    codeBlocks.forEach(preElement => {
        // Ensure button isn't added multiple times
        if (preElement.querySelector('.code-copy-button')) return;

        const codeCopyButton = document.createElement('button');
        codeCopyButton.classList.add('code-copy-button');
        codeCopyButton.innerHTML = '<i class="fas fa-copy"></i>';
        codeCopyButton.title = 'Copy code';
        codeCopyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeToCopy = preElement.querySelector('code')?.innerText || preElement.innerText;
            copyTextToClipboard(codeToCopy, codeCopyButton);
        });
        preElement.appendChild(codeCopyButton);
    });
     scrollToBottom(); // Final scroll after adding buttons and finalizing content
}


// Ensure clear chat also closes any active EventSource
document.getElementById('clear-chat').addEventListener('click', () => {
  if (currentEventSource) {
      currentEventSource.close();
      currentEventSource = null;
      console.log("EventSource closed on clear chat.");
  }
  const chatBox = document.getElementById('chat-box');
  chatBox.querySelectorAll('.message-container').forEach(el => el.remove());
  conversationHistory = [];
  // Reset other states if needed
});

// Helper function for clipboard copying and button feedback
function copyTextToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text)
      .then(() => {
        const originalIcon = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-check"></i>';
        buttonElement.classList.add('copied');
        buttonElement.disabled = true; // Disable button briefly
        setTimeout(() => {
          buttonElement.innerHTML = originalIcon;
          buttonElement.classList.remove('copied');
          buttonElement.disabled = false;
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        // Optionally provide visual feedback for error on the button
      });
}

// Auto-scroll function (ensure it's defined correctly)
function scrollToBottom() {
  const chatBox = document.getElementById("chat-box");
  // Use setTimeout to allow the DOM to update before scrolling
  setTimeout(() => {
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, 0);
}
