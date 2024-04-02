const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());

// Store rooms and their connected users
const rooms = {
  room1: {
    user1: true,
    user2: true,
  },
  room2: {
    user3: true,
    user4: true,
  },
};

// Middleware to parse JSON requests
app.use(express.json());

// Endpoint to create a new room
app.post("/createroom", (req, res) => {
  const randomRoomId = Math.random().toString(36).substring(7);

  const { username } = req.body;
  rooms[randomRoomId] = {};
  rooms[randomRoomId][username] = true;
  res.status(201).send(randomRoomId);
  console.log(`User ${username} created room ${randomRoomId}`);
});

app.get("/rooms", (req, res) => {
  res.status(200).send(rooms);
});

// Endpoint to join a room and add a user to it and return the roomid
app.post("/joinroom", (req, res) => {
  const { roomId, username } = req.body;
  console.log("attempting to join room" + roomId + " as " + username);
  if (rooms[roomId] && rooms[roomId][username]) {
    rooms[roomId][username] = true;
    const roomObject = {
      id: roomId,
      username: username,
    };
    res.status(200).send(roomObject);
    console.log(`User ${username} joined room ${roomId}`);
  } else {
    res.status(404).send(`Room ${roomId} does not exist!`);
  }
});

//get all players from one single room
app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  res.status(200).send(rooms[roomId]);
});

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log("New client connected");

  // Handle joining a room
  socket.on("joinRoom", (data) => {
    const { roomId, username } = data;
    if (rooms[roomId] && rooms[roomId][username]) {
      socket.join(roomId);
      io.to(roomId).emit("message", `${username} has joined the room`);
      console.log(`Server: User ${username} joined room ${roomId}`);
    } else {
      socket.emit("errorMessage", "Room or username not found");
    }
  });

  // Handle leaving a room
  socket.on("leaveRoom", (data) => {
    const { roomId, username } = data;
    socket.leave(roomId);
    io.to(roomId).emit("message", `${username} has left the room`);
  });

  // Handle sending messages
  socket.on("chatMessage", (data) => {
    const { roomId, username, message } = data;
    io.to(roomId).emit("message", { username, text: message });
  });


  socket.on("createRoom", (data) => {
    const randomRoomId = Math.random().toString(36).substring(7);
    const { username } = data;
    rooms[randomRoomId] = {};
    rooms[randomRoomId][username] = true;
    socket.emit("roomCreated", randomRoomId);
    console.log(`User ${username} created room ${randomRoomId}`);
  });

  // Handle getting room details
  socket.on("getRoom", (data) => {
    const { roomCode } = data;
    socket.emit("roomDetails", rooms[roomCode]);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
