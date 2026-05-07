import os
import sys

# Add the app directory to the path so imports work correctly
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.main import create_app
from extensions import socketio

app = create_app()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
