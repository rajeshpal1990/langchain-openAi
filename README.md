# Express + LangChain + Google GenAI Chat System

A simple chat system built with Express, LangChain, and Google's Gemini Pro.

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure environment variables:**
    Create a `.env` file in the root directory (one has been created for you) and add your Google API Key:
    ```env
    GOOGLE_API_KEY=your_gemini_api_key_here
    PORT=3000
    ```

3.  **Run the server:**
    ```bash
    # Development mode (with auto-reload)
    npm run dev

    # Production mode
    npm start
    ```

## API Endpoints

### POST `/api/chat`

Send a message to the chat system.

**Request Body:**
```json
{
  "message": "Hello, how are you?",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help you today?" }
  ]
}
```

**Response:**
```json
{
  "response": "I'm doing well, thank you for asking! How about you?",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help you today?" },
    { "role": "user", "content": "Hello, how are you?" },
    { "role": "assistant", "content": "I'm doing well, thank you for asking! How about you?" }
  ]
}
```

## Technologies Used

- **Express**: Fast, unopinionated, minimalist web framework for Node.js.
- **LangChain**: Framework for developing applications powered by large language models.
- **Google Generative AI**: Accessing Gemini models via LangChain.
- **Dotenv**: For environment variable management.
- **CORS**: To allow cross-origin requests.
