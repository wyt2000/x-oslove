import socketio
from flask import Flask

from . import conf
from .sio import sio

if __name__ == '__main__':
    flask_app = Flask(__name__)
    flask_app.wsgi_app = socketio.WSGIApp(sio, flask_app.wsgi_app)
    flask_app.run(host='0.0.0.0', port=conf.MIDDLEWARE_SERVER_PORT)
