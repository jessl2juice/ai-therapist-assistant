import os
from openai import OpenAI

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

def get_ai_response(input_text: str, modality: str) -> str:
    # Therapeutic context prompt
    system_prompt = """You are Casey, an AI therapeutic assistant. Respond with empathy, 
    understanding, and professional therapeutic insights. Focus on active listening and 
    providing supportive, non-judgmental responses. Never provide medical advice or diagnoses."""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4",  # Using GPT-4 for complex therapeutic responses
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": input_text}
            ],
            max_tokens=150
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"I apologize, but I'm having trouble processing your request. Please try again."
