const socket = io();
let currentTab = 'voice';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('response', (data) => {
    if (data.type === 'therapist_response') {
        addMessage('Casey', data.content);
        setConversationState('paused');
        playAudioResponse(data.content);
    }
});

socket.on('error', (data) => {
    console.error('Error:', data.message);
    alert('An error occurred: ' + data.message);
});

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
        mediaRecorder.start();
        document.getElementById('talkButton').classList.add('btn-warning');
        document.getElementById('talkButton').innerText = 'Release to Stop';
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Unable to access microphone. Please check permissions.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        setConversationState('Casey thinking');
        isRecording = false;
        mediaRecorder.stop();
        document.getElementById('talkButton').classList.remove('btn-warning');
        document.getElementById('talkButton').innerText = 'Press to Talk';
    }
}

function sendAudioToServer() {
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
    reader.readAsDataURL(audioBlob);
}

function playAudioResponse(text) {
    if ('speechSynthesis' in window) {
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

function setConversationState(state) {
    document.getElementById('conversationState').innerText = `Conversation State: ${state}`;
}

// Event Listeners
document.getElementById('talkButton').addEventListener('mousedown', handlePressToTalk);
document.getElementById('talkButton').addEventListener('mouseup', handlePressToTalk);
document.getElementById('textForm').addEventListener('submit', handleTextSubmit);

// Initialize the default tab
handleTabChange('voice');
