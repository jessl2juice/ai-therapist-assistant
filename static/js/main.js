// Initialize socket connection
const socket = io();

// Global variables
let currentTab = 'voice';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let voiceSettings = {
    voice: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
};

// Load saved voice settings
function loadVoiceSettings() {
    const savedSettings = localStorage.getItem('voiceSettings');
    if (savedSettings) {
        voiceSettings = JSON.parse(savedSettings);
    }
}

// Save voice settings
function saveVoiceSettings() {
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
}

// Initialize voice settings
function initVoiceSettings() {
    loadVoiceSettings();
    
    // Initialize voice selection
    window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        const voiceSelect = document.getElementById('voiceSelect');
        voiceSelect.innerHTML = '';
        
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} - ${voice.lang}`;
            if (voiceSettings.voice && voice.name === voiceSettings.voice.name) {
                option.selected = true;
            }
            voiceSelect.appendChild(option);
        });
    };

    // Set initial values for range inputs
    document.getElementById('rateRange').value = voiceSettings.rate;
    document.getElementById('rateValue').textContent = voiceSettings.rate;
    document.getElementById('pitchRange').value = voiceSettings.pitch;
    document.getElementById('pitchValue').textContent = voiceSettings.pitch;
    document.getElementById('volumeRange').value = voiceSettings.volume;
    document.getElementById('volumeValue').textContent = voiceSettings.volume;

    // Voice selection change handler
    document.getElementById('voiceSelect').addEventListener('change', (e) => {
        const voices = window.speechSynthesis.getVoices();
        voiceSettings.voice = voices[e.target.value];
        saveVoiceSettings();
    });

    // Range input handlers
    document.getElementById('rateRange').addEventListener('input', (e) => {
        voiceSettings.rate = parseFloat(e.target.value);
        document.getElementById('rateValue').textContent = voiceSettings.rate;
        saveVoiceSettings();
    });

    document.getElementById('pitchRange').addEventListener('input', (e) => {
        voiceSettings.pitch = parseFloat(e.target.value);
        document.getElementById('pitchValue').textContent = voiceSettings.pitch;
        saveVoiceSettings();
    });

    document.getElementById('volumeRange').addEventListener('input', (e) => {
        voiceSettings.volume = parseFloat(e.target.value);
        document.getElementById('volumeValue').textContent = voiceSettings.volume;
        saveVoiceSettings();
    });

    // Test voice button handler
    document.getElementById('testVoice').addEventListener('click', () => {
        const testText = "Hello, I'm Casey, your AI therapist assistant.";
        playAudioResponse(testText);
    });
}

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (document.getElementById('conversationState').textContent === 'Conversation State: Casey thinking') {
        setConversationState('error: Connection lost. Please try again.');
        updateTalkButton(false);
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    if (document.getElementById('conversationState').textContent === 'Conversation State: Casey thinking') {
        setConversationState('error: Connection error. Please try again.');
        updateTalkButton(false);
    }
});

socket.on('response', (data) => {
    if (data.content) {
        addMessage('Casey', data.content);
        if (currentTab === 'voice') {
            playAudioResponse(data.content);
        }
    }
    setConversationState('paused');
});

socket.on('error', (data) => {
    console.error('Server error:', data.message);
    setConversationState('error: ' + data.message);
});

// Tab handling
function handleTabChange(selectedTab) {
    currentTab = selectedTab;
    
    // Update UI elements
    document.getElementById('voiceTabContent').style.display = selectedTab === 'voice' ? 'block' : 'none';
    document.getElementById('textTabContent').style.display = selectedTab === 'text' ? 'block' : 'none';
    
    // Update button states
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(selectedTab + 'Tab').classList.add('active');
    
    // Reset states
    if (isRecording) {
        stopRecording();
    }
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    setConversationState('paused');
}

// Voice handling
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setConversationState('user talking');
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = sendAudioToAPI;
        
        mediaRecorder.start();
        isRecording = true;
        updateTalkButton(true);
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        setConversationState('error: ' + error.message);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    isRecording = false;
    updateTalkButton(false);
}

function updateTalkButton(isRecording) {
    const button = document.getElementById('talkButton');
    const buttonLabel = document.querySelector('.talk-label');
    
    if (isRecording) {
        button.classList.add('recording');
        button.classList.remove('btn-primary');
        button.classList.add('btn-danger');
        buttonLabel.textContent = 'Recording...';
    } else {
        button.classList.remove('recording');
        button.classList.remove('btn-danger');
        button.classList.add('btn-primary');
        buttonLabel.textContent = 'Press to Talk';
    }
    
    button.querySelector('i').className = 'fas fa-microphone';
}

function sendAudioToAPI() {
    try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64Audio = reader.result.split(',')[1];
            socket.emit('audio', { audio: base64Audio });
        };
        
        reader.onerror = () => {
            setConversationState('error: Failed to process audio. Please try again.');
            updateTalkButton(false);
        };
        
        reader.readAsDataURL(audioBlob);
    } catch (error) {
        console.error('Error sending audio:', error);
        setConversationState('error: Failed to send audio. Please try again.');
        updateTalkButton(false);
    }
}

// Text handling
function handleTextSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message) {
        addMessage('User', message);
        socket.emit('message', {
            message: message,
            modality: 'text'
        });
        input.value = '';
        setConversationState('Casey thinking');
    }
}

// UI updates
function addMessage(sender, text) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = sender === 'User' ? 'user-message' : 'casey-message';
    messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function setConversationState(state) {
    const stateElement = document.getElementById('conversationState');
    stateElement.textContent = `Conversation State: ${state}`;
    stateElement.className = 'alert ' + (
        state.includes('error') ? 'alert-danger' :
        state === 'Casey thinking' ? 'alert-warning' :
        state === 'user talking' ? 'alert-primary' :
        state === 'Casey speaking' ? 'alert-info' :
        'alert-info'
    );
    
    // Add timeout for thinking state
    if (state === 'Casey thinking') {
        setTimeout(() => {
            if (document.getElementById('conversationState').textContent === 'Conversation State: Casey thinking') {
                setConversationState('error: Response timeout. Please try again.');
                updateTalkButton(false);
            }
        }, 10000); // 10 second timeout
    }
}

function playAudioResponse(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply voice settings
        if (voiceSettings.voice) {
            utterance.voice = voiceSettings.voice;
        }
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;
        utterance.volume = voiceSettings.volume;
        
        utterance.onstart = () => {
            setConversationState('Casey speaking');
            updateTalkButtonForSpeech(true);
        };
        
        utterance.onend = () => {
            setConversationState('paused');
            updateTalkButtonForSpeech(false);
        };
        
        window.speechSynthesis.speak(utterance);
    }
}

function updateTalkButtonForSpeech(isSpeaking) {
    const talkButton = document.getElementById('talkButton');
    const buttonLabel = document.querySelector('.talk-label');
    const stopButton = document.getElementById('stopButton');
    
    if (isSpeaking) {
        talkButton.classList.remove('btn-primary');
        talkButton.classList.add('btn-info');
        buttonLabel.textContent = 'Casey Speaking';
        stopButton.classList.remove('d-none');
    } else {
        talkButton.classList.remove('btn-info');
        talkButton.classList.add('btn-primary');
        buttonLabel.textContent = 'Press to Talk';
        stopButton.classList.add('d-none');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const talkButton = document.getElementById('talkButton');
    
    talkButton.addEventListener('mousedown', () => {
        if (!window.speechSynthesis.speaking && !isRecording) {
            startRecording();
        }
    });
    
    talkButton.addEventListener('mouseup', () => {
        if (isRecording) {
            stopRecording();
        }
    });
    
    // Also handle mouseleave to prevent stuck states
    talkButton.addEventListener('mouseleave', () => {
        if (isRecording) {
            stopRecording();
        }
    });
    
    const stopButton = document.getElementById('stopButton');
    stopButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
    });
    
    document.getElementById('textForm').addEventListener('submit', handleTextSubmit);
    
    // Initialize voice settings
    initVoiceSettings();
    
    // Initialize default tab
    handleTabChange('voice');
});
