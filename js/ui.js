// --- UI Selectors (Consider making these constants if IDs don't change) ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const usernameDisplay = document.getElementById('username-display');
const chatBox = document.getElementById('chat-box');
const chatListDiv = document.getElementById('chat-list');
const titleElement = document.getElementById('chat-title');
const loadingIndicator = document.querySelector('.loading-indicator');


// --- UI Update Functions ---
export function showAuthUI() {
    if (authContainer) authContainer.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
}

export function showAppUI() {
    if (authContainer) authContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    // Initial chat load should be triggered from chat.js after auth success
}

export function updateUsernameDisplay(username) {
     if (usernameDisplay) {
        usernameDisplay.textContent = username || '';
    }
}

export function updateChatTitle(title) {
    if (titleElement) {
        titleElement.textContent = title || "AI Chatbot";
    }
}

export function showLoading(isLoading) {
     if (loadingIndicator) {
        loadingIndicator.classList.toggle('hidden', !isLoading);
     }
}

export function clearChatBox() {
     if (chatBox) {
        chatBox.querySelectorAll('.message-container').forEach(el => el.remove());
     }
}

export function clearChatList() {
    if (chatListDiv) {
        chatListDiv.innerHTML = '';
    }
}

// --- Message Rendering ---
export function displayMessage(content, sender, isStreaming = false) {
    if (!chatBox) return null; // Return null if chatBox isn't found

    const messageContainer = document.createElement('div');
    const messageBubbleWrapper = document.createElement('div');
    const messageDiv = document.createElement('div');

    messageContainer.classList.add('flex', 'mb-4', 'message-container');
    messageBubbleWrapper.classList.add('message-bubble-wrapper');
    messageDiv.classList.add('p-3', 'rounded-lg', 'shadow-md', 'break-words');

    if (sender === 'user') {
        messageDiv.classList.add('bg-blue-600', 'text-white'); // Slightly darker blue
        messageContainer.classList.add('user');
        messageBubbleWrapper.classList.add('ml-auto');
        messageDiv.textContent = content;
    } else if (sender === 'bot') {
        messageDiv.classList.add('bg-gray-100', 'text-gray-900', 'bot-message');
        messageContainer.classList.add('bot');
        messageBubbleWrapper.classList.add('mr-auto');
        if (isStreaming) {
            messageDiv.innerHTML = '<span class="streaming-cursor">▋</span>'; // Initial content for streaming
        } else {
             renderMarkdown(messageDiv, content); // Render immediately if not streaming
        }
    } else { // error
        messageDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
        messageContainer.classList.add('bot'); // Align like bot message
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

    return messageBubbleWrapper; // Return wrapper for stream handling
}

export function renderArchivedMessage(content, sender) {
     if (!chatBox) return;
    // Similar to displayMessage but simplified for archived content
    const messageContainer = document.createElement('div');
    const messageBubbleWrapper = document.createElement('div');
    const messageDiv = document.createElement('div');

    messageContainer.classList.add('flex', 'mb-4', 'message-container');
    messageBubbleWrapper.classList.add('message-bubble-wrapper');
    messageDiv.classList.add('p-3', 'rounded-lg', 'shadow-md', 'break-words');

    if (sender === 'user') {
        messageDiv.classList.add('bg-blue-600', 'text-white');
        messageContainer.classList.add('user');
        messageBubbleWrapper.classList.add('ml-auto');
        messageDiv.textContent = content;
    } else { // bot
        messageDiv.classList.add('bg-gray-100', 'text-gray-900', 'bot-message');
        messageContainer.classList.add('bot');
        messageBubbleWrapper.classList.add('mr-auto');
        renderMarkdown(messageDiv, content); // Render stored markdown
        addCopyButtonsToBotMessage(messageBubbleWrapper, content); // Add buttons on load
    }

    messageBubbleWrapper.appendChild(messageDiv);
    messageContainer.appendChild(messageBubbleWrapper);
    chatBox.appendChild(messageContainer);
}

export function renderChatListItem(chatId, chat, isActive, switchChatCallback, deleteChatCallback) {
    if (!chatListDiv) return;

    const listItem = document.createElement('div');
    listItem.classList.add('chat-list-item');
    listItem.dataset.chatId = chatId;
    if (isActive) {
        listItem.classList.add('active');
    }

    const titleSpan = document.createElement('span');
    titleSpan.textContent = chat.title || `Chat ${chatId.substring(5)}`;
    listItem.appendChild(titleSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-chat-btn');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = 'Delete Chat';
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteChatCallback(chatId); // Call callback from chat.js
    });
    listItem.appendChild(deleteBtn);

    listItem.addEventListener('click', () => switchChatCallback(chatId)); // Call callback from chat.js
    chatListDiv.appendChild(listItem);
}


// --- Markdown & Copy Buttons ---
function renderMarkdown(element, text) {
    // Ensure marked and DOMPurify are loaded (consider using imports if possible)
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        element.innerHTML = DOMPurify.sanitize(marked.parse(text || ''));
    } else {
        console.warn("marked or DOMPurify not loaded. Displaying raw text.");
        element.textContent = text || ''; // Fallback
    }
}

export function addCopyButtonsToBotMessage(bubbleWrapper, fullText) {
    const messageDiv = bubbleWrapper.querySelector('.bot-message');
    if (!messageDiv) return;

    // Re-parse the complete Markdown content
    renderMarkdown(messageDiv, fullText);

    // Add general copy button
    if (!bubbleWrapper.querySelector('.copy-button')) { // Prevent duplicates
        const generalCopyButton = document.createElement('button');
        generalCopyButton.classList.add('copy-button');
        generalCopyButton.innerHTML = '<i class="fas fa-copy"></i>';
        generalCopyButton.title = 'Copy all text';
        generalCopyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            copyTextToClipboard(messageDiv.innerText, generalCopyButton);
        });
        bubbleWrapper.appendChild(generalCopyButton);
    }

    // Add specific code copy buttons
    const codeBlocks = messageDiv.querySelectorAll('pre');
    codeBlocks.forEach(preElement => {
        if (!preElement.querySelector('.code-copy-button')) { // Prevent duplicates
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
        }
    });
     scrollToBottom(); // Final scroll after adding buttons
}

function copyTextToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text)
      .then(() => {
        const originalIcon = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-check"></i>';
        buttonElement.classList.add('copied');
        buttonElement.disabled = true;
        setTimeout(() => {
          buttonElement.innerHTML = originalIcon;
          buttonElement.classList.remove('copied');
          buttonElement.disabled = false;
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
}

// --- Scrolling ---
export function scrollToBottom() {
  setTimeout(() => {
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, 50);
}
