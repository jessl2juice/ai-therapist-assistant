// Initialize socket connection
const socket = io();

// Global variables
let currentTab = 'voice';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
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
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            
            reader.onload = () => {
                const base64Audio = reader.result.split(',')[1];
                socket.emit('audio', { audio: base64Audio });
            };
            
            reader.readAsDataURL(audioBlob);
            audioChunks = [];
            setConversationState('Casey thinking');
        };
        
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
    const stopButton = document.getElementById('stopButton');
    
    if (isRecording) {
        button.classList.add('recording');
        button.querySelector('i').classList.remove('fa-microphone');
        button.querySelector('i').classList.add('fa-microphone-slash');
        stopButton.classList.remove('d-none');
    } else {
        button.classList.remove('recording');
        button.querySelector('i').classList.remove('fa-microphone-slash');
        button.querySelector('i').classList.add('fa-microphone');
        stopButton.classList.add('d-none');
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
        'alert-info'
    );
}

function playAudioResponse(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setConversationState('Casey speaking');
    utterance.onend = () => setConversationState('paused');
    window.speechSynthesis.speak(utterance);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Talk button events
    const talkButton = document.getElementById('talkButton');
    talkButton.addEventListener('mousedown', () => {
        if (!isRecording) {
            startRecording();
        }
    });
    
    const stopButton = document.getElementById('stopButton');
    stopButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRecording) {
            stopRecording();
        }
    });
    
    // Text form submission
    document.getElementById('textForm').addEventListener('submit', handleTextSubmit);
    
    // Initialize with voice tab
    handleTabChange('voice');
});
