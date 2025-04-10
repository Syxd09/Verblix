// Basic dataset structure

const dataset = {
  greetings: ["hi", "hello", "hey", "good morning", "good afternoon"],
  facts: {
    science: [
      "The Earth revolves around the Sun.",
      "Water boils at 100 degrees Celsius at sea level.",
      "The speed of light is approximately 299,792 kilometers per second."
    ],
    history: [
      "The Great Wall of China is the longest wall in the world.",
      "World War II ended in 1945.",
      "The first moon landing was in 1969."
    ]
  },
  jokes: {
    programming: [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "There are 10 types of people in the world: those who understand binary, and those who don't.",
      "Why did the web developer break up with the graphic designer? They didn't see eye to eye on the interface."
    ],
    science: [
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call a lazy kangaroo? Pouch potato!",
        "Why did the biologist break up with the physicist? They had no chemistry."
    ]
  },
  quotes: {
    inspiration: [
      { content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
      { content: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
      { content: "The mind is everything. What you think you become.", author: "Buddha" }
    ]
  },
  riddles: [
    { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "An echo" },
    { question: "What has an eye, but cannot see?", answer: "A needle" },
    { question: "What is full of holes but still holds water?", answer: "A sponge" }
  ]
};

module.exports = dataset;
