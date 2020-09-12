import typing

import socketio

from . import conf

sio = socketio.Server(async_mode='threading')

auth_sio = socketio.Client()

client_sio_set: typing.List[socketio.Client] = []


class ServerNamespace(socketio.Namespace):
    def __init__(self, *args, **kwargs):
        self.local_sid = None
        super().__init__(*args, **kwargs)

    def on_connect(self, sid, environ):
        if self.local_sid is None:
            auth_sio.connect(conf.AUTH_SERVER_URL)
        else:
            print('Welcome {}'.format(sid))
            sio.enter_room(sid, 'client')

    def on_disconnect(self, sid):
        if self.local_sid == sid:
            auth_sio.disconnect()
            global client_sio_set
            for c_sio in client_sio_set:
                c_sio.disconnect()
            client_sio_set = []
            self.local_sid = None

    def on_login(self, sid, data):
        self.local_sid = sid
        data = {**data, 'sid': sid, 'addr': conf.LOCAL_SERVER_URL}
        auth_sio.emit('login', data=data)

    def on_message(self, sid, data):
        print(client_sio_set)
        if sid != self.local_sid:
            sio.emit('message', sid=self.local_sid, data=data)
        else:
            disconnected = []
            for i, c_sio in enumerate(client_sio_set):
                if c_sio.connected:
                    c_sio.emit('message', data=data)
                else:
                    disconnected.append(i)

            disconnected.reverse()
            for i in disconnected:
                client_sio_set.pop(i)

            sio.emit('message', data=data, room='client')


sio.register_namespace(ServerNamespace('/'))


class AuthClientNamespace(socketio.ClientNamespace):
    def on_login(self, data: dict):
        addr_set = data.pop('addr_set')
        for c in addr_set:
            c_sio = socketio.Client()

            @c_sio.event
            def message(data):
                sio.emit('message', data=data)

            c_sio.connect(c)
            client_sio_set.append(c_sio)

        sid = data.pop('sid')
        sio.emit('login', sid=sid, data=data)


auth_sio.register_namespace(AuthClientNamespace('/'))
