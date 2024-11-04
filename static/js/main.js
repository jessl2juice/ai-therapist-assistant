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
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

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
    reconnectAttempts = 0;
    setConversationState('paused');  // Reset state on reconnect
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (isRecording) {
        stopRecording();
    }
    setConversationState('error: Connection lost. Trying to reconnect...');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    setConversationState('error: Please refresh the page to reconnect');
    updateTalkButton(false);
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    setConversationState('error: Connection error. Please try again');
    updateTalkButton(false);
});

// Add error handler for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    if (isRecording) {
        stopRecording();
    }
    setConversationState('error: Something went wrong. Please try again.');
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

// Tab handling
function handleTabChange(selectedTab) {
    currentTab = selectedTab;
    
    document.getElementById('voiceTabContent').style.display = selectedTab === 'voice' ? 'block' : 'none';
    document.getElementById('textTabContent').style.display = selectedTab === 'text' ? 'block' : 'none';
    
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(selectedTab + 'Tab').classList.add('active');
    
    if (isRecording) {
        stopRecording();
    }
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    setConversationState('paused');
}

// Voice handling
function startRecording() {
    if (isRecording) {
        stopRecording();
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            mediaRecorder.onstop = () => {
                sendAudioToAPI()
                    .catch(error => {
                        console.error('Error in sendAudioToAPI:', error);
                        setConversationState('error: Failed to process audio. Please try again.');
                    });
            };
            mediaRecorder.start();
            isRecording = true;
            setConversationState('user talking');
            updateTalkButton(true);
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            setConversationState('error: ' + error.message);
            updateTalkButton(false);
            isRecording = false;
        });
}

async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
            await new Promise(resolve => mediaRecorder.onstop = resolve);
            await sendAudioToAPI();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            updateTalkButton(false);
        } catch (error) {
            console.error('Error in stopRecording:', error);
            isRecording = false;
            updateTalkButton(false);
            setConversationState('error: Recording failed. Please try again.');
        }
    }
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
}

function sendAudioToAPI() {
    return new Promise((resolve, reject) => {
        try {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            
            const reader = new FileReader();
            reader.onload = () => {
                const base64Audio = reader.result.split(',')[1];
                socket.emit('audio', { audio: base64Audio });
                setConversationState('Casey thinking');
                resolve();
            };
            
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                setConversationState('error: Failed to process audio. Please try again.');
                updateTalkButton(false);
                reject(error);
            };
            
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error('Error sending audio:', error);
            setConversationState('error: Failed to send audio. Please try again.');
            updateTalkButton(false);
            reject(error);
        }
    });
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
    
    if (window.stateTimeout) {
        clearTimeout(window.stateTimeout);
    }
    
    if (state === 'user talking' || state === 'Casey thinking') {
        window.stateTimeout = setTimeout(() => {
            if (stateElement.textContent === `Conversation State: ${state}`) {
                if (isRecording) {
                    stopRecording();
                }
                isRecording = false;
                updateTalkButton(false);
                setConversationState('error: Operation timed out. Click to try again');
            }
        }, 15000); // Increased timeout to 15 seconds
    }
    
    stateElement.className = 'alert ' + (
        state.includes('error') ? 'alert-danger' :
        state === 'Casey thinking' ? 'alert-warning' :
        state === 'user talking' ? 'alert-primary' :
        state === 'Casey speaking' ? 'alert-info' :
        'alert-info'
    );
}

function playAudioResponse(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (voiceSettings.voice) {
            utterance.voice = voiceSettings.voice;
        }
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;
        utterance.volume = voiceSettings.volume;
        
        utterance.onstart = () => {
            setConversationState('Casey speaking');
        };
        
        utterance.onend = () => {
            setConversationState('paused');
        };
        
        window.speechSynthesis.speak(utterance);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const talkButton = document.getElementById('talkButton');
    
    talkButton.addEventListener('mousedown', () => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            setConversationState('paused');
            return;
        }
        
        if (!isRecording) {
            startRecording();
        }
    });
    
    talkButton.addEventListener('mouseup', () => {
        if (isRecording) {
            stopRecording();
            setConversationState('Casey thinking');
        }
    });
    
    talkButton.addEventListener('mouseleave', () => {
        if (isRecording) {
            stopRecording();
            setConversationState('Casey thinking');
        }
    });
    
    talkButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!window.speechSynthesis.speaking && !isRecording) {
            startRecording();
        }
    });
    
    talkButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (isRecording) {
            stopRecording();
            setConversationState('Casey thinking');
        }
    });
    
    document.getElementById('textForm').addEventListener('submit', handleTextSubmit);
    
    initVoiceSettings();
    handleTabChange('voice');
});
