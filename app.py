import os
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from openai_helper import get_ai_response

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('message')
def handle_message(data):
    try:
        user_message = data.get('message', '')
        modality = data.get('modality', 'text')
        
        # Get response from OpenAI
        ai_response = get_ai_response(user_message, modality)
        
        # Emit response back to client
        emit('response', {
            'content': ai_response,
            'type': 'therapist_response'
        })
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('audio')
def handle_audio(data):
    try:
        audio_data = data.get('audio')
        # Process audio data and get response
        ai_response = get_ai_response(audio_data, 'audio')
        
        emit('response', {
            'content': ai_response,
            'type': 'therapist_response'
        })
    except Exception as e:
        emit('error', {'message': str(e)})
