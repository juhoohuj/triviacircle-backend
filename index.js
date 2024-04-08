//Juho Ahonen

const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());

const admin = require("firebase-admin");

const serviceAccount = require("/Users/juho/koodi/triviacircle-backend/auth/privakey.json"); // Path to your Firebase service account key JSON file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://triviacircle-aab16-default-rtdb.europe-west1.firebasedatabase.app/", // Your Firebase Realtime Database URL
});

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
  console.log("attempting to join room " + roomId + " as " + username);
  if (rooms[roomId]) {
    rooms[roomId][username] = true;
    const roomObject = {
      roomId: roomId,
      users: rooms[roomId],
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

//socket io, not working completely

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log("Client connected");

  // Handle joining a room
  socket.on("joinRoom", (data) => {
    const { roomId, username } = data;
    console.log(`Attempting to join room ${roomId} as ${username}`);

    // Check if the room exists
    if (rooms[roomId]) {
      // Join the room
      socket.join(roomId);
      console.log(`Socket message: ${username} joined room ${roomId}`);

      // Create user object
      const userObject = {
        name: username,
        totalScore: 0,
        roundScore: 0,
        active: true,
        answerQue: 1,
      };

      // Store user object in Firebase Realtime Database
      admin
        .database()
        .ref(`rooms/${roomId}/users/${socket.id}`)
        .set(userObject)
        .then(() => {
          // Broadcast to the room that a user has joined
          io.to(roomId).emit("message", {
            username: "Room",
            text: `${username} has joined the room`,
          });

          // Send room details to the joining user
          socket.emit("roomDetails", { roomId, users: rooms[roomId] });
        })
        .catch((error) => {
          console.error("Error storing user object:", error);
          socket.emit("errorMessage", "Error joining the room");
        });
    } else {
      // If the room does not exist, send an error message
      socket.emit("errorMessage", `Room ${roomId} does not exist`);
    }
  });

  // Handle leaving a room
  socket.on("leaveRoom", (data) => {
    const { roomId, username } = data;
    console.log(`Leaving room ${roomId} as ${username}`);

    // Leave the room
    socket.leave(roomId);

    // Broadcast to the room that a user has left
    io.to(roomId).emit("message", `${username} has left the room`);
  });

  // Handle sending messages
  socket.on("chatMessage", (data) => {
    const { roomId, username, message } = data;
    console.log(
      `Socket message: ${username} in room ${roomId} sent message: ${message}`
    );

    // Broadcast the message to the room
    io.to(roomId).emit("message", { username, text: message });
  });

  // Handle creating a room
  socket.on("createRoom", (data) => {
    const randomRoomId = Math.random().toString(36).substring(7);
    const { username } = data;

    // Create the room
    rooms[randomRoomId] = {};
    rooms[randomRoomId][username] = true;

    // Join the room
    socket.join(randomRoomId);
    console.log(`User ${username} created and joined room ${randomRoomId}`);

    // Send room creation event to the user
    socket.emit("roomCreated", randomRoomId);
  });

  // Handle disconnection
socket.on("disconnect", () => {
  console.log("Client disconnected");

  // Get the roomId the user is currently in
  const roomId = Object.keys(socket.rooms).find(
    (roomId) => roomId !== socket.id
  );

  if (roomId && rooms[roomId]) {
    // Remove user data from the database
    admin
      .database()
      .ref(`rooms/${roomId}/users/${socket.id}`)
      .remove()
      .then(() => {
        console.log(`User data removed for socket ID ${socket.id} in room ${roomId}`);
      })
      .catch((error) => {
        console.error("Error removing user data:", error);
      });

    // Remove the user from the in-memory rooms object
    delete rooms[roomId][socket.id];
    console.log(`User removed from in-memory rooms object in room ${roomId}`);
  } else {
    console.log("User is not in any room or room does not exist");
  }
});


  // Add a catch-all event listener to log unrecognized events
  socket.onAny((event, ...args) => {
    console.log(`Received unrecognized event: ${event}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
