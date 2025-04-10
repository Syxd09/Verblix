require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    fetchTrivia,
    fetchQuotes,
    fetchJokes,
    fetchNews,
    fetchMovies,
    fetchNASAData
} = require('./utils/api-handlers');
const { generateSmartResponse, generateSmartResponseStream } = require('./utils/search-services');

const app = express();
const port = process.env.PORT || 3001;

// Middleware setup - Ensure these are high up
app.use(cors());
// Increase payload size limit (e.g., to 10MB for testing)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files (CSS, JS) from the directory containing server.js
app.use(express.static(__dirname));

// Explicitly serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Static Dataset
let dataset;
try {
    dataset = require('./utils/dataset'); // Ensure this path is correct
    console.log('Dataset loaded successfully:', dataset ? 'Yes' : 'No');
    if (!dataset) {
        throw new Error('Dataset file loaded but is empty or invalid.');
    }
} catch (error) {
    console.error('Failed to load dataset:', error);
    // Provide a default empty structure to prevent crashes, or handle differently
    dataset = { facts: {}, jokes: { science: [], programming: [] }, quotes: { inspiration: [] }, riddles: [], greetings: [] };
    console.warn('Using default empty dataset due to loading error.');
}

// Utility to calculate expressions safely
function calculate(expression) {
    try {
        expression = expression.replace(/\s+/g, '');
        if (!/^[\d+\-*/().]+$/.test(expression)) {
            return "Invalid expression. Please use only numbers and basic operators (+, -, *, /).";
        }
        return new Function('return ' + expression)().toString();
    } catch (error) {
        return "Sorry, I couldn't calculate that. Please check your expression.";
    }
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function formatResponse(text, type = 'default') {
    return { type, text };
}

// Refined isBasicQuery function
function isBasicQuery(message) {
    const basicKeywords = [
        'joke', 'fact', 'quote', 'riddle', 'help', 'hi', 'hello', 'hey'
        // Removed 'calculate' - handled separately
        // Removed operators - handled separately
    ];
    // Separate check for calculation intent
    const calculationKeywords = ['calculate'];
    const operatorRegex = /[\d\s()]*[+\-*/][\d\s()]+/; // Looks for pattern like number operator number

    message = message.toLowerCase();

    // Check 1: Does it contain a basic keyword as a whole word?
    const hasBasicKeyword = basicKeywords.some(pattern => {
        // Use word boundaries (\b) to match whole words only
        const regex = new RegExp(`\\b${pattern}\\b`);
        return regex.test(message);
    });

    if (hasBasicKeyword) {
        console.log(`isBasicQuery: Matched basic keyword in "${message}"`);
        return true;
    }

    // Check 2: Does it look like a calculation request?
    const hasCalculationKeyword = calculationKeywords.some(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`);
        return regex.test(message);
    });
    const looksLikeCalculation = operatorRegex.test(message);

    if (hasCalculationKeyword || looksLikeCalculation) {
        console.log(`isBasicQuery: Matched calculation intent in "${message}"`);
        return true;
    }

    // If none of the above, it's not considered a basic query
    console.log(`isBasicQuery: No basic match found in "${message}"`);
    return false;
}

function handleBuiltInResponses(message) {
    // Add a check at the beginning of the function
    if (!dataset) {
        console.error('Dataset is not available in handleBuiltInResponses.');
        return formatResponse("Sorry, I'm currently unable to access my internal knowledge base.", 'error');
    }

    message = message.toLowerCase();

    if (message.includes('calculate') || /[\d+\-*/()]/.test(message)) {
        const expression = message.replace(/[^0-9+\-*/().\s]/g, '');
        const result = calculate(expression);
        return formatResponse(`The result is: ${result}`, 'calculation');
    }

    if (message.includes('fact')) {
        if (message.includes('space')) {
            const nasaData = fetchNASAData();
            return formatResponse(`Here's a space fact from NASA: ${nasaData.title}\n${nasaData.explanation}`, 'fact');
        } else if (message.includes('movie')) {
            const movies = fetchMovies('random');
            const movie = movies[0];
            return formatResponse(`Movie Fact:\n${movie.title} (${movie.release_date})\n${movie.overview}`, 'fact');
        } else {
            // Check if dataset.facts exists and has keys
            if (dataset.facts && Object.keys(dataset.facts).length > 0) {
                const keys = Object.keys(dataset.facts);
                return formatResponse(getRandomItem(dataset.facts[getRandomItem(keys)]), 'fact');
            } else {
                return formatResponse("Sorry, I don't have any facts right now.", 'default');
            }
        }
    }

    if (message.includes('joke')) {
        // Check specific joke categories
        if (message.includes('science') && dataset.jokes?.science?.length > 0) {
            return formatResponse(getRandomItem(dataset.jokes.science), 'joke');
        } else if (dataset.jokes?.programming?.length > 0) { // Default to programming jokes if available
            return formatResponse(getRandomItem(dataset.jokes.programming), 'joke');
        } else {
             return formatResponse("Sorry, I'm out of jokes at the moment.", 'default');
        }
    }

    if (message.includes('quote')) {
         if (dataset.quotes?.inspiration?.length > 0) {
            return formatResponse(getRandomItem(dataset.quotes.inspiration), 'quote');
         } else {
            return formatResponse("Sorry, I don't have any quotes right now.", 'default');
         }
    }

    if (message.includes('riddle')) {
        if (dataset.riddles?.length > 0) {
            const riddle = getRandomItem(dataset.riddles);
            return formatResponse(`${riddle.question}\nAnswer: ${riddle.answer}`, 'riddle');
        } else {
            return formatResponse("Sorry, I can't think of any riddles right now.", 'default');
        }
    }

    if (dataset.greetings && dataset.greetings.includes(message.trim())) {
        return formatResponse("Hello! How can I assist you today?", 'greeting');
    }

    return formatResponse("I'm not sure how to respond to that. Try asking for a joke, quote, or fact!", 'default');
}

