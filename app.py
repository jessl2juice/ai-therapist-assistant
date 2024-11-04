import os
import logging
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from models import db, User
from openai_helper import get_ai_response

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max size
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
socketio = SocketIO(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Initialize database with drop_all and create_all
with app.app_context():
    db.drop_all()
    db.create_all()

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'danger')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('register.html')
            
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'danger')
            return render_template('register.html')
            
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'danger')
            return render_template('register.html')
            
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

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
