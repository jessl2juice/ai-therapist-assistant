import os
import logging
from flask import Flask, render_template, flash, redirect, url_for, request
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user, login_user, logout_user, login_required
from flask_migrate import Migrate
from openai_helper import get_ai_response

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app and extensions
app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max size
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
socketio = SocketIO(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Import models after db initialization to avoid circular imports
from models import User
from forms import LoginForm, RegistrationForm

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Invalid email or password')
            return redirect(url_for('login'))
        login_user(user)
        next_page = request.args.get('next')
        return redirect(next_page or url_for('index'))
    return render_template('login.html', form=form)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data, role=form.role.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Registration successful!')
        return redirect(url_for('login'))
    return render_template('register.html', form=form)

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('index'))

@socketio.on('message')
@login_required
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
@login_required
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

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
