import click
from flask.cli import AppGroup

from .app import app
from .db import db, Room

db_cli = AppGroup('db')


@db_cli.command('drop-tables')
def cmd_drop_tables():
    db.drop_all()


@db_cli.command('create-tables')
def cmd_create_tables():
    db.create_all()


@db_cli.command('create-room')
@click.argument('password')
def cmd_create_tables(password):
    room = Room(password=password)
    db.session.add(room)
    db.session.commit()
    click.echo('Room ID is {}'.format(room.id))


app.cli.add_command(db_cli)
