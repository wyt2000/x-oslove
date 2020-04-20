#server.py
from flask import Flask, render_template
from flask_socketio import SocketIO,send
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@socketio.on('message')
def handle_message(message):
    print('received message: ' + message)
    send('This is the message from server.py to client.js')
if __name__ == '__main__':
    socketio.run(app)