// Only updating the updateTalkButton function, keeping the rest of the file unchanged
function updateTalkButton(isRecording) {
    const button = document.getElementById('talkButton');
    if (isRecording) {
        button.classList.add('btn-warning');
        button.classList.remove('btn-danger');
    } else {
        button.classList.add('btn-danger');
        button.classList.remove('btn-warning');
    }
}
