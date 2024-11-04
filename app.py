import os
import logging
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from openai_helper import get_ai_response
from models import db, User

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max size
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
socketio = SocketIO(app)
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user)
            return jsonify({'success': True, 'name': user.name})
        return jsonify({'success': False, 'message': 'Invalid email or password'})
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        name = request.form.get('name')
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'})
        
        user = User(email=email, name=name)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        return jsonify({'success': True, 'name': user.name})
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/check-auth')
def check_auth():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'name': current_user.name})
    return jsonify({'authenticated': False})

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

# Create database tables
with app.app_context():
    db.create_all()