// SSE endpoint for chat
app.post('/chat-stream', async (req, res) => { // Changed route name for clarity
    console.log('Received a chat stream request');
    const { message, history } = req.body;

    console.log(`Received message length: ${message?.length || 0}`);
    console.log(`Received history length: ${history?.length || 0} turns`);

    if (!message) {
        return res.status(400).json({ type: 'error', text: 'Bad Request: No message provided.' });
    }
    if (history && !Array.isArray(history)) {
         return res.status(400).json({ type: 'error', text: 'Bad Request: Invalid history format.' });
    }

    // --- SSE Setup ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish the connection

    try {
        // Handle basic queries directly (no streaming needed)
        // This check now uses the refined isBasicQuery
        if (isBasicQuery(message)) {
            console.log('Handling built-in response for stream request...');
            const response = handleBuiltInResponses(message);
            // Send the built-in response as a single SSE event
            res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
            res.write(`event: end\ndata: {}\n\n`); // Signal end
            res.end();
            return;
        }

        // Get the stream from the LLM service
        console.log('Attempting to generate smart response stream...');
        const stream = await generateSmartResponseStream(message, history);

        // Iterate over the stream and send chunks
        for await (const chunk of stream) {
            try {
                const chunkText = chunk.text();
                // console.log('Sending chunk:', chunkText); // Debug log for chunks
                const responseChunk = { type: 'ai', text: chunkText };
                res.write(`event: message\ndata: ${JSON.stringify(responseChunk)}\n\n`);
            } catch (chunkError) {
                 console.error('Error processing stream chunk:', chunkError);
                 // Decide if you want to send an error event or just log
                 // res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', text: 'Error processing stream chunk.' })}\n\n`);
            }
        }
        // Signal the end of the stream
        res.write(`event: end\ndata: {}\n\n`);
        res.end(); // Close the connection

    } catch (error) {
        console.error('Error in /chat-stream endpoint:', error);
        // Send an error event before closing if possible
        const errorMessage = { type: 'error', text: `Stream generation failed: ${error.message}` };
        try {
            res.write(`event: error\ndata: ${JSON.stringify(errorMessage)}\n\n`);
        } catch (writeError) {
            console.error("Failed to write error event to SSE:", writeError);
        }
        res.end(); // Ensure connection is closed on error
    }

    // Keep connection alive for SSE (handled by stream end/error)
    req.on('close', () => {
        console.log('Client disconnected from chat stream');
        res.end(); // Ensure connection is closed if client disconnects
    });
});

app.listen(port, () => {
    console.log(`Chatbot server running at http://localhost:${port}`);
});
