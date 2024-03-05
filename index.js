const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store rooms and their connected users
const rooms = {
    'room1': {
        'user1': true,
        'user2': true
    },
    'room2': {
        'user3': true,
        'user4': true
    }
};

// Middleware to parse JSON requests
app.use(express.json());

// Endpoint to create a new room
app.post('/createroom', (req, res) => {
    const { roomId } = req.body;
    if (!rooms[roomId]) {
        rooms[roomId] = {};
        res.status(200).send(`Room ${roomId} created successfully!`);
    } else {
        res.status(400).send(`Room ${roomId} already exists!`);
    }
});

// Endpoint to join a room
app.post('/joinroom', (req, res) => {
    const { roomId, username } = req.body;
    if (rooms[roomId]) {
        rooms[roomId][username] = true;
        res.status(200).send(`Joined room ${roomId} as ${username}`);
        console.log(`User ${username} joined room ${roomId}`);
    } else {
        res.status(404).send(`Room ${roomId} does not exist!`);
    }
});

// Socket.IO event handling
io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle joining a room
    socket.on('joinRoom', (data) => {
        const { roomId, username } = data;
        if (rooms[roomId] && rooms[roomId][username]) {
            socket.join(roomId);
            io.to(roomId).emit('message', `${username} has joined the room`);
            console.log(`User ${username} joined room ${roomId}`);
        } else {
            socket.emit('errorMessage', 'Room or username not found');
        }
    });

    // Handle leaving a room
    socket.on('leaveRoom', (roomId, username) => {
        socket.leave(roomId);
        io.to(roomId).emit('message', `${username} has left the room`);
    });

    // Handle chat messages
    socket.on('chatMessage', (roomId, username, message) => {
        io.to(roomId).emit('message', `${username}: ${message}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
