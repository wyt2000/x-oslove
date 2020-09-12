#server.py
from flask import Flask, render_template, request
from flask_socketio import SocketIO,emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, ping_timeout=3, ping_interval=1)
userID = 0
userNum = 0
userSet = {} # map session ID to userID, used to find who disconnect

@socketio.on('connect')
def connect():
    print('connect!')

@socketio.on('login')
def login(message):
    global userID
    global userSet
    global userNum
    userSet[request.sid] = userID
    print('userID: ' + str(userID))
    emit('login', str(userID), broadcast = False, include_self = True)
    userID += 1
    userNum += 1

@socketio.on('logout')
def logout(message):
    print('userID: ' + str(message)+'  logout')
    emit('othersLogout', str(message), broadcast = True, include_self = False)

@socketio.on('disconnect')
def disconnect():
    global userID
    global userNum
    uid = userSet[request.sid]
    print('user %d disconnect!' % uid)
    userSet.pop(request.sid)
    emit('othersLogout', str(uid), broadcast = True, include_self = False)
    userNum -= 1
    if userNum == 0: userID = 0

@socketio.on('cursor')
def cursor(message):
    print('cursor: ' + message)
    emit('cursor', message, broadcast = True, include_self = False)

@socketio.on('message')
def broadcast(message):
    print('received message: ' + message)
    emit('message', message, broadcast = True, include_self = False)

@socketio.on('init')
def init():
    print('init')
    emit('admin', broadcast = True, include_self = False)

@socketio.on('doc')
def doc(message):
    print('received doc: ' + message)
    emit('doc', message, broadcast = True, include_self = False)

@socketio.on('undo')
def undo(message):
    print('broadcast undo to other clients ')
    emit('undo', message, broadcast = True, include_self = False)

@socketio.on('redo')
def redo(message):
    print('broadcast redo to other clients ')
    emit('redo', message, broadcast = True, include_self = False)

if __name__ == '__main__':
    socketio.run(app)
