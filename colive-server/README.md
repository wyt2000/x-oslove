# colive-server

Server side of colive.

`colive` is a text live-sharing system to easy editing.

## Usage

The interaction in colive is based on `socket.io`.

### Auth

Any client connected to the server with socket.io should auth to login,
or any other action will cause the server to disconnect.

To login, the client should provide the room name, username and respective secret like:

```js
emit('login', { room: 'room name', username: 'username', secret: 'room secret' });
```

## License

GPL 3.0 or late.

Copyright (C) 2020  Team oslove

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

See `LICENSE` file in the root folder for detail.
