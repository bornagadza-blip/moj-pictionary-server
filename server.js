const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" } 
});

// Tvoja lista riječi (preselio sam je na server da svi imaju istu)
const words = ["HARRY POTTER", "PAS", "MAČKA", "AUTO", "AVION", "KUĆA", "SUNCE", "DRVO", "GITARA", "PIZZA", "MOBITEL", "KNJIGA", "SLADOLED", "BROD", "CVIJET", "ŠKOLA", "KOMPJUTER", "BANANA", "LAV", "SRCE", "RIBA", "KAMION", "KROKODIL", "MESO", "LUBENICA", "SNIJEG", "KIŠA", "VATRA", "KRALJ", "ZMAJ", "ČEKIĆ", "ŠALICA", "KAPA", "ČARAPA", "TORBA", "ZUB", "ŠATOR", "OGRADA", "KREVET", "OGLEDALO", "BICIKL", "PUDING", "KIŠOBRAN", "RUKAVICA", "VILICA", "NOŽ", "TANJUR", "PROZOR", "VRATA", "LOPTICA", "KOLAČ", "SIR", "JAJE", "KOKOŠ", "KONJ", "MEDVJED", "SLON", "ŽIRAFA", "ZMIJA", "PAUK", "PČELA", "LEPTIR", "RIJEKA", "MORE", "PLANINA", "OBLAK", "ZVIJEZDA", "MJESEC", "TRAVA", "CIPELE", "HLAČE", "MAJICA", "JAKNA", "TELEVIZOR", "RADIO", "SAT", "NOVAC", "KLJUČ", "TORTE", "GROŽĐE", "JABUKA", "KRUMPIR", "MRKVA", "LIMUN", "ŠUMA", "PIJESAK", "MOST", "PUT", "SVIJETLO", "TAMA", "DORUČAK", "RUČAK", "VEČERA", "ZUBAR", "DOKTOR", "POLICAJAC", "VATROGASAC", "KUHAR", "PJEVAČ", "GLUMAC", "HRVATSKA", "ZAGREB"];

let rooms = {};

io.on('connection', (socket) => {
    console.log('Novi igrač spojen:', socket.id);

    socket.on('join-room', (data) => {
        const { room, username } = data;
        socket.join(room);
        
        if (!rooms[room]) {
            rooms[room] = {
                players: [],
                scores: {},
                readyList: [],
                currentWord: "",
                drawerIdx: -1,
                timer: null,
                timeLeft: 60
            };
        }
        
        // Dodaj igrača ako već nije unutra
        if (!rooms[room].players.find(p => p.id === socket.id)) {
            rooms[room].players.push({ id: socket.id, name: username });
            rooms[room].scores[socket.id] = 0;
        }
        
        // Javi svima u sobi novo stanje
        io.to(room).emit('sync', { 
            players: rooms[room].players, 
            scores: rooms[room].scores, 
            readyList: rooms[room].readyList 
        });
    });

    socket.on('player-ready', (data) => {
        const { room, id } = data;
        if (!rooms[room]) return;
        
        if (!rooms[room].readyList.includes(id)) {
            rooms[room].readyList.push(id);
        }
        
        io.to(room).emit('sync', { 
            players: rooms[room].players, 
            scores: rooms[room].scores, 
            readyList: rooms[room].readyList 
        });

        // Ako su svi spremni (minimalno 2 igrača), kreni rundu
        if (rooms[room].readyList.length === rooms[room].players.length && rooms[room].players.length >= 2) {
            startNewRound(room);
        }
    });

    socket.on('drawing', (data) => {
        // Proslijedi crtež svima u sobi osim onome tko crta
        socket.to(data.room).emit('drawing', data);
    });

    socket.on('chat-msg', (data) => {
        io.to(data.room).emit('chat', { sender: data.sender, msg: data.msg });
    });

    socket.on('correct-guess', (data) => {
        const { room, sender } = data;
        const r = rooms[room];
        if (!r) return;

        r.scores[socket.id] = (r.scores[socket.id] || 0) + 10;
        clearInterval(r.timer);
        
        io.to(room).emit('chat', { sender: "SISTEM", msg: `${sender} JE POGODIO!`, cls: 'correct' });
        io.to(room).emit('end-round', { msg: `${sender} JE POGODIO!`, word: r.currentWord, scores: r.scores });
        r.readyList = [];
    });

    socket.on('drawer-ready', (room) => {
        startTimer(room);
    });

    socket.on('disconnect', () => {
        for (let room in rooms) {
            rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);
            rooms[room].readyList = rooms[room].readyList.filter(id => id !== socket.id);
            
            if (rooms[room].players.length === 0) {
                delete rooms[room];
            } else {
                io.to(room).emit('sync', { 
                    players: rooms[room].players, 
                    scores: rooms[room].scores, 
                    readyList: rooms[room].readyList 
                });
            }
        }
    });
});

function startNewRound(room) {
    const r = rooms[room];
    r.readyList = [];
    r.drawerIdx = (r.drawerIdx + 1) % r.players.length;
    r.currentWord = words[Math.floor(Math.random() * words.length)];
    
    io.to(room).emit('start-round', { 
        drId: r.players[r.drawerIdx].id, 
        word: r.currentWord 
    });
}

function startTimer(room) {
    const r = rooms[room];
    if (!r) return;
    clearInterval(r.timer);
    r.timeLeft = 60;
    r.timer = setInterval(() => {
        r.timeLeft--;
        io.to(room).emit('time', r.timeLeft);
        if (r.timeLeft <= 0) {
            clearInterval(r.timer);
            io.to(room).emit('end-round', { msg: "VRIJEME ISTEKLO!", word: r.currentWord, scores: r.scores });
            r.readyList = [];
        }
    }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server radi na portu ${PORT}`));