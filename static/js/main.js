const socket = io();
let currentTab = 'voice';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

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
    if (data.type === 'therapist_response') {
        addMessage('Casey', data.content);
        setConversationState('paused');
        if (currentTab === 'voice') {
            playAudioResponse(data.content);
        }
    }
});

socket.on('error', (data) => {
    console.error('Error:', data.message);
    const errorMessage = data.message || 'An unexpected error occurred. Please try again.';
    addSystemMessage('error', errorMessage);
    setConversationState('error');
});

function setConnectionStatus(status) {
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
    currentTab = selectedTab;
    document.getElementById('voiceTabContent').style.display = selectedTab === 'voice' ? 'block' : 'none';
    document.getElementById('textTabContent').style.display = selectedTab === 'text' ? 'block' : 'none';
    
    // Update active state of tab buttons
    document.querySelectorAll('.btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${selectedTab}Tab`).classList.add('active');
}

async function handlePressToTalk() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    try {
        setConversationState('user talking');
        isRecording = true;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = sendAudioToServer;
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            addSystemMessage('error', 'Error recording audio. Please try again.');
            stopRecording();
        };

        mediaRecorder.start();
        updateTalkButton(true);
    } catch (err) {
        console.error('Error accessing microphone:', err);
        addSystemMessage('error', 'Unable to access microphone. Please check permissions.');
        stopRecording();
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        setConversationState('Casey thinking');
        isRecording = false;
        mediaRecorder.stop();
        updateTalkButton(false);
        
        // Clean up media stream
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
}

function updateTalkButton(isRecording) {
    const button = document.getElementById('talkButton');
    if (isRecording) {
        button.classList.add('btn-warning');
        button.classList.remove('btn-danger');
        button.innerText = 'Release to Stop';
    } else {
        button.classList.add('btn-danger');
        button.classList.remove('btn-warning');
        button.innerText = 'Press to Talk';
    }
}

function sendAudioToServer() {
    if (audioChunks.length === 0) {
        addSystemMessage('error', 'No audio recorded. Please try again.');
        return;
    }

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];
    
    // Convert blob to base64 and send to server
    const reader = new FileReader();
    reader.onloadend = () => {
        socket.emit('audio', { 
            audio: reader.result,
            modality: 'audio'
        });
    };
    reader.onerror = () => {
        addSystemMessage('error', 'Error processing audio. Please try again.');
    };
    reader.readAsDataURL(audioBlob);
}

function playAudioResponse(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            addSystemMessage('error', 'Error playing audio response. Please read the text instead.');
        };

        window.speechSynthesis.speak(utterance);
    } else {
        addSystemMessage('warning', 'Text-to-speech is not supported in your browser.');
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
    const messageElement = document.createElement('div');
    messageElement.className = sender === 'User' ? 'user-message' : 'casey-message';
    messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(type, message) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `alert alert-${type} my-2`;
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function setConversationState(state) {
    const stateElement = document.getElementById('conversationState');
    const states = {
        'paused': 'alert-info',
        'user talking': 'alert-primary',
        'Casey thinking': 'alert-warning',
        'error': 'alert-danger'
    };
    
    stateElement.className = `alert ${states[state] || 'alert-info'}`;
    stateElement.innerText = `Conversation State: ${state}`;
}

// Event Listeners
document.getElementById('talkButton').addEventListener('mousedown', handlePressToTalk);
document.getElementById('talkButton').addEventListener('mouseup', handlePressToTalk);
document.getElementById('textForm').addEventListener('submit', handleTextSubmit);

// Initialize the default tab
handleTabChange('voice');
