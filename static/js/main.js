const socket = io();
let currentTab = 'voice';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
const MAX_CHUNK_SIZE = 1024 * 1024;
const SOCKET_TIMEOUT = 30000;

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
    document.getElementById('voiceTabContent').style.display = selectedTab === 'voice' ? 'block' : 'none';
    document.getElementById('textTabContent').style.display = selectedTab === 'text' ? 'block' : 'none';
    
    document.querySelectorAll('.btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${selectedTab}Tab`).classList.add('active');
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
                console.log('Received audio chunk:', event.data.size, 'bytes');
                audioChunks.push(event.data);
                if (getTotalSize(audioChunks) > MAX_CHUNK_SIZE) {
                    console.log('Chunk size exceeded, sending partial audio');
                    sendAudioChunk();
                }
            }
        };
        
        mediaRecorder.onstop = sendAudioToServer;
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            addSystemMessage('error', 'Error recording audio. Please try again.');
            stopRecording();
        };

        mediaRecorder.start(1000);
        updateTalkButton(true);
        console.log('Recording started successfully');
    } catch (err) {
        console.error('Error accessing microphone:', err);
        addSystemMessage('error', 'Unable to access microphone. Please check permissions.');
        stopRecording();
    }
}

function getTotalSize(chunks) {
    return chunks.reduce((total, chunk) => total + chunk.size, 0);
}

async function sendAudioChunk() {
    if (audioChunks.length === 0) return;

    try {
        const chunk = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('Sending audio chunk:', chunk.size, 'bytes');
        audioChunks = [];
        
        const base64data = await blobToBase64(chunk);
        const emitPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Socket timeout'));
            }, SOCKET_TIMEOUT);

            socket.emit('audio', { 
                audio: base64data,
                modality: 'audio',
                isChunk: true
            }, (response) => {
                clearTimeout(timeout);
                resolve(response);
            });
        });

        await emitPromise;
        console.log('Audio chunk sent successfully');
    } catch (error) {
        console.error('Error sending audio chunk:', error);
        addSystemMessage('error', 'Error sending audio data. Please try again.');
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (error) => {
            console.error('Error converting blob to base64:', error);
            reject(error);
        };
        reader.readAsDataURL(blob);
    });
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

async function sendAudioToServer() {
    if (audioChunks.length === 0) {
        console.warn('No audio recorded');
        addSystemMessage('error', 'No audio recorded. Please try again.');
        return;
    }

    try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('Preparing to send audio:', audioBlob.size, 'bytes');
        audioChunks = [];
        
        const base64data = await blobToBase64(audioBlob);
        const emitPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Socket timeout'));
            }, SOCKET_TIMEOUT);

            socket.emit('audio', { 
                audio: base64data,
                modality: 'audio'
            }, (response) => {
                clearTimeout(timeout);
                resolve(response);
            });
        });

        await emitPromise;
        console.log('Full audio sent successfully');
    } catch (error) {
        console.error('Error processing audio:', error);
        addSystemMessage('error', 'Error processing audio. Please try again.');
    }
}

function playAudioResponse(text) {
    if ('speechSynthesis' in window) {
        console.log('Playing audio response');
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        const stopButton = document.getElementById('stopButton');
        stopButton.style.display = 'flex';
        
        utterance.onstart = () => {
            console.log('Started playing audio response');
            setConversationState('Casey speaking');
        };
        
        utterance.onend = () => {
            console.log('Finished playing audio response');
            setConversationState('paused');
            stopButton.style.display = 'none';
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            addSystemMessage('error', 'Error playing audio response. Please read the text instead.');
            stopButton.style.display = 'none';
        };

        window.speechSynthesis.speak(utterance);
        
        stopButton.onclick = () => {
            window.speechSynthesis.cancel();
        };
    } else {
        console.warn('Text-to-speech not supported');
        addSystemMessage('warning', 'Text-to-speech is not supported in your browser.');
    }
}

function handleTextSubmit(event) {
    event.preventDefault();
    const messageInput = document.getElementById('messageInput');
    const userMessage = messageInput.value.trim();
    
    if (userMessage) {
        console.log('Sending text message');
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
    console.log(`Adding ${sender} message:`, text.substring(0, 50) + '...');
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = sender === 'User' ? 'user-message' : 'casey-message';
    messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(type, message) {
    console.log(`System message (${type}):`, message);
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `alert alert-${type} my-2`;
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function setConversationState(state) {
    console.log('Setting conversation state:', state);
    const stateElement = document.getElementById('conversationState');
    const states = {
        'paused': 'alert-info',
        'user talking': 'alert-primary',
        'Casey thinking': 'alert-warning',
        'Casey speaking': 'alert-success',
        'error': 'alert-danger'
    };
    
    if (state === 'paused') {
        stateElement.style.visibility = 'hidden';
        stateElement.innerText = '';  // Clear the text content when paused
    } else {
        stateElement.style.visibility = 'visible';
        stateElement.className = `alert ${states[state] || 'alert-info'}`;
        stateElement.innerText = `Conversation State: ${state}`;
    }
}

document.getElementById('talkButton').addEventListener('mousedown', startRecording);
document.getElementById('talkButton').addEventListener('mouseup', stopRecording);
document.getElementById('textForm').addEventListener('submit', handleTextSubmit);

handleTabChange('voice');
