[Previous JavaScript content...]

// Add save settings functionality
document.getElementById('saveVoiceButton').addEventListener('click', function() {
    const settings = {
        voice: document.getElementById('voiceSelect').value,
        rate: document.getElementById('rateRange').value,
        pitch: document.getElementById('pitchRange').value,
        volume: document.getElementById('volumeRange').value
    };
    
    localStorage.setItem('voiceSettings', JSON.stringify(settings));
    alert('Voice settings saved successfully!');
});

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', function() {
    const savedSettings = localStorage.getItem('voiceSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Wait for voices to be loaded
        const loadVoices = setInterval(() => {
            if (speechSynthesis.getVoices().length > 0) {
                document.getElementById('voiceSelect').value = settings.voice;
                document.getElementById('rateRange').value = settings.rate;
                document.getElementById('pitchRange').value = settings.pitch;
                document.getElementById('volumeRange').value = settings.volume;
                
                // Update displayed values
                document.getElementById('rateValue').textContent = settings.rate;
                document.getElementById('pitchValue').textContent = settings.pitch;
                document.getElementById('volumeValue').textContent = settings.volume;
                
                clearInterval(loadVoices);
            }
        }, 100);
    }
});

document.getElementById('talkButton').addEventListener('mousedown', startRecording);
document.getElementById('talkButton').addEventListener('mouseup', stopRecording);
document.getElementById('textForm').addEventListener('submit', handleTextSubmit);

handleTabChange('voice');

document.addEventListener('DOMContentLoaded', () => {
    setConversationState('paused');
    populateVoiceOptions();
});
