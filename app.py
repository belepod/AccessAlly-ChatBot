import os
import csv
import datetime
import google.generativeai as genai
import speech_recognition as sr
from flask import Flask, render_template, request, jsonify, url_for, send_file
from gtts import gTTS
from pydub import AudioSegment
from dotenv import load_dotenv
import uuid
import logging
import io
import re

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.secret_key = os.urandom(24)

HISTORY_DIR = 'history'
NOTES_DIR = 'notes'
AUDIO_DIR = os.path.join('static', 'audio')
os.makedirs(HISTORY_DIR, exist_ok=True)
os.makedirs(NOTES_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

try:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    logging.info("Gemini API configured successfully using gemini-1.5-flash.")
except Exception as e:
    logging.error(f"CRITICAL: Error configuring Gemini API: {e}")
    model = None

recognizer = sr.Recognizer()


def sanitize_username(username):
    """Basic username sanitization for filesystem usage."""
    if not username or not isinstance(username, str):
        return None
    safe_username = re.sub(r'[\\/*?:"<>|]', "", username)
    safe_username = safe_username[:50].strip()
    if not safe_username:
        return None
    return safe_username

def get_user_file_path(directory, prefix, username_raw):
    """Generates a sanitized file path for user data."""
    username = sanitize_username(username_raw)
    if not username:
        logging.warning(f"Invalid or unsafe username provided: {username_raw}")
        return None
    return os.path.join(directory, f"{prefix}_{username}.{'csv' if directory == HISTORY_DIR else 'txt'}")

def load_user_history(username_raw):
    """Loads conversation history for a specific user from their CSV file."""
    history_path = get_user_file_path(HISTORY_DIR, "history", username_raw)
    if not history_path or not os.path.exists(history_path):
        return []

    history = []
    try:
        with open(history_path, 'r', newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            required_columns = ['role', 'text']
            for i, row in enumerate(reader):
                if all(col in row for col in required_columns):
                    history.append({"role": row['role'], "text": row['text']})
                else:
                    logging.warning(f"Skipping malformed row #{i+1} in {history_path}. Missing columns. Row: {row}")
    except Exception as e:
        logging.error(f"Error loading history for user '{sanitize_username(username_raw)}' from {history_path}: {e}")
        return []
    return history

def save_user_history(username_raw, conversation_history):
    """Saves the current conversation history for a user to their CSV file."""
    history_path = get_user_file_path(HISTORY_DIR, "history", username_raw)
    if not history_path:
        logging.error(f"Aborting history save due to invalid username: {username_raw}")
        return False

    try:
        with open(history_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['timestamp', 'role', 'text']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            for entry in conversation_history:
                if 'role' not in entry or 'text' not in entry:
                    logging.warning(f"Skipping saving entry missing role/text: {entry}")
                    continue
                entry_to_write = entry.copy()
                entry_to_write['timestamp'] = datetime.datetime.now().isoformat()
                writer.writerow(entry_to_write)
        return True
    except Exception as e:
        logging.error(f"Error saving history for user '{sanitize_username(username_raw)}' to {history_path}: {e}")
        return False

def load_user_notes(username_raw):
    """Loads notepad content for a user."""
    notes_path = get_user_file_path(NOTES_DIR, "notes", username_raw)
    if not notes_path or not os.path.exists(notes_path):
        return ""
    try:
        with open(notes_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logging.error(f"Error loading notes for user '{sanitize_username(username_raw)}' from {notes_path}: {e}")
        return ""

def save_user_notes(username_raw, notes_content):
    """Saves notepad content for a user."""
    notes_path = get_user_file_path(NOTES_DIR, "notes", username_raw)
    if not notes_path:
        logging.error(f"Aborting notes save due to invalid username: {username_raw}")
        return False
    try:
        with open(notes_path, 'w', encoding='utf-8') as f:
            f.write(notes_content)
        return True
    except Exception as e:
        logging.error(f"Error saving notes for user '{sanitize_username(username_raw)}' to {notes_path}: {e}")
        return False

def text_to_speech(text, lang='en'):
    """Converts text to speech using gTTS and saves it as an MP3 file."""
    if not text:
        return None
    try:
        tts = gTTS(text=text, lang=lang, slow=False)
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        tts.save(filepath)
        audio_url = url_for('static', filename=f'audio/{filename}', _external=False)
        logging.info(f"Generated TTS audio: {audio_url}")
        return audio_url
    except Exception as e:
        logging.error(f"Error in gTTS text_to_speech: {e}")
        return None

def speech_to_text(audio_file):
    """Converts an audio file (received from browser) to text."""
    if not hasattr(audio_file, 'read'):
        logging.error("Invalid audio file object received in speech_to_text.")
        return None

    temp_wav_path = None
    try:
        logging.info("Converting received audio blob/file...")
        audio = AudioSegment.from_file(audio_file)

        temp_wav_path = os.path.join(AUDIO_DIR, f"temp_stt_{uuid.uuid4()}.wav")
        audio.export(temp_wav_path, format="wav")
        logging.info(f"Temporary WAV file created: {temp_wav_path}")

        with sr.AudioFile(temp_wav_path) as source:
            logging.info("Recording audio data from WAV file for recognition...")
            audio_data = recognizer.record(source)

        logging.info("Sending audio data to Google Speech Recognition...")
        text = recognizer.recognize_google(audio_data)
        logging.info(f"Speech recognized: {text}")
        return text

    except sr.UnknownValueError:
        logging.warning("Google Speech Recognition could not understand audio")
        return None
    except sr.RequestError as e:
        logging.error(f"Could not request results from Google Speech Recognition service; {e}")
        return None
    except Exception as e:
        logging.error(f"Error during speech_to_text processing: {e}", exc_info=True)
        return None
    finally:
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
                logging.info(f"Temporary WAV file deleted: {temp_wav_path}")
            except OSError as e:
                logging.error(f"Error deleting temporary WAV file {temp_wav_path}: {e}")

def get_gemini_response(prompt, context_history=None):
    """Gets a response from the Gemini API. Optionally include history."""
    if not model:
        logging.error("Gemini model not available.")
        return "Error: The AI Chatbot is currently unavailable."
    if not prompt:
        return "Please provide a message."

    try:
        logging.info(f"Sending prompt to Gemini: '{prompt[:50]}...'")
        response = model.generate_content(prompt)
        if response.prompt_feedback and response.prompt_feedback.block_reason:
            logging.warning(f"Gemini response blocked. Reason: {response.prompt_feedback.block_reason}")
            return "I cannot respond to that request due to safety guidelines."

        if not response.text:
            logging.warning("Gemini returned an empty response.")
            return "I received an empty response. Could you try rephrasing?"

        logging.info(f"Received Gemini response: '{response.text[:50]}...'")
        return response.text

    except Exception as e:
        logging.error(f"Error getting response from Gemini: {e}", exc_info=True)
        return "Sorry, I encountered an internal error while processing your request."

def get_gemini_summary(history, length='short'):
    """Gets a summary from the Gemini API based on conversation history."""
    if not model:
        logging.error("Gemini model not available for summary.")
        return "Error: The AI Chatbot is currently unavailable."
    if not history:
        return "There is no conversation history to summarize."

    try:
        conversation_text = "\n".join([f"{msg.get('role', 'unknown').capitalize()}: {msg.get('text', '')}" for msg in history])
        if not conversation_text.strip():
             return "The conversation history appears empty."

        if length == 'long':
            summary_prompt = f"Please provide a detailed summary, covering the key topics, questions asked, and main conclusions or answers provided in the following conversation:\n\n---\n{conversation_text}\n---"
        else:
             summary_prompt = f"Please provide a very concise, one or two sentence summary of the main topic discussed in the following conversation:\n\n---\n{conversation_text}\n---"

        logging.info(f"Requesting Gemini summary (length: {length})...")
        response = model.generate_content(summary_prompt)

        if response.prompt_feedback and response.prompt_feedback.block_reason:
            logging.warning(f"Gemini summary blocked. Reason: {response.prompt_feedback.block_reason}")
            return "I cannot summarize this conversation due to safety guidelines."
        if not response.text:
             logging.warning("Gemini returned an empty summary response.")
             return "I couldn't generate a summary for this conversation. It might be too short or lack clear topics."

        logging.info("Summary generated successfully.")
        return response.text

    except Exception as e:
        logging.error(f"Error getting summary from Gemini: {e}", exc_info=True)
        return "Sorry, I couldn't summarize the conversation due to an internal error."


@app.route('/')
def index():
    """Renders the main chat page."""
    return render_template('index.html')


@app.route('/load_history', methods=['GET'])
def load_history_route():
    """Loads history for a given user."""
    username = request.args.get('username')
    if not sanitize_username(username):
        return jsonify({"error": "Invalid username provided"}), 400

    logging.info(f"Loading history for user: {sanitize_username(username)}")
    history = load_user_history(username)
    return jsonify({"history": history})

@app.route('/load_notes', methods=['GET'])
def load_notes_route():
    """Loads notes for a given user."""
    username = request.args.get('username')
    if not sanitize_username(username):
        return jsonify({"error": "Invalid username provided"}), 400

    logging.info(f"Loading notes for user: {sanitize_username(username)}")
    notes_content = load_user_notes(username)
    return jsonify({"notes": notes_content})

@app.route('/save_notes', methods=['POST'])
def save_notes_route():
    """Saves notes for a given user."""
    data = request.get_json()
    username = data.get('username')
    notes_content = data.get('notes_content', '')

    if not sanitize_username(username):
        return jsonify({"error": "Invalid username provided"}), 400

    logging.info(f"Saving notes for user: {sanitize_username(username)}")
    if save_user_notes(username, notes_content):
        return jsonify({"status": "success", "message": "Notes saved."})
    else:
        return jsonify({"error": "Failed to save notes on server."}), 500


@app.route('/chat', methods=['POST'])
def chat():
    """Handles text chat messages for a specific user."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request format"}), 400

    user_message = data.get('message')
    username = data.get('username')

    if not user_message: return jsonify({"error": "No message received"}), 400
    if not sanitize_username(username): return jsonify({"error": "Invalid username"}), 400

    logging.info(f"Chat request for user '{sanitize_username(username)}'. Message: '{user_message[:50]}...'")

    conversation_history = load_user_history(username)

    conversation_history.append({"role": "user", "text": user_message})

    bot_response_text = get_gemini_response(user_message)

    conversation_history.append({"role": "bot", "text": bot_response_text})

    save_user_history(username, conversation_history)

    audio_url = text_to_speech(bot_response_text)

    return jsonify({
        "user_message": user_message,
        "bot_response": bot_response_text,
        "audio_url": audio_url
    })

@app.route('/recognize', methods=['POST'])
def recognize_speech():
    """Handles speech input, converts to text, gets bot response for a user."""
    if 'audio_data' not in request.files: return jsonify({"error": "No audio file part found"}), 400
    if 'username' not in request.form: return jsonify({"error": "Username required in form data"}), 400

    audio_file = request.files['audio_data']
    username = request.form['username']

    if audio_file.filename == '': return jsonify({"error": "No selected file"}), 400
    if not sanitize_username(username): return jsonify({"error": "Invalid username"}), 400

    logging.info(f"Recognize request for user '{sanitize_username(username)}'.")

    recognized_text = speech_to_text(audio_file)

    if recognized_text is None:
        failed_text = "Sorry, I couldn't understand the audio. Please try speaking clearly."
        audio_url = text_to_speech(failed_text)
        return jsonify({
             "recognized_text": "[Audio not recognized]",
             "bot_response": failed_text,
             "audio_url": audio_url
             }), 200

    conversation_history = load_user_history(username)

    conversation_history.append({"role": "user", "text": recognized_text})
    logging.info(f"User ({sanitize_username(username)}) speech recognized: {recognized_text}")

    bot_response_text = get_gemini_response(recognized_text)

    conversation_history.append({"role": "bot", "text": bot_response_text})

    save_user_history(username, conversation_history)

    audio_url = text_to_speech(bot_response_text)

    return jsonify({
        "recognized_text": recognized_text,
        "bot_response": bot_response_text,
        "audio_url": audio_url
    })

@app.route('/summarize', methods=['GET'])
def summarize():
    """Summarizes the conversation for a specific user, with length option."""
    username = request.args.get('username')
    summary_length = request.args.get('length', 'short')

    if not sanitize_username(username): return jsonify({"error": "Invalid username"}), 400
    if summary_length not in ['short', 'long']: return jsonify({"error": "Invalid summary length parameter"}), 400

    logging.info(f"Summarize request for '{sanitize_username(username)}', length: {summary_length}")

    conversation_history = load_user_history(username)
    summary_text = get_gemini_summary(conversation_history, length=summary_length)
    audio_url = text_to_speech(summary_text)


    return jsonify({
        "summary": summary_text,
        "audio_url": audio_url
        })


@app.route('/export_chat', methods=['GET'])
def export_chat():
    """Exports the conversation history for a user as a text file."""
    username = request.args.get('username')
    if not sanitize_username(username):
        return jsonify({"error": "Invalid username"}), 400

    logging.info(f"Export chat request for user: {sanitize_username(username)}")
    conversation_history = load_user_history(username)

    if not conversation_history:
        logging.warning(f"No history found to export for user: {sanitize_username(username)}")
        return jsonify({"error": "No history found for this user to export."}), 404

    export_string = f"AccessAlly AI - Chat History\nUser: {sanitize_username(username)}\nExported: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    export_string += "=" * 40 + "\n\n"
    for entry in conversation_history:
        role = entry.get('role', 'Unknown').capitalize()
        text = entry.get('text', '')
        timestamp = entry.get('timestamp', '')
        prefix = f"[{timestamp}] " if timestamp else ""
        export_string += f"{prefix}{role}:\n{text}\n\n"
        export_string += "---\n\n"

    mem_file = io.BytesIO()
    mem_file.write(export_string.encode('utf-8'))
    mem_file.seek(0)

    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"AccessAlly_Chat_{sanitize_username(username)}_{timestamp_str}.txt"

    logging.info(f"Sending history export file: {filename}")
    return send_file(
        mem_file,
        mimetype='text/plain',
        as_attachment=True,
        download_name=filename
    )

@app.route('/clear', methods=['POST'])
def clear_chat():
    """Clears the history (CSV) and notes (TXT) files for a specific user."""
    data = request.get_json()
    username = data.get('username')
    if not sanitize_username(username):
        return jsonify({"error": "Invalid username provided"}), 400

    logging.info(f"Clear request for user: {sanitize_username(username)}")
    history_path = get_user_file_path(HISTORY_DIR, "history", username)
    notes_path = get_user_file_path(NOTES_DIR, "notes", username)

    files_deleted = []
    errors_occurred = False

    try:
        if history_path and os.path.exists(history_path):
            os.remove(history_path)
            files_deleted.append("History")
            logging.info(f"Deleted history file: {history_path}")
        if notes_path and os.path.exists(notes_path):
            os.remove(notes_path)
            files_deleted.append("Notes")
            logging.info(f"Deleted notes file: {notes_path}")

        if not files_deleted:
            message = "No history or notes file found to clear."
        else:
            message = f"{' and '.join(files_deleted)} file(s) cleared successfully."

        return jsonify({"status": "success", "message": message})

    except OSError as e:
        logging.error(f"Error deleting files for user {sanitize_username(username)}: {e}")
        errors_occurred = True
        return jsonify({"error": "Failed to clear user data on server."}), 500

if __name__ == '__main__':
    print("Starting AccessAlly AI server...")
    print("IMPORTANT: SOS feature is SIMULATED and DOES NOT call emergency services.")
    print("Ensure FFmpeg is installed and in PATH for audio processing.")
    print(f"History will be stored in: {os.path.abspath(HISTORY_DIR)}")
    print(f"Notes will be stored in: {os.path.abspath(NOTES_DIR)}")
    app.run(debug=True, host='127.0.0.1', port=5000)