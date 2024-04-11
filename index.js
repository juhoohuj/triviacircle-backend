require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this to your frontend's URL for security in production
  },
});

// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.FIREBASE_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://triviacircle-aab16-default-rtdb.europe-west1.firebasedatabase.app/", // Use your Firebase Database URL
});

app.use(cors());
app.use(express.json()); // Middleware to parse JSON requests, if you still need it for other purposes

// In-memory storage for rooms and their users
const rooms = {};

io.on("connection", (socket) => {
  console.log("Client connected with ID:", socket.id);

  socket.on("createRoom", ({ username }) => {
    const roomId = Math.random().toString(36).substring(2, 9); // Generating a simple room ID
    rooms[roomId] = { [username]: true }; // Adding the room with the user to the in-memory storage

    socket.join(roomId);
    console.log(`Room ${roomId} created and joined by ${username}`);

    socket.emit("roomCreated", { roomId, username });
  });

  socket.on("joinRoom", ({ roomId, username }) => {
    if (rooms[roomId]) {
      rooms[roomId][username] = true;
      socket.join(roomId);
      console.log(`${username} joined room ${roomId}`);

      socket.emit("joinRoomSuccess", { roomId, users: rooms[roomId] });
      io.to(roomId).emit("userJoined", username); // Notify others in the room
    } else {
      socket.emit("errorMessage", `Room ${roomId} does not exist.`);
    }
  });

  

  socket.on("leaveRoom", ({ roomId, username }) => {
    if (rooms[roomId] && rooms[roomId][username]) {
      delete rooms[roomId][username];
      socket.leave(roomId);
      console.log(`${username} left room ${roomId}`);

      io.to(roomId).emit("userLeft", username); // Notify others in the room
    }
  });

  socket.on("chatMessage", ({ roomId, username, message }) => {
    io.to(roomId).emit("message", { username, text: message });
    console.log(`Message from ${username} in room ${roomId}: ${message}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    // Additional logic can be added here to handle disconnection,
    // such as cleaning up user data or notifying rooms of the departure.
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});