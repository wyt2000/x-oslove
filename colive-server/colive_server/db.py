from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import generate_password_hash
from flask_login import UserMixin

from .app import app

db = SQLAlchemy(app)


class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    password = db.Column(db.String(60), nullable=False)
    users = db.relationship('User', backref='room', lazy=True)

    def __init__(self, password):
        super().__init__()
        self.password = generate_password_hash(password)

    def __str__(self):
        return str(self.id)


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    addr = db.Column(db.String(40), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('room.id'), nullable=False)

    def __init__(self, addr, room: Room):
        super().__init__()
        self.addr = addr
        self.room_id = room.id

    def __str__(self):
        return '{} {}'.format(self.id, self.addr)
