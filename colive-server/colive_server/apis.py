from flask_socketio import SocketIO, emit, send, ConnectionRefusedError, join_room, leave_room
from flask_bcrypt import check_password_hash
from flask_login import login_user, logout_user, current_user

from .app import app
from .auth import socket_login_required
from .db import db, Room, User

socketio = SocketIO(app)


@socketio.on('login')
def login_handler(data: dict):
    room_id = data.pop('room_id', 0)
    password = str(data.pop('password', ''))
    addr = str(data.pop('addr', ''))
    if not validate_room_id(room_id):
        raise ConnectionRefusedError(1, 'Unauthorized')

    room = Room.query.get(room_id)
    if room and check_password_hash(room.password, password):
        user = User(addr=addr, room=room)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        join_room(room_id)
        print([u.addr for u in room.users if u.id != user.id])
        emit('login', {
            'user_id': current_user.id,
            'addr_set': [u.addr for u in room.users if u.id != user.id],
            **data,
        }, broadcast=False)
    else:
        raise ConnectionRefusedError(1, 'Unauthorized')


def validate_room_id(room_id: int) -> bool:
    if isinstance(room_id, int):
        return True
    else:
        return False


@socketio.on('message')
@socket_login_required
def broadcast_handler(msg):
    send(msg, broadcast=True, include_self=False, room=current_user.room.id)


@socketio.on('disconnect')
def disconnect_handler():
    if not current_user.is_anonymous:
        info = {'user_id': int(current_user.id)}
        leave_room(current_user.room_id)
        logout_user()
        db.session.delete(current_user)
        db.session.commit()
        emit('logout', info, broadcast=True, include_self=False)
