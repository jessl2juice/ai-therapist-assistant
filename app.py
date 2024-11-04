import os
import logging
from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit
from openai_helper import get_ai_response

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max size
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/images/<path:filename>')
def serve_image(filename):
    try:
        return send_from_directory(os.path.join(app.root_path, 'static', 'images'), filename)
    except Exception as e:
        logger.error(f"Error serving image {filename}: {str(e)}")
        return 'Image not found', 404

@socketio.on('message')
def handle_message(data):
    try:
        user_message = data.get('message', '')
        modality = data.get('modality', 'text')
        
        if not user_message:
            raise ValueError("Empty message received")
        
        # Get response from OpenAI
        ai_response = get_ai_response(user_message, modality)
        
        # Emit response back to client
        emit('response', {
            'content': ai_response,
            'type': 'therapist_response'
        })
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        emit('error', {'message': str(e)})
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        emit('error', {'message': "An error occurred while processing your message"})

@socketio.on('audio')
def handle_audio(data):
    try:
        audio_data = data.get('audio')
        if not audio_data:
            raise ValueError("No audio data received")
        
        # Process audio data and get response
        ai_response = get_ai_response(audio_data, 'audio')
        
        emit('response', {
            'content': ai_response,
            'type': 'therapist_response'
        })
    except ValueError as e:
        logger.error(f"Audio validation error: {str(e)}")
        emit('error', {'message': str(e)})
    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        emit('error', {'message': "An error occurred while processing your audio"})
