let conversationHistory = [];
let currentBotMessageDiv = null; // To append stream chunks
let currentBotMessageWrapper = null; // Wrapper for the bot message bubble
let currentEventSource = null; // To manage the EventSource connection

const sendMessage = async () => {
  const input = document.getElementById('user-input');
  const message = input.value.trim();

  if (!message) return;

  // Close any existing EventSource connection before starting a new one
  if (currentEventSource) {
      currentEventSource.close();
      currentEventSource = null;
      console.log("Previous EventSource closed.");
  }


  const currentMessage = message;
  input.value = '';
  input.style.height = 'auto';
  input.style.height = '40px';

  displayMessage(currentMessage, 'user');
  conversationHistory.push({ role: 'user', parts: [{ text: currentMessage }] });

  const loadingIndicator = document.querySelector('.loading-indicator');
  loadingIndicator.classList.remove('hidden');
  scrollToBottom();

  // --- Use EventSource ---
  // Note: EventSource uses GET by default. We need POST.
  // Workaround: Send initial data via a separate POST, get an ID, then connect EventSource with ID.
  // Simpler (but less standard) approach for this example: Use fetch to initiate, then handle stream in response (Not true SSE)
  // True SSE with POST often requires libraries or more complex setup.
  // Let's stick to fetch but process the stream from the response body. This is NOT Server-Sent Events.
  // --- CORRECTION: We will refactor the server endpoint to GET for EventSource simplicity, passing data via query params (less ideal for large history/messages) ---
  // --- FINAL DECISION: Keep server as POST, use fetch and manually read the stream from response.body. This avoids GET limitations but isn't standard SSE client handling. ---

  // --- Using fetch to handle the stream ---
  try {
      const response = await fetch('/chat-stream', { // Use the new stream endpoint
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: currentMessage, history: conversationHistory }),
      });

      loadingIndicator.classList.add('hidden'); // Hide loading once headers are received

      if (!response.ok) {
          // Handle non-OK responses (e.g., 400 Bad Request)
          let errorData;
          try {
              errorData = await response.json();
          } catch (parseError) {
              throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
          }
           throw new Error(errorData?.text || `HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
          throw new Error("Response body is null.");
      }

      // Prepare for streaming display
      currentBotMessageWrapper = displayMessage("", 'bot', true); // Create container, return wrapper
      currentBotMessageDiv = currentBotMessageWrapper.querySelector('.bot-message'); // Get the bubble div
      let fullResponseText = ""; // Accumulate text for history

      // Read the stream
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

      while (true) {
          const { value, done } = await reader.read();
          if (done) {
              console.log("Stream finished.");
              // Add copy buttons after stream is complete
              addCopyButtonsToBotMessage(currentBotMessageWrapper, fullResponseText);
              // Add final response to history
              if (fullResponseText) {
                  conversationHistory.push({ role: 'model', parts: [{ text: fullResponseText }] });
                   // Optional: Limit history size
                   const MAX_HISTORY_LENGTH = 20;
                   if (conversationHistory.length > MAX_HISTORY_LENGTH) {
                       conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY_LENGTH);
                   }
              }
              currentBotMessageDiv = null; // Reset for next message
              currentBotMessageWrapper = null;
              break;
          }

          // Process SSE formatted chunks manually
          const lines = value.split('\n');
          for (const line of lines) {
              if (line.startsWith('event: message')) {
                  // Next line should be data
              } else if (line.startsWith('data:')) {
                  try {
                      const jsonData = JSON.parse(line.substring(5)); // Get data part
                      if (jsonData.type === 'error') {
                          console.error("Received error event:", jsonData.text);
                          // Display error within the current bot message bubble or create new error display
                          currentBotMessageDiv.innerHTML += `<p class="text-red-500">⚠️ ${jsonData.text}</p>`;
                          fullResponseText += `\nERROR: ${jsonData.text}`; // Add error to history text
                      } else if (jsonData.text) {
                          // Append text chunk to the current bot message div
                          // We need to handle Markdown incrementally, which is tricky.
                          // Simplest: Append text and re-render Markdown on each chunk (inefficient)
                          // Better: Append text directly, parse Markdown at the end (done above)
                          // For now, just append raw text, parse at end.
                          // To show *something*, append directly. Parse happens when stream ends.
                          currentBotMessageDiv.innerHTML += jsonData.text.replace(/\n/g, '<br>'); // Basic display, replace newlines
                          fullResponseText += jsonData.text;
                          scrollToBottom(); // Scroll as content is added
                      }
                  } catch (e) {
                      // Ignore lines that are not valid JSON data or other events like 'end'
                      // console.log("Skipping non-JSON data line:", line);
                  }
              } else if (line.startsWith('event: end')) {
                  // The 'end' event is handled by the `done` condition of the reader loop
                  console.log("Received end event.");
              } else if (line.startsWith('event: error')) {
                   // Handled by the data: line processing above if data is JSON
                   console.log("Received error event line (check data).");
              }
          }
      }

  } catch (error) {
      console.error('Error sending/streaming message:', error);
      loadingIndicator.classList.add('hidden'); // Ensure loading is hidden on error
      displayMessage(`⚠️ Error: ${error.message}`, 'error');
      currentBotMessageDiv = null; // Reset
      currentBotMessageWrapper = null;
  }
};


// Modify displayMessage to handle stream initialization and return the wrapper
const displayMessage = (content, sender, isStreaming = false) => {
  const chatBox = document.getElementById('chat-box');
  const messageContainer = document.createElement('div');
  const messageBubbleWrapper = document.createElement('div');
  const messageDiv = document.createElement('div');

  // ... (Set classes for container, wrapper, bubble as before) ...
  messageContainer.classList.add('flex', 'mb-4', 'message-container');
  messageBubbleWrapper.classList.add('message-bubble-wrapper');
  messageDiv.classList.add('p-3', 'rounded-lg', 'shadow-md', 'break-words');


  if (sender === 'user') {
    // ... (user message setup as before) ...
    messageDiv.classList.add('bg-blue-500', 'text-white');
    messageContainer.classList.add('user');
    messageBubbleWrapper.classList.add('ml-auto');
    messageDiv.textContent = content;
    messageBubbleWrapper.appendChild(messageDiv);
    messageContainer.appendChild(messageBubbleWrapper);
  } else if (sender === 'bot') {
    messageDiv.classList.add('bg-gray-100', 'text-gray-900', 'bot-message');
    messageContainer.classList.add('bot');
    messageBubbleWrapper.classList.add('mr-auto');

    if (isStreaming) {
        messageDiv.innerHTML = ''; // Start empty for streaming
    } else {
        // For non-streaming messages (like initial errors or built-in responses)
        const sanitizedHtml = DOMPurify.sanitize(marked.parse(content));
        messageDiv.innerHTML = sanitizedHtml;
    }

    messageBubbleWrapper.appendChild(messageDiv);
    messageContainer.appendChild(messageBubbleWrapper);

    // Add copy buttons only if NOT streaming (will be added at end of stream)
    if (!isStreaming && content) {
        addCopyButtonsToBotMessage(messageBubbleWrapper, content);
    }

  } else { // Error display
    // ... (error message setup as before) ...
      messageDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
      messageContainer.classList.add('bot');
      messageBubbleWrapper.classList.add('mr-auto');
      messageDiv.textContent = content;
      messageBubbleWrapper.appendChild(messageDiv);
      messageContainer.appendChild(messageBubbleWrapper);
  }

  chatBox.appendChild(messageContainer);
  if (!isStreaming) { // Don't scroll excessively during streaming init
      scrollToBottom();
  }

  // Return the wrapper for streaming reference
  return messageBubbleWrapper;
};

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


// ... (rest of script: copyTextToClipboard, scrollToBottom, event listeners, clear chat) ...
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
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 0);
}

document.getElementById('send-btn').addEventListener('click', sendMessage);

// Updated event listener for textarea
const userInput = document.getElementById('user-input');
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Prevent default Enter behavior (new line)
    sendMessage();
    // Reset textarea height after sending
    userInput.style.height = 'auto';
    userInput.style.height = '40px'; // Reset to min-height or initial rows=1 height
  }
  // Shift+Enter will naturally create a new line in textarea
});
