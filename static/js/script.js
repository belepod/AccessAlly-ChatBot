/**
 * AccessAlly AI - Frontend JavaScript (Final Version)
 * Handles UI, interactions, API calls, accessibility features, notepad, and SOS simulation.
 */
document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const recordButton = document.getElementById('record-button');
    const summarizeShortButton = document.getElementById('summarize-short-button');
    const summarizeLongButton = document.getElementById('summarize-long-button');
    const clearButton = document.getElementById('clear-button');
    const exportButton = document.getElementById('export-button');
    const statusDiv = document.getElementById('status');
    const audioPlayer = document.getElementById('audio-player');
    const usernameInput = document.getElementById('username-input');
    const setUserButton = document.getElementById('set-user-button');
    const currentUserDisplay = document.getElementById('current-user-display');
    const decreaseFontButton = document.getElementById('decrease-font');
    const increaseFontButton = document.getElementById('increase-font');
    const themeSelector = document.getElementById('theme-selector');
    const pauseTTSButton = document.getElementById('pause-tts');
    const resumeTTSButton = document.getElementById('resume-tts');
    const ttsControlsDiv = document.querySelector('.tts-controls');
    const quickPhraseButtons = document.querySelectorAll('.quick-phrase-btn');
    const sosButton = document.getElementById('sos-button');
    const sosOverlay = document.getElementById('sos-overlay');
    const closeSosOverlayButton = document.getElementById('close-sos-overlay');
    const toggleNotepadButton = document.getElementById('toggle-notepad-button');
    const notepadPanel = document.getElementById('notepad-panel');
    const notepadTextarea = document.getElementById('notepad-textarea');
    const copyLastResponseButton = document.getElementById('copy-last-response-button');
    const distressPromptDiv = document.getElementById('distress-prompt');
    const dismissDistressPromptButton = document.getElementById('dismiss-distress-prompt');
    const appWrapper = document.querySelector('.app-wrapper');

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let currentAudioUrl = null;
    let isTTSPaused = false;
    let currentUser = null;
    let isNotepadVisible = false;
    let latestBotResponseText = "";
    let notepadSaveTimeout = null;
    let currentBaseFontSize = 1.0;

    const FONT_SIZE_STEP = 0.1;
    const MIN_FONT_SIZE = 0.7;
    const MAX_FONT_SIZE = 1.5;
    const NOTEPAD_SAVE_DELAY = 1500;
    const DISTRESS_KEYWORDS = [
         "help me", "emergency", "ambulance", "police", "fire", "hurt",
         "injured", "pain", "sick", "not feeling well", "unwell", "faint",
         "dizzy", "trouble breathing", "attack", "suicide", "kill myself",
         "depressed", "hopeless", "can't cope", "scared", "danger"
     ];

    loadPreferences();
    updateButtonStates();
    initializeNotepadState();
    setupEventListeners();
    console.log("AccessAlly AI Frontend Initialized.");
    if (!currentUser) {
        usernameInput.focus();
    }



    /** Loads preferences (user, theme, font size, notepad visibility) from localStorage. */
    function loadPreferences() {
        const savedUsername = localStorage.getItem('accessAllyUser');
        if (savedUsername) {
            usernameInput.value = savedUsername;
            setActiveUser(savedUsername, false);
        }

        const savedTheme = localStorage.getItem('accessAllyTheme') || 'dark';
        themeSelector.value = savedTheme;
        applyTheme(savedTheme);

        const savedFontSize = localStorage.getItem('accessAllyFontSize');
        currentBaseFontSize = savedFontSize ? parseFloat(savedFontSize) : 1.0;
        applyFontSize(currentBaseFontSize);

        isNotepadVisible = localStorage.getItem('accessAllyNotepadVisible') === 'true';
        setNotepadVisibility(isNotepadVisible);
    }

    /** Saves a preference to localStorage with error handling. */
    function savePreference(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error("Failed to save preference to localStorage:", e);
            showStatus("Could not save preferences (localStorage might be full or disabled).");
        }
    }

    /** Basic input sanitizer (more robust needed for production). */
    function sanitizeInput(input) {
         if (typeof input !== 'string') return input;
         return input;
    }

    /**
     * Sets the active user, updates UI, enables controls, and loads history/notes.
     * @param {string} usernameRaw - The raw username input.
     * @param {boolean} [shouldLoadData=true] - Fetch data from server?
     */
    function setActiveUser(usernameRaw, shouldLoadData = true) {
        const username = usernameRaw.trim();
        if (!username) {
            showStatus("Username cannot be empty.");
            return;
        }
        if (username.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
             showStatus("Username: Letters, numbers, _, - allowed (max 50).");
             return;
        }

        if (currentUser !== username) {
            chatBox.innerHTML = '';
            notepadTextarea.value = '';
            latestBotResponseText = "";
            dismissDistress();
        }

        currentUser = username;
        currentUserDisplay.textContent = `User: ${currentUser}`;
        savePreference('accessAllyUser', currentUser);
        updateButtonStates();

        if (shouldLoadData) {
            loadAndDisplayHistory();
            loadAndDisplayNotes();
        } else {
             if (!chatBox.hasChildNodes()) {
                addMessage(`Welcome back, ${currentUser}!`, 'system', false);
            }
        }
        userInput.focus();
    }

    /** Fetches and displays chat history for the current user. */
    async function loadAndDisplayHistory() {
        if (!currentUser) return;
        showStatus(`Loading history for ${currentUser}...`, true);
        chatBox.innerHTML = '';
        latestBotResponseText = "";
        copyLastResponseButton.disabled = true;

        try {
            const response = await fetch(`/load_history?username=${encodeURIComponent(currentUser)}`);
            if (!response.ok) throw new Error(`History Load Error: ${response.statusText} (${response.status})`);
            const data = await response.json();

            if (data.error) throw new Error(`Server Error: ${data.error}`);

            if (data.history && data.history.length > 0) {
                data.history.forEach(msg => {
                    addMessage(msg.text, msg.role || 'unknown', msg.role !== 'system');
                });
                 const lastBotMsgElement = chatBox.querySelector('.message.bot:last-child');
                 if (lastBotMsgElement) {
                    latestBotResponseText = lastBotMsgElement.textContent || "";
                    copyLastResponseButton.disabled = !latestBotResponseText;
                 }
                showStatus(`History loaded.`);
            } else {
                addMessage(`No history found for ${currentUser}.`, 'system', false);
                showStatus('');
            }
            setTimeout(() => { if (statusDiv.textContent === `History loaded.`) showStatus(''); }, 2000);
        } catch (error) {
            console.error("Error loading history:", error);
            showStatus(`Error loading history: ${error.message}`);
            addMessage(`[System: Could not load history - ${error.message}]`, 'system', false);
        }
    }

    /** Fetches and displays notes for the current user. */
    async function loadAndDisplayNotes() {
        if (!currentUser) return;
        try {
            const response = await fetch(`/load_notes?username=${encodeURIComponent(currentUser)}`);
            if (!response.ok) throw new Error(`Notes Load Error: ${response.statusText} (${response.status})`);
            const data = await response.json();
            if (data.error) throw new Error(`Server Error: ${data.error}`);
            notepadTextarea.value = data.notes || "";
        } catch (error) {
            console.error("Error loading notes:", error);
            showStatus(`Error loading notes: ${error.message}`);
            addMessage(`[System: Could not load notes - ${error.message}]`, 'system', false);
        }
    }

    /**
     * Adds a message to the chat interface with accessibility considerations.
     * @param {string} text - The message text.
     * @param {string} sender - 'user', 'bot', or 'system'.
     * @param {boolean} [makeClickable=true] - Make message copyable on click/enter.
     * @returns {HTMLElement} The created message element.
     */
    function addMessage(text, sender, makeClickable = true) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.textContent = text;
        messageDiv.setAttribute('role', 'listitem');

        if (sender === 'bot') {
             latestBotResponseText = text;
             copyLastResponseButton.disabled = !currentUser;
         }

        if (makeClickable && navigator.clipboard && sender !== 'system') {
            messageDiv.setAttribute('tabindex', '0');
            messageDiv.style.cursor = 'pointer';
            messageDiv.setAttribute('aria-label', `Message from ${sender}. ${text}. Press Enter or Click to copy.`);
            messageDiv.addEventListener('click', () => copyToClipboard(text, messageDiv));
            messageDiv.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    copyToClipboard(text, messageDiv);
                }
            });
        } else {
            messageDiv.setAttribute('aria-label', `Message from ${sender}. ${text}.`);
        }

        chatBox.appendChild(messageDiv);
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });

        return messageDiv;
    }

    /** Copies text to clipboard with feedback. */
    async function copyToClipboard(text, element) {
        if (!navigator.clipboard) {
             showStatus('Clipboard access not available or denied.');
             return;
        }
        try {
            await navigator.clipboard.writeText(text);
            const originalBG = element.style.backgroundColor;
            element.style.backgroundColor = 'var(--accent-darker)';
            showStatus('Copied to clipboard!');
            setTimeout(() => {
                element.style.backgroundColor = originalBG;
                if (statusDiv.textContent === 'Copied to clipboard!') { showStatus(''); }
            }, 1500);
        } catch (err) {
            console.error('Failed to copy: ', err);
            showStatus('Failed to copy message.');
            setTimeout(() => { if (statusDiv.textContent === 'Failed to copy message.') { showStatus(''); } }, 2000);
        }
    }

    /** Updates status display and ARIA live region. */
    function showStatus(message, isLoading = false) {
        statusDiv.textContent = message;
        statusDiv.setAttribute('aria-live', isLoading ? 'assertive' : 'polite');
        if (isLoading) { statusDiv.classList.add('loading'); }
        else { statusDiv.classList.remove('loading'); }
    }

    /** Plays audio URL, manages TTS controls. */
    function playAudio(audioUrl) {
        if (!audioUrl) {
            ttsControlsDiv.style.display = 'none';
            return;
        }
        currentAudioUrl = audioUrl;
        audioPlayer.src = audioUrl;
        isTTSPaused = false;
        ttsControlsDiv.style.display = 'flex';
        pauseTTSButton.disabled = false;
        resumeTTSButton.disabled = true;

        audioPlayer.play().catch(e => {
            console.error("Error playing audio:", e);
            showStatus('Error playing audio.');
            addMessage("[System: Audio playback failed.]", 'system', false);
            ttsControlsDiv.style.display = 'none';
        });
    }
    /** Pauses TTS playback. */
    function pauseTTS() {
        if (audioPlayer && !audioPlayer.paused) {
            audioPlayer.pause();
        }
    }
    /** Resumes TTS playback. */
    function resumeTTS() {
        if (audioPlayer && audioPlayer.paused && currentAudioUrl) {
            audioPlayer.play().catch(e => {
                console.error("Error resuming audio:", e);
                showStatus('Error resuming audio.');
                ttsControlsDiv.style.display = 'none';
            });
        }
    }
    /** Handles TTS audio element events */
    function setupAudioPlayerListeners() {
         audioPlayer.onpause = () => {
            if (audioPlayer.duration > 0 && !audioPlayer.ended) {
                 isTTSPaused = true;
                 pauseTTSButton.disabled = true;
                 resumeTTSButton.disabled = false;
                 showStatus('Speech paused.');
             }
        };
        audioPlayer.onplay = () => {
            isTTSPaused = false;
            pauseTTSButton.disabled = false;
            resumeTTSButton.disabled = true;
            showStatus('Speech playing...');
            setTimeout(() => { if (statusDiv.textContent === 'Speech playing...') { showStatus(''); } }, 1500);
        };
        audioPlayer.onended = () => {
            isTTSPaused = false;
            currentAudioUrl = null;
            ttsControlsDiv.style.display = 'none';
            if (statusDiv.textContent === 'Speech playing...') showStatus('');
        };
        audioPlayer.onerror = (e) => {
            console.error("Audio player error:", e);
            showStatus('Audio playback error.');
            addMessage("[System: Error playing audio.]", 'system', false);
            ttsControlsDiv.style.display = 'none';
            currentAudioUrl = null;
        };
    }

    /** Applies the selected color theme. */
    function applyTheme(themeName) {
        document.body.setAttribute('data-theme', themeName);
        savePreference('accessAllyTheme', themeName);
    }

    /** Adjusts the base font size on the body. */
    function applyFontSize(newSizeRem) {
        currentBaseFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newSizeRem));
        document.body.style.fontSize = `${currentBaseFontSize}rem`;
        savePreference('accessAllyFontSize', currentBaseFontSize.toString());
        decreaseFontButton.disabled = currentBaseFontSize <= MIN_FONT_SIZE;
        increaseFontButton.disabled = currentBaseFontSize >= MAX_FONT_SIZE;
    }

    /** Updates the enabled/disabled state of main action buttons based on user login. */
    function updateButtonStates() {
        const isUserSet = !!currentUser;
        userInput.disabled = !isUserSet;
        sendButton.disabled = !isUserSet;
        recordButton.disabled = !isUserSet;
        summarizeShortButton.disabled = !isUserSet;
        summarizeLongButton.disabled = !isUserSet;
        clearButton.disabled = !isUserSet;
        exportButton.disabled = !isUserSet;
        copyLastResponseButton.disabled = !isUserSet || !latestBotResponseText;
        userInput.placeholder = isUserSet ? "Type message or use microphone..." : "Please set username...";
         quickPhraseButtons.forEach(btn => btn.disabled = !isUserSet);
    }

    /** Shows/Hides the notepad panel and saves state. */
    function setNotepadVisibility(show) {
        isNotepadVisible = show;
        notepadPanel.style.display = isNotepadVisible ? 'flex' : 'none';
        toggleNotepadButton.setAttribute('aria-pressed', isNotepadVisible);
        savePreference('accessAllyNotepadVisible', isNotepadVisible);
    }

    /** Sets the initial visibility state on load. */
    function initializeNotepadState() {
        setNotepadVisibility(localStorage.getItem('accessAllyNotepadVisible') === 'true');
    }

    /** Debounced function to save notepad content. */
    function triggerSaveNotepad() {
        if (!currentUser) return;
        if (notepadSaveTimeout) clearTimeout(notepadSaveTimeout);

        notepadSaveTimeout = setTimeout(async () => {
            const notesContent = notepadTextarea.value;
            try {
                const response = await fetch('/save_notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser, notes_content: notesContent })
                });
                if (!response.ok) throw new Error(`Save notes error ${response.status}`);
                 const saveInfo = notepadPanel.querySelector('.note-save-info');
                 if(saveInfo) {
                    saveInfo.textContent = 'Notes saved!';
                    setTimeout(() => { saveInfo.textContent = 'Notes saved automatically.'; }, 2000);
                 }
            } catch (error) {
                console.error("Error auto-saving notes:", error);
                showStatus(`Failed to save notes: ${error.message}`);
            }
        }, NOTEPAD_SAVE_DELAY);
    }

    /** Copies the latest recorded bot response to the notepad. */
    function copyLastBotResponseToNotepad() {
        if (!currentUser) { showStatus("Please set user first."); return; }
        if (latestBotResponseText) {
            const currentNotes = notepadTextarea.value;
            const separator = currentNotes.trim().length > 0 ? "\n\n---\n\n" : "";
            notepadTextarea.value += separator + "Bot Response:\n" + latestBotResponseText;
            notepadTextarea.scrollTop = notepadTextarea.scrollHeight;
            notepadTextarea.focus();
            triggerSaveNotepad();
            showStatus('Bot response copied to notes.');
             setTimeout(() => { if (statusDiv.textContent === 'Bot response copied to notes.') showStatus(''); }, 2000);
        } else {
            showStatus("No recent bot response to copy.");
            setTimeout(() => { if (statusDiv.textContent === "No recent bot response to copy.") showStatus(''); }, 2000);
        }
    }

    /** Shows the simulated SOS overlay. */
    function showSOSOverlay() {
        if (audioPlayer && !audioPlayer.paused) {
             audioPlayer.pause();
             ttsControlsDiv.style.display = 'none';
        }
        sosOverlay.style.display = 'flex';
        closeSosOverlayButton.focus();
    }
    /** Hides the simulated SOS overlay. */
    function hideSOSOverlay() {
        sosOverlay.style.display = 'none';
    }

    /** Client-side check for distress keywords in user message. */
    function checkForDistress(message) {
         if (!message) return;
        const lowerCaseMessage = message.toLowerCase();
        const foundKeyword = DISTRESS_KEYWORDS.some(keyword => lowerCaseMessage.includes(keyword));

        if (foundKeyword) {
            console.warn("Distress keyword detected (client-side):", message);
            distressPromptDiv.style.display = 'flex';
             distressPromptDiv.setAttribute('aria-hidden', 'false');
             sosButton.style.animation = 'pulse 1.5s infinite';
        }
    }

    /** Dismisses the distress prompt and stops SOS button animation. */
    function dismissDistress() {
        distressPromptDiv.style.display = 'none';
        distressPromptDiv.setAttribute('aria-hidden', 'true');
        sosButton.style.animation = 'none';
    }



    /** Sends text message to backend. */
    async function sendTextMessage(messageText = null) {
        if (!currentUser) { showStatus("Please set a username first."); return; }
        const message = sanitizeInput(messageText !== null ? messageText : userInput.value.trim());
        if (!message) return;

        checkForDistress(message);

        addMessage(message, 'user');
        if (messageText === null) userInput.value = '';
        userInput.focus();
        showStatus('Sending...', true);
        sendButton.disabled = true;
        recordButton.disabled = true;

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, username: currentUser }),
            });
            if (!response.ok) throw new Error(`Server Error: ${response.statusText} (${response.status})`);
            const data = await response.json();
            if (data.error) throw new Error(`Application Error: ${data.error}`);

            showStatus('');
            addMessage(data.bot_response, 'bot');
            playAudio(data.audio_url);
        } catch (error) {
            console.error('Error sending message:', error);
            showStatus(`Error: ${error.message}`);
            addMessage(`[System: Message failed - ${error.message}]`, 'system', false);
        } finally {
             sendButton.disabled = !currentUser;
             recordButton.disabled = !currentUser;
        }
    }

    /** Handles audio recording start/stop. */
    async function toggleRecording() {
        if (!currentUser) { showStatus("Please set username first."); return; }

        if (isRecording) {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                try {
                    mediaRecorder.stop();
                     showStatus('Stopping recording...');
                 } catch (e) {
                     console.error("Error stopping recorder:", e);
                     resetRecordingUI();
                 }
            } else {
                resetRecordingUI();
            }
        } else {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showStatus('Microphone access not supported by browser.');
                addMessage('[System: Browser does not support microphone.]', 'system', false);
                recordButton.disabled = true; return;
            }
            try {
                showStatus('Requesting microphone access...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                showStatus('Microphone accessed...');

                 const options = { mimeType: '' };
                 const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
                 for (const type of preferredTypes) {
                     if (MediaRecorder.isTypeSupported(type)) { options.mimeType = type; break; }
                 }
                 console.log("Using MediaRecorder mimeType:", options.mimeType || "browser default");

                mediaRecorder = new MediaRecorder(stream, options);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunks.push(event.data); };
                mediaRecorder.onerror = (event) => {
                    console.error("MediaRecorder error:", event.error);
                    showStatus(`Recording Error: ${event.error.name}`);
                    addMessage(`[System: Recording error - ${event.error.name}]`, 'system', false);
                    resetRecordingUI();
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorder.onstop = async () => {
                     showStatus('Processing audio...', true);
                     const mimeType = mediaRecorder.mimeType || 'audio/webm';
                     const audioBlob = new Blob(audioChunks, { type: mimeType });
                     resetRecordingUI();

                    try {
                        if (audioBlob.size === 0) { throw new Error("Recorded audio is empty."); }

                        const formData = new FormData();
                        const fileExtension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
                        formData.append('audio_data', audioBlob, `recording.${fileExtension}`);
                        formData.append('username', currentUser);

                        const response = await fetch('/recognize', { method: 'POST', body: formData });
                        if (!response.ok) throw new Error(`Server Error: ${response.statusText} (${response.status})`);
                        const data = await response.json();
                        if (data.error && data.recognized_text !== "[Audio not recognized]") {
                             throw new Error(`Application Error: ${data.error}`);
                        }

                        showStatus('');
                        let recognizedText = "";
                        if (data.recognized_text) {
                            const isUnrecognized = data.recognized_text === "[Audio not recognized]";
                            recognizedText = isUnrecognized ? "" : data.recognized_text;
                            const msg = isUnrecognized ? "[Audio not recognized by system]" : `You (voice): ${data.recognized_text}`;
                            addMessage(msg, isUnrecognized ? 'system' : 'user');
                        }

                        if (recognizedText) checkForDistress(recognizedText);

                        addMessage(data.bot_response, 'bot');
                        playAudio(data.audio_url);

                    } catch (error) {
                        console.error('Error processing/sending audio:', error);
                        showStatus(`Processing Error: ${error.message}`);
                        addMessage(`[System: Failed to process audio - ${error.message}]`, 'system', false);
                    } finally {
                         stream.getTracks().forEach(track => track.stop());
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                updateRecordingUI(true);
                showStatus('Recording... Speak now.');

            } catch (error) {
                console.error('Error accessing microphone:', error);
                 let errorMsg = `Mic Access Error: ${error.name || error.message}`;
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    errorMsg = 'Microphone permission denied. Please grant permission in browser settings.';
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                     errorMsg = 'No microphone detected. Please ensure one is connected and enabled.';
                }
                showStatus(errorMsg);
                addMessage(`[System: ${errorMsg}]`, 'system', false);
                resetRecordingUI();
            }
        }
    }
     /** Helper to update recording button UI */
     function updateRecordingUI(isRec) {
         recordButton.classList.toggle('recording', isRec);
         if (isRec) {
             recordButton.innerHTML = '<i class="fas fa-stop" aria-hidden="true"></i> Stop';
             recordButton.setAttribute('aria-label', 'Stop recording');
         } else {
             recordButton.innerHTML = '<i class="fas fa-microphone" aria-hidden="true"></i> Record';
             recordButton.setAttribute('aria-label', 'Record audio message');
         }
         isRecording = isRec;
         recordButton.disabled = !currentUser;
     }
     /** Helper to reset recording button UI consistently */
     function resetRecordingUI() {
         updateRecordingUI(false);
         audioChunks = [];
     }


    /** Requests summary from backend. */
    async function getSummary(length = 'short') {
        if (!currentUser) { showStatus("Please set username first."); return; }
        showStatus(`Generating ${length} summary...`, true);
        summarizeShortButton.disabled = true;
        summarizeLongButton.disabled = true;

        try {
            const response = await fetch(`/summarize?username=${encodeURIComponent(currentUser)}&length=${length}`);
            if (!response.ok) throw new Error(`Summary Error: ${response.statusText} (${response.status})`);
            const data = await response.json();
            if (data.error) throw new Error(`Application Error: ${data.error}`);

            showStatus('');
            const title = length === 'long' ? 'Detailed Summary:' : 'Brief Summary:';
            addMessage(`${title}\n${data.summary}`, 'system');
            if (data.audio_url) playAudio(data.audio_url);

        } catch (error) {
            console.error('Error fetching summary:', error);
            showStatus(`Summary Failed: ${error.message}`);
            addMessage(`[System: Failed to get summary - ${error.message}]`, 'system', false);
        } finally {
            summarizeShortButton.disabled = !currentUser;
            summarizeLongButton.disabled = !currentUser;
        }
    }

    /** Clears chat history and notes via backend. */
    async function clearChatHistory() {
        if (!currentUser) { showStatus("Please set username first."); return; }
        if (!confirm(`Are you sure you want to permanently delete chat history AND notes for user "${currentUser}"? This cannot be undone.`)) {
            return;
        }
        showStatus('Clearing history and notes...', true);
        clearButton.disabled = true;

        try {
            const response = await fetch('/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser }),
            });
            if (!response.ok) throw new Error(`Clear Error: ${response.statusText} (${response.status})`);
            const data = await response.json();
            if (data.error) throw new Error(`Application Error: ${data.error}`);

            chatBox.innerHTML = '';
            notepadTextarea.value = '';
            latestBotResponseText = '';
            dismissDistress();
            addMessage(`Chat history and notes cleared for ${currentUser}.`, 'system', false);
            showStatus(data.message || 'Data cleared.');
            setTimeout(() => { if (statusDiv.textContent === (data.message || 'Data cleared.')) showStatus(''); }, 2000);
            userInput.focus();
        } catch (error) {
            console.error('Error clearing data:', error);
            showStatus(`Clear Failed: ${error.message}`);
            addMessage(`[System: Failed to clear data - ${error.message}]`, 'system', false);
        } finally {
             clearButton.disabled = !currentUser;
        }
    }

    /** Exports chat history as a text file using backend endpoint. */
    async function exportChat() {
        if (!currentUser) { showStatus("Please set username first."); return; }
        showStatus('Preparing export...', true);
        exportButton.disabled = true;

        try {
            const response = await fetch(`/export_chat?username=${encodeURIComponent(currentUser)}`);
            if (!response.ok) {
                 if (response.status === 404) throw new Error("No history found to export.");
                 else throw new Error(`Export Error: ${response.statusText} (${response.status})`);
             }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            const disposition = response.headers.get('content-disposition');
            let filename = `AccessAlly_Chat_${currentUser}.txt`;
            if (disposition?.includes('filename=')) {
                 const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                 if (filenameMatch && filenameMatch[1]) filename = filenameMatch[1].replace(/['"]/g, '');
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
            showStatus('Chat history exported.');
            setTimeout(() => showStatus(''), 2000);
        } catch (error) {
            console.error('Error exporting chat:', error);
            showStatus(`Export Failed: ${error.message}`);
            addMessage(`[System: Failed to export chat - ${error.message}]`, 'system', false);
        } finally {
             exportButton.disabled = !currentUser; // Re-enable if user is set
        }
    }


    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // User Setting
        setUserButton.addEventListener('click', () => setActiveUser(usernameInput.value, true));
        usernameInput.addEventListener('keypress', (e) => {
             if (e.key === 'Enter') { e.preventDefault(); setActiveUser(usernameInput.value, true); }
        });

        // SOS Button & Overlay
        sosButton.addEventListener('click', showSOSOverlay);
        closeSosOverlayButton.addEventListener('click', hideSOSOverlay);
        sosOverlay.addEventListener('click', (e) => { // Close if clicking outside content
            if (e.target === sosOverlay) hideSOSOverlay();
        });
        sosOverlay.addEventListener('keydown', (e) => { // Close with Escape key
             if (e.key === 'Escape') hideSOSOverlay();
        });


        // Notepad
        toggleNotepadButton.addEventListener('click', () => setNotepadVisibility(!isNotepadVisible));
        copyLastResponseButton.addEventListener('click', copyLastBotResponseToNotepad);
        notepadTextarea.addEventListener('input', triggerSaveNotepad); // Auto-save on input

        // Distress Prompt Dismiss
        dismissDistressPromptButton.addEventListener('click', dismissDistress);

        // Chat Input & Actions
        sendButton.addEventListener('click', () => sendTextMessage());
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
        });
        recordButton.addEventListener('click', toggleRecording);

        // Accessibility Controls
        decreaseFontButton.addEventListener('click', () => applyFontSize(currentBaseFontSize - FONT_SIZE_STEP));
        increaseFontButton.addEventListener('click', () => applyFontSize(currentBaseFontSize + FONT_SIZE_STEP));
        themeSelector.addEventListener('change', (e) => applyTheme(e.target.value));

        // TTS Controls
        pauseTTSButton.addEventListener('click', pauseTTS);
        resumeTTSButton.addEventListener('click', resumeTTS);
        setupAudioPlayerListeners(); // Add listeners for audio state changes

        // Quick Phrase Buttons
        quickPhraseButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!button.disabled) sendTextMessage(button.dataset.phrase);
            });
        });

        // Footer Action Buttons
        summarizeShortButton.addEventListener('click', () => getSummary('short'));
        summarizeLongButton.addEventListener('click', () => getSummary('long'));
        clearButton.addEventListener('click', clearChatHistory);
        exportButton.addEventListener('click', exportChat);
    }

}); // End DOMContentLoaded