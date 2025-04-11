# AccessAlly AI - Accessible AI Chat Assistant

AccessAlly AI is a web-based application designed to provide an accessible communication interface for individuals with disabilities, particularly those who may face challenges with seeing, hearing, or speaking. It leverages the power of Google's Gemini AI combined with Speech-to-Text (STT) and Text-to-Speech (TTS) capabilities to facilitate interaction.

The project aims to make digital communication easier by providing multiple input and output methods, along with features tailored for accessibility and user convenience.

<!-- Add a screenshot or GIF demo here -->
![AccessAlly AI Demo](https://github.com/belepod/AccessAlly-ChatBot/blob/main/image_2025-04-11_211606587.png)

## Key Features

*   **AI Chat:** Engage in conversations powered by the Google Gemini (`gemini-1.5-flash`) language model.
*   **Speech-to-Text (STT):** Use your microphone to dictate messages, which are transcribed into text.
*   **Text-to-Speech (TTS):** Bot responses and summaries are automatically converted to audible speech. Includes basic pause/resume controls.
*   **Per-User History & Notes:**
    *   Conversations are saved locally (in the `history` directory) based on a chosen username (CSV format).
    *   A dedicated notepad panel allows users to take personal notes, which are also saved locally (in the `notes` directory) per username (TXT format).
    *   History and notes load automatically when a user is set.
*   **Conversation Management:**
    *   Summarize the current chat history (both short and detailed options).
    *   Clear the conversation history and associated notes for the current user.
    *   Export the conversation history to a downloadable `.txt` file.
*   **Accessibility Focused:**
    *   **Theme Selection:** Switch between Dark, Light, and High Contrast themes.
    *   **Font Size Control:** Increase or decrease the application's base font size.
    *   **ARIA Attributes:** Implemented throughout for better screen reader compatibility.
    *   **Keyboard Navigation:** Basic support for interacting via keyboard.
*   **Utilities:**
    *   **Quick Phrases:** Buttons for sending common pre-defined messages quickly.
    *   **Notepad Panel:** Toggleable side panel for quick note-taking.
    *   **Copy Last Response:** Button to quickly copy the AI's last message text to the notepad.
    *   **Copy Messages:** Click or press Enter on chat messages (user/bot) to copy their content.
    *   **Distress Keyword Detection:** Basic client-side check for keywords that might indicate distress, displaying a dismissible prompt.
*   **Simulated SOS Feature:**
    *   A prominent SOS button displays a *simulated* emergency call overlay. **IMPORTANT:** This feature **DOES NOT** contact real emergency services. It serves as a visual simulation or placeholder.

## Technology Stack

*   **Backend:** Python 3.7+, Flask
*   **AI Model:** Google Gemini API (`google-generativeai` library)
*   **Speech-to-Text:** `SpeechRecognition` library (using Google Web Speech API)
*   **Text-to-Speech:** `gTTS` (Google Text-to-Speech library)
*   **Audio Processing:** `pydub` (Requires **FFmpeg** installation)
*   **Frontend:** HTML5, CSS3, JavaScript (ES6+)
*   **Data Storage:** Local file system (CSV for history, TXT for notes - **Demo purposes only**)
*   **Environment Variables:** `python-dotenv`

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Python:** Version 3.7 or higher.
2.  **pip:** Python package installer (usually comes with Python).
3.  **Virtual Environment Tool:** `venv` (standard library).
4.  **FFmpeg:** **Crucial for audio processing.** Download from [ffmpeg.org](https://ffmpeg.org/download.html) and ensure the `ffmpeg` (and `ffprobe`) executables are in your system's **PATH**. Verify by opening a terminal and typing `ffmpeg -version`.
5.  **Google Gemini API Key:**
    *   Obtain an API key from [Google AI Studio](https://aistudio.google.com/) or Google Cloud Console.
    *   Ensure the "Generative Language API" (or "Vertex AI API") is enabled for your project.
6.  **Web Browser:** A modern browser supporting the Web Audio API and `navigator.mediaDevices.getUserMedia` (e.g., Chrome, Firefox, Edge).

## Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/belepod/AccessAlly-ChatBot.git
    cd AccessAlly-ChatBot
    ```

2.  **Create and Activate a Virtual Environment:**
    *   **Windows:**
        ```bash
        python -m venv venv
        venv\Scripts\activate
        ```
    *   **macOS / Linux:**
        ```bash
        python3 -m venv venv
        source venv/bin/activate
        ```

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create `.env` File:**
    Create a file named `.env` in the project's root directory (`AccessAlly-AI/`). Add your Gemini API key to this file:
    ```text
    GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
    ```
    Replace `YOUR_ACTUAL_API_KEY_HERE` with your key.

5.  **Verify FFmpeg:**
    Ensure FFmpeg is installed and correctly added to your system's PATH. Run `ffmpeg -version` in your terminal. If the command is not found, `pydub` will fail during audio processing.

## Running the Application

1.  Make sure your virtual environment is activated.
2.  Run the Flask application from the project root directory:
    ```bash
    flask run
    ```
3.  Open your web browser and navigate to `http://127.0.0.1:5000` (or the address provided in the terminal).

## Usage Guide

1.  **Set Username:** Upon opening the app, enter a desired username in the input field at the top and click "Set User". This username determines the local files used for saving/loading your chat history and notes. Usernames should only contain letters, numbers, underscores, and hyphens.
2.  **Chatting:**
    *   **Text Input:** Type your message in the text area and press Enter or click the "Send" button.
    *   **Voice Input:** Click the "Record" button, grant microphone permission if prompted, speak your message, and click "Stop". Your speech will be transcribed and sent.
    *   **Quick Phrases:** Click any of the quick phrase buttons below the chat box to instantly send that message.
3.  **Listening:** Bot responses are automatically read aloud using TTS. Use the pause/resume buttons that appear below the chat input when audio is playing.
4.  **Accessibility Controls (Header):**
    *   Use the +/- buttons to adjust the overall font size.
    *   Use the dropdown menu to select a visual theme (Dark, Light, High Contrast). Preferences are saved locally.
5.  **Notepad (Side Panel):**
    *   Click the "Notes" button in the header to toggle the visibility of the notepad panel.
    *   Type freely in the notepad area. Notes are saved automatically after a short delay.
    *   Click "Copy Last Bot Msg" to append the AI's most recent response to your notes.
6.  **Conversation Actions (Buttons Below Input):**
    *   **Short Sum / Long Sum:** Request a brief or detailed summary of the current user's chat history.
    *   **Clear All:** Permanently deletes the chat history and notes files for the currently set user. **Use with caution.**
    *   **Export (Header):** Downloads the current user's chat history as a `.txt` file.
7.  **Copying Messages:** Click (or focus and press Enter) on any user or bot message bubble in the chat to copy its text content to your clipboard.
8.  **SOS Button (Top Right):** Click this button to view the **simulated** emergency alert screen. Click "Close Notification" or press Escape to dismiss it. **This does not call for help.**

## Important Notes

*   **SOS is Simulated:** The SOS feature is **for demonstration only** and **DOES NOT** contact emergency services.
*   **Local Data Storage:** User history and notes are saved as plain files (`.csv`, `.txt`) in the `history/` and `notes/` directories on the *server machine* where the Flask app is running. This is suitable only for single-user local testing or demonstration. **It is not a secure or scalable multi-user solution.** Data is tied to the username entered.
*   **API Key Security:** Keep your `.env` file secure and do not commit it to version control. Add `.env` to your `.gitignore` file.
*   **FFmpeg Dependency:** The application *will not* correctly process audio input (STT) without FFmpeg installed and accessible via the system PATH.
*   **Browser Permissions:** You will need to grant microphone permission to your browser for the Speech-to-Text feature to work.
*   **Demo Purpose:** This project serves as a functional demonstration. It lacks robust error handling, security measures, and scalability needed for a production environment.

## Future Enhancements

*   Implement proper user authentication and database storage for history/notes.
*   Integrate more robust, potentially paid, STT/TTS services (e.g., Google Cloud Speech-to-Text/Text-to-Speech, Azure Cognitive Services) for better accuracy and language support.
*   Add options for selecting different TTS voices and speeds.
*   Allow users to customize quick phrases.
*   Improve contextual understanding in AI prompts by passing more conversation history.
*   Implement real-time highlighting of text being spoken by TTS.
*   Add support for image input/description (if using multimodal models).
*   Thorough accessibility audit and refinement using screen readers and other assistive tools.

## Contributing

Contributions are welcome! Please feel free to fork the repository, make changes, and submit pull requests. For major changes, please open an issue first to discuss what you would like to add.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
