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
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const User = class {
  constructor(username, captain, socketId) {
    this.username = username;
    this.captain = captain;
    this.socketId = socketId;
    this.score = 0;
    this.answerOrder = null;
    this.active = false;
  }
}


// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.FIREBASE_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://triviacircle-aab16-default-rtdb.europe-west1.firebasedatabase.app/", // Use your Firebase Database URL
});

app.use(cors());
app.use(express.json()); // Midd ̰leware to parse JSON requests, if you still need it for other purposes

//clean the db when the server starts
const db = admin.database();
const ref = db.ref("rooms");
ref.remove().then(() => {
    console.log("Database cleaned successfully");
}
).catch(error => {
    console.error("Error cleaning the database:", error);
});


// In-memory storage for rooms and their users
const rooms = {
  room1: {
    user1: new User("user1"),
    user2: new User("user2"),
  },
  room2: {
    user3: new User("user3"),
    user4: new User("user4"),
  },
};

const emitRoomDetails = (roomId) => {
  if (rooms[roomId]) {
    const users = Object.keys(rooms[roomId]).map(username => ({ username }));
    io.to(roomId).emit('roomDetails', { roomId, users });
  }
};


io.on("connection", (socket) => {
  console.log("Client connected with ID:", socket.id);

  // Maps to track socket to user and room relationships
  const socketToUser = {};
  const socketToRoom = {};

  socket.on("createRoom", ({ username }) => {
    const roomId = Math.random().toString(36).substring(2, 9);
    rooms[roomId] = { [username]: new User(username, true, socket.id)};
    socket.join(roomId);
    socketToUser[socket.id] = username;
    socketToRoom[socket.id] = roomId;

    console.log(`Room ${roomId} created and joined by ${username}`);

    //add the data to the database
    const user = new User(username, true, socket.id);
    const db = admin.database();
    const ref = db.ref("rooms/" + roomId + "/users/" + username);
    ref.set(user);
  
    socket.emit("roomCreated", { roomId, username });
    emitRoomDetails(roomId); // Emit room details after creation
  });

  socket.on("joinRoom", ({ roomId, username }) => {
    if (rooms[roomId]) {
      rooms[roomId][username] = new User(username, false, socket.id);
      socket.join(roomId);
      socketToUser[socket.id] = username;
      socketToRoom[socket.id] = roomId;

      console.log(`${username} joined room ${roomId}`);

      socket.emit("joinRoomSuccess", { roomId, users: rooms[roomId] });
      io.to(roomId).emit("userJoined", username); // Notify others in the room
      emitRoomDetails(roomId); // Emit updated room details
      //add the data to the database
      const user = new User(username, false, socket.id);
      const db = admin.database();
      const ref = db.ref("rooms/" + roomId + "/users/" + username);
      ref.set(user);
    } else {
      socket.emit("errorMessage", `Room ${roomId} does not exist.`);
    }
  });

  socket.on("startGame", ({ roomId }) => {
    io.to(roomId).emit("gameStarted");
  });

  

  socket.on("leaveRoom", () => {
    const username = socketToUser[socket.id];
    const roomId = socketToRoom[socket.id];
    
    if (username && roomId && rooms[roomId] && rooms[roomId][username]) {
        delete rooms[roomId][username];
        socket.leave(roomId);
        io.to(roomId).emit("userLeft", username); // Notify other users in the room

        // Delete from the database
        const db = admin.database();
        const ref = db.ref("rooms/" + roomId + "/users/" + username);
        ref.remove().then(() => {
            console.log(`${username} successfully removed from the database`);
        }).catch(error => {
            console.error(`Error removing ${username} from the database:`, error);
        });

        emitRoomDetails(roomId); // Emit updated room details
        console.log(`${username} left room ${roomId}`);

        // Clean up the mappings
        delete socketToUser[socket.id];
        delete socketToRoom[socket.id];
    } else {
        socket.emit("errorMessage", "You are not in any room or room does not exist.");
    }
});

  socket.on("chatMessage", ({ roomId, username, message }) => {
    io.to(roomId).emit("message", { username, text: message });
    console.log(`Message from ${username} in room ${roomId}: ${message}`);
    console.log(rooms)
  });

  socket.on("disconnect", () => {
      const username = socketToUser[socket.id];
      const roomId = socketToRoom[socket.id];
      if (username && roomId && rooms[roomId] && rooms[roomId][username]) {
          delete rooms[roomId][username];
          socket.leave(roomId);
          io.to(roomId).emit("userLeft", username);
          const db = admin.database();
          const ref = db.ref("rooms/" + roomId + "/users/" + username);
          ref.remove();
          emitRoomDetails(roomId);
      }
      delete socketToUser[socket.id];
      delete socketToRoom[socket.id];
      console.log("Client disconnected", socket.id);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});