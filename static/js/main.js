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

// Rest of the JavaScript code remains the same...
[Previous JavaScript code for audio handling and other functionality]
