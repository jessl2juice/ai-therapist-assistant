// Previous code remains the same up to line 229
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
            // Don't hide the button here, let onend handle it
        };
    } else {
        console.warn('Text-to-speech not supported');
        addSystemMessage('warning', 'Text-to-speech is not supported in your browser.');
    }
}

// Rest of the code remains the same
