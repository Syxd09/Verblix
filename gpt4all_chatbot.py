from gpt4all import GPT4All
import sys

# Load the model
model = GPT4All("path/to/your/gpt4all-model.bin")  # Replace with your model path

def chat():
    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            break
        response = model.generate(user_input)
        print("Chatbot:", response)

if __name__ == "__main__":
    chat()
