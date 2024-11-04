const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling']
});
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

// Rest of the file remains the same...
