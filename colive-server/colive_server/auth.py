import functools

from flask_login import LoginManager, current_user

from .app import app
from .db import User

login_manager = LoginManager()
login_manager.init_app(app)


@login_manager.user_loader
def load_user(user_id: str):
    if user_id.isdigit():
        return User.query.get(int(user_id))
    return None


def socket_login_required(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if current_user.is_authenticated:
            return f(*args, **kwargs)
        else:
            raise ConnectionRefusedError(1, 'Unauthorized')
    return wrapper
