require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session'); // Added
const bcrypt = require('bcrypt'); // Added
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

// --- User Storage (In-Memory - NOT FOR PRODUCTION) ---
const users = {}; // { username: { passwordHash: '...', profile: {...} } }
const saltRounds = 10; // For bcrypt

// --- Middleware Setup ---
app.use(cors({
    origin: `http://localhost:${port}`, // Allow requests from frontend origin
    credentials: true // Allow cookies for sessions
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-very-secret-key', // Use env variable for secret
    resave: false,
    saveUninitialized: false, // Don't save sessions for unauthenticated users
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        httpOnly: true, // Prevent client-side JS access
        maxAge: 1000 * 60 * 60 * 24 // Example: 1 day session duration
    }
}));

// Serve static files
app.use(express.static(__dirname));

// Explicitly serve index.html for the root route
app.get('/', (req, res) => {
    // If logged in, serve index.html, otherwise maybe redirect to a login page (or handle client-side)
    // For simplicity, always serve index.html and let client-side JS handle auth state display
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Authentication Middleware ---
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        console.log(`User ${req.session.userId} authenticated.`);
        return next(); // User is logged in
    } else {
        console.log('Authentication failed: No active session.');
        // For API requests, send 401 Unauthorized
        return res.status(401).json({ type: 'error', text: 'Unauthorized: Please log in.' });
    }
}

// --- Authentication Routes ---
app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    if (users[username]) {
        return res.status(409).json({ message: 'Username already exists.' });
    }
    try {
        const passwordHash = await bcrypt.hash(password, saltRounds);
        users[username] = { passwordHash, profile: { username } }; // Store user
        console.log(`User registered: ${username}`);
        // Optionally log the user in immediately after registration
        req.session.userId = username; // Create session
        res.status(201).json({ message: 'Registration successful.', user: { username } });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    const user = users[username];
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }
    try {
        const match = await bcrypt.compare(password, user.passwordHash);
        if (match) {
            req.session.userId = username; // Create session
            console.log(`User logged in: ${username}`);
            res.status(200).json({ message: 'Login successful.', user: { username } });
        } else {
            res.status(401).json({ message: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

app.get('/auth/logout', (req, res) => {
    if (req.session) {
        const username = req.session.userId;
        req.session.destroy(err => {
            if (err) {
                console.error("Logout error:", err);
                return res.status(500).json({ message: 'Could not log out, please try again.' });
            }
            console.log(`User logged out: ${username}`);
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.status(200).json({ message: 'Logout successful.' });
        });
    } else {
        res.status(200).json({ message: 'No active session to log out.' });
    }
});

// Route to check current login status
app.get('/auth/status', (req, res) => {
    if (req.session && req.session.userId) {
        res.status(200).json({ loggedIn: true, user: { username: req.session.userId } });
    } else {
        res.status(200).json({ loggedIn: false });
    }
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

// --- Protected Chat Endpoint ---
// Apply isAuthenticated middleware BEFORE the main handler
app.post('/chat-stream', isAuthenticated, async (req, res) => {
    console.log(`Authenticated chat stream request from user: ${req.session.userId}`);
    const { message, history } = req.body;

    // ... rest of the existing /chat-stream logic ...
    // (No changes needed inside the handler itself regarding auth, middleware handles it)
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
    res.flushHeaders();

    try {
        if (isBasicQuery(message)) {
            // ... handle basic query ...
            console.log('Handling built-in response for stream request...');
            const response = handleBuiltInResponses(message);
            res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
            res.write(`event: end\ndata: {}\n\n`);
            res.end();
            return;
        }

        console.log('Attempting to generate smart response stream...');
        const stream = await generateSmartResponseStream(message, history);

        for await (const chunk of stream) {
            // ... stream chunks ...
             try {
                const chunkText = chunk.text();
                const responseChunk = { type: 'ai', text: chunkText };
                res.write(`event: message\ndata: ${JSON.stringify(responseChunk)}\n\n`);
            } catch (chunkError) {
                 console.error('Error processing stream chunk:', chunkError);
            }
        }
        res.write(`event: end\ndata: {}\n\n`);
        res.end();

    } catch (error) {
        // ... handle stream error ...
        console.error('Error in /chat-stream endpoint:', error);
        const errorMessage = { type: 'error', text: `Stream generation failed: ${error.message}` };
        try {
            res.write(`event: error\ndata: ${JSON.stringify(errorMessage)}\n\n`);
        } catch (writeError) {
            console.error("Failed to write error event to SSE:", writeError);
        }
        res.end();
    }

    req.on('close', () => {
        console.log('Client disconnected from chat stream');
        res.end();
    });
});

app.listen(port, () => {
    console.log(`Chatbot server running at http://localhost:${port}`);
});
