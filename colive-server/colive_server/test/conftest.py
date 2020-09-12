from pytest import fixture

from colive_server.db import db, Room


@fixture(scope='session', autouse=True)
def init_db():
    db.drop_all()
    db.create_all()


@fixture(scope='session')
def room():
    room = Room('test')
    db.session.add(room)
    db.session.commit()
    return room
