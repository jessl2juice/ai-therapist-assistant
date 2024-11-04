import os
import logging
import time
import base64
import json
from typing import Optional, Union, Dict
from openai import OpenAI, APIError, RateLimitError, APIConnectionError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds
MAX_TOKENS = 150
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB max size for audio
CHUNK_SIZE = 16000  # Sample rate for audio chunking

class OpenAIHelper:
    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is not set in environment variables")
        
        self.client = OpenAI(api_key=self.api_key)
        self.system_prompt = """You are Casey, an AI therapeutic assistant trained to provide empathetic and supportive responses. Your role is to:
- Listen actively and respond with genuine empathy
- Help users explore their thoughts and feelings safely
- Provide emotional support and validation
- Encourage positive coping strategies
- Maintain professional boundaries and ethical guidelines

Important notes:
- Do not provide medical advice or diagnoses
- Do not prescribe medications or treatments
- If users express thoughts of self-harm, direct them to professional help
- Keep responses focused on emotional support and understanding"""

    def _validate_audio_data(self, audio_data: str) -> bytes:
        """Validate and preprocess audio data"""
        try:
            # Remove data URL prefix if present
            if 'base64,' in audio_data:
                audio_data = audio_data.split('base64,')[1]
            
            # Decode base64 data
            decoded_data = base64.b64decode(audio_data)
            
            # Check size
            if len(decoded_data) > MAX_AUDIO_SIZE:
                raise ValueError(f"Audio file size exceeds maximum limit of {MAX_AUDIO_SIZE/1024/1024}MB")
            
            return decoded_data
        except Exception as e:
            logger.error(f"Audio validation error: {str(e)}")
            raise ValueError(f"Invalid audio data: {str(e)}")

    def _transcribe_audio(self, audio_data: bytes) -> str:
        """Transcribe audio data to text"""
        try:
            # Create a temporary file for the audio
            response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=("audio.webm", audio_data, "audio/webm"),
                response_format="text"
            )
            return response
        except Exception as e:
            logger.error(f"Transcription error: {str(e)}")
            raise ValueError(f"Failed to transcribe audio: {str(e)}")

    def _make_api_call(self, input_text: str, retries: int = MAX_RETRIES) -> Optional[str]:
        """Make API call with retry logic"""
        for attempt in range(retries):
            try:
                logger.info(f"Attempting API call (attempt {attempt + 1}/{retries})")
                response = self.client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": input_text}
                    ],
                    max_tokens=MAX_TOKENS
                )
                return response.choices[0].message.content

            except RateLimitError as e:
                logger.warning(f"Rate limit error: {str(e)}")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                raise

            except APIConnectionError as e:
                logger.error(f"API Connection error: {str(e)}")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                raise

            except APIError as e:
                if "context_length_exceeded" in str(e):
                    # Handle context length exceeded error
                    logger.warning("Context length exceeded, truncating input")
                    input_text = input_text[:len(input_text)//2]  # Simple truncation strategy
                    continue
                logger.error(f"OpenAI API error: {str(e)}")
                raise

            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}")
                raise

    def get_ai_response(self, input_data: Union[str, bytes], modality: str) -> str:
        """Get AI response with error handling and logging"""
        try:
            if modality == 'audio':
                logger.info("Processing audio input")
                # Validate and preprocess audio data
                audio_data = self._validate_audio_data(input_data)
                # Transcribe audio to text
                input_text = self._transcribe_audio(audio_data)
                logger.info("Audio transcribed successfully")
            else:
                if not input_data or not isinstance(input_data, str):
                    raise ValueError("Invalid input: Input text must be a non-empty string")
                input_text = input_data

            logger.info(f"Processing {modality} input")
            response = self._make_api_call(input_text)
            
            if not response:
                raise ValueError("Empty response received from OpenAI")

            logger.info("Successfully generated response")
            return response

        except ValueError as e:
            error_msg = f"Input validation error: {str(e)}"
            logger.error(error_msg)
            return f"I apologize, but I couldn't process your {modality} input. {str(e)}"

        except RateLimitError:
            error_msg = "The service is currently experiencing high demand. Please try again in a moment."
            logger.error(error_msg)
            return error_msg

        except APIConnectionError:
            error_msg = "I'm having trouble connecting to my services. Please check your internet connection and try again."
            logger.error(error_msg)
            return error_msg

        except APIError as e:
            if "context_length_exceeded" in str(e):
                error_msg = "Your message was too long. Please try a shorter message."
            else:
                error_msg = "I'm experiencing technical difficulties. Please try again later."
            logger.error(f"OpenAI API error: {str(e)}")
            return error_msg

        except Exception as e:
            error_msg = f"An unexpected error occurred: {str(e)}"
            logger.error(error_msg)
            return "I apologize, but I'm having trouble processing your request. Please try again later."

# Create a singleton instance
ai_helper = OpenAIHelper()

# Export the get_ai_response function for compatibility
def get_ai_response(input_data: Union[str, bytes], modality: str) -> str:
    return ai_helper.get_ai_response(input_data, modality)
