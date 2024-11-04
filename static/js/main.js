const socket = io();
let currentTab = 'voice';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
const MAX_CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const SOCKET_TIMEOUT = 30000; // 30 seconds timeout

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    setConnectionStatus('connected');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    setConnectionStatus('disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    setConnectionStatus('error');
});

socket.on('response', (data) => {
    console.log('Received response from server:', data);
    
    if (data.type === 'therapist_response') {
        addMessage('Casey', data.content);
        setConversationState('paused');
        
        if (currentTab === 'voice') {
            console.log('Playing audio response for voice interaction');
            playAudioResponse(data.content);
        }
    } else {
        console.warn('Unexpected response type:', data.type);
    }
});

socket.on('error', (data) => {
    console.error('Server error:', data.message);
    const errorMessage = data.message || 'An unexpected error occurred. Please try again.';
    addSystemMessage('error', errorMessage);
    setConversationState('error');
});

function setConnectionStatus(status) {
    console.log('Connection status changed:', status);
    const statusMessages = {
        connected: 'Connected to server',
        disconnected: 'Disconnected from server. Trying to reconnect...',
        error: 'Connection error. Please refresh the page.'
    };
    
    if (status !== 'connected') {
        addSystemMessage('status', statusMessages[status]);
    }
}

function handleTabChange(selectedTab) {
    console.log('Switching to tab:', selectedTab);
    currentTab = selectedTab;
    
    // Get all tab contents
    const voiceContent = document.getElementById('voiceTabContent');
    const textContent = document.getElementById('textTabContent');
    
    // Update visibility
    if (voiceContent) voiceContent.style.display = selectedTab === 'voice' ? 'block' : 'none';
    if (textContent) textContent.style.display = selectedTab === 'text' ? 'block' : 'none';
    
    // Update tab buttons if they exist
    const voiceTab = document.getElementById('voiceTab');
    const textTab = document.getElementById('textTab');
    
    if (voiceTab) voiceTab.classList.toggle('active', selectedTab === 'voice');
    if (textTab) textTab.classList.toggle('active', selectedTab === 'text');
}

async function startRecording() {
    try {
        console.log('Starting audio recording');
        setConversationState('user talking');
        isRecording = true;
        audioChunks = [];

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000
            } 
        });

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 32000
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                if (getTotalSize(audioChunks) > MAX_CHUNK_SIZE) {
                    console.log('Chunk size exceeded, sending partial audio');
                    sendAudioChunk();
                }
            }
        };
        
        mediaRecorder.onstop = sendAudioToServer;
        mediaRecorder.start(1000);
        updateTalkButton(true);
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        addSystemMessage('error', 'Unable to access microphone. Please check permissions.');
        stopRecording();
    }
}

function stopRecording() {
    console.log('Stopping recording');
    if (mediaRecorder && isRecording) {
        setConversationState('Casey thinking');
        isRecording = false;
        mediaRecorder.stop();
        updateTalkButton(false);
        
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
}

function updateTalkButton(isRecording) {
    const button = document.getElementById('talkButton');
    if (button) {
        button.textContent = isRecording ? 'Release' : 'Talk';
    }
}

function getTotalSize(chunks) {
    return chunks.reduce((total, chunk) => total + chunk.size, 0);
}

function sendAudioChunk() {
    if (audioChunks.length === 0) return;

    const chunk = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];

    const reader = new FileReader();
    reader.readAsDataURL(chunk);
    reader.onloadend = () => {
        socket.emit('audio', { 
            audio: reader.result,
            modality: 'audio',
            isChunk: true
        });
    };
}

function sendAudioToServer() {
    if (audioChunks.length === 0) {
        console.warn('No audio recorded');
        return;
    }

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
        socket.emit('audio', { 
            audio: reader.result,
            modality: 'audio'
        });
    };
}

function playAudioResponse(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

function handleTextSubmit(event) {
    event.preventDefault();
    const messageInput = document.getElementById('messageInput');
    const userMessage = messageInput.value.trim();
    
    if (userMessage) {
        addMessage('User', userMessage);
        socket.emit('message', {
            message: userMessage,
            modality: 'text'
        });
        messageInput.value = '';
        setConversationState('Casey thinking');
    }
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        const messageElement = document.createElement('div');
        messageElement.className = sender === 'User' ? 'user-message' : 'casey-message';
        messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function addSystemMessage(type, message) {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        const messageElement = document.createElement('div');
        messageElement.className = `alert alert-${type} my-2`;
        messageElement.textContent = message;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function setConversationState(state) {
    const stateElement = document.getElementById('conversationState');
    if (stateElement) {
        const states = {
            'paused': 'alert-info',
            'user talking': 'alert-primary',
            'Casey thinking': 'alert-warning',
            'Casey speaking': 'alert-success',
            'error': 'alert-danger'
        };
        
        stateElement.className = `alert ${states[state] || 'alert-info'}`;
        stateElement.innerText = `Conversation State: ${state}`;
    }
}

// Initialize the default tab
handleTabChange('voice');

// Event Listeners
document.getElementById('talkButton').addEventListener('mousedown', startRecording);
document.getElementById('talkButton').addEventListener('mouseup', stopRecording);
document.getElementById('textForm').addEventListener('submit', handleTextSubmit);
