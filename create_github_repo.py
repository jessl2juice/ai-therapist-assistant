import os
from urllib import request
import json

def create_github_repo():
    github_token = os.environ['GITHUB_TOKEN']
    
    # Create request data
    data = {
        'name': 'ai-therapist-assistant',
        'description': 'An AI Therapist Assistant web application using Flask and Vanilla JS with voice and text interaction capabilities',
        'private': False
    }
    
    # Prepare the request
    headers = {
        'Authorization': f'token {github_token}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }
    
    # Create request object
    req = request.Request(
        'https://api.github.com/user/repos',
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    
    try:
        # Send request
        with request.urlopen(req) as response:
            if response.status == 201:
                repo_data = json.loads(response.read().decode())
                return repo_data['clone_url']
            else:
                print(f"Error: Received status code {response.status}")
                return None
    except Exception as e:
        print(f"Error creating repository: {str(e)}")
        return None

if __name__ == "__main__":
    clone_url = create_github_repo()
    if clone_url:
        print(f"REPO_URL:{clone_url}")
    else:
        print("Failed to create repository")
