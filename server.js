const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let rooms = {}; // Ovdje server čuva sve aktivne sobe

io.on('connection', (socket) => {
    console.log('Novi igrač spojen:', socket.id);

    socket.on('join-room', ({ room, username }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { players: [], currentDrawer: 0, word: "" };
        }
        rooms[room].players.push({ id: socket.id, name: username, score: 0 });
        
        // Obavijesti sve u sobi da je netko ušao
        io.to(room).emit('update-players', rooms[room].players);
    });

    socket.on('draw-data', (data) => {
        // Server samo prosljeđuje crtež svima u sobi osim onome tko crta
        socket.to(data.room).emit('remote-draw', data);
    });

    socket.on('disconnect', () => {
        console.log('Igrač otišao.');
        // Ovdje ide logika za brisanje igrača iz sobe
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server radi!');
});