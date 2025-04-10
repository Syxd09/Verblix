const { GoogleGenerativeAI } = require('@google/generative-ai');

// Modify function to return the stream iterator
const generateSmartResponseStream = async (message, history = []) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const filteredHistory = history.slice(0, -1); // Remove latest user message

        const chat = model.startChat({
            history: filteredHistory,
            generationConfig: {
                // maxOutputTokens: 1000, // Optional
            }
        });

        // Use sendMessageStream for conversational streaming
        const result = await chat.sendMessageStream(message);
        return result.stream; // Return the AsyncGenerator stream

    } catch (error) {
        console.error("Failed to initiate smart response stream:", error);
        // Throw the error so the calling function can handle it appropriately for SSE
        throw error;
    }
};

// Keep the non-streaming version if needed elsewhere, or remove it
// const generateSmartResponse = async (...) => { ... }

module.exports = {
    // Export the streaming function
    generateSmartResponseStream,
    // generateSmartResponse // Keep if needed
};
