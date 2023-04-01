// Imports
const { Configuration, OpenAIApi } = require('openai');
const { MongoClient } = require('mongodb');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Configuration
const url = 'mongodb://localhost:27017';
const dbName = 'chatDB';
const apiKey = 'sk-';

// App setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// API setup
const configuration = new Configuration({ apiKey });
const openai = new OpenAIApi(configuration);

// Helper functions
async function getCompletion(msg) {
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: msg }],
  });

  return completion;
}

async function initializeDatabase(db) {
  const usersCollection = db.collection('users');
  const chatroomsCollection = db.collection("chatrooms");

  const newUser = { name: 'John Doe', age: 30, detail: "Hello" };
  const insertResult = await usersCollection.insertOne(newUser);

  console.log('Inserted new user:', insertResult.insertedId);

  const users = await usersCollection.find({}).toArray();
  console.log('All users:', users);

  // Insert a new chatroom
  const newChatroom = { participants: [insertResult.insertedId] };
  const chatroomInsertResult = await chatroomsCollection.insertOne(newChatroom);
  console.log("Inserted new chatroom: ", chatroomInsertResult.insertedId);

  return {
    chatroomInsertResult,
    insertResult
  };
}

async function saveUserMessage(db, chatroom_id, sender_id, message) {
  const messagesCollection = db.collection("messages");

  const newMessage = {
    chatroom_id,
    sender_id,
    message,
    timestamp: new Date(),
  };
  const messageInsertResult = await messagesCollection.insertOne(newMessage);
  console.log("Inserted new user message: ", messageInsertResult.insertedId);
}

async function saveServerMessage(db, chatroom_id, sender_id, message) {
  const messagesCollection = db.collection("messages");

  const newMessage = {
    chatroom_id,
    sender_id,
    message,
    timestamp: new Date(),
  };
  const messageInsertResult = await messagesCollection.insertOne(newMessage);
  console.log("Inserted new server message: ", messageInsertResult.insertedId);
}

// Main function
async function main() {
  // Connect to MongoDB
  const client = new MongoClient(url, { useUnifiedTopology: true });
  await client.connect();
  console.log('Connected successfully to MongoDB');

  // Perform operations
  const db = client.db(dbName);
  const { chatroomInsertResult, insertResult } = await initializeDatabase(db);

  // Routes
  app.use(express.static(__dirname + '/public'));
  app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

  // Socket.io
  io.on("connection", (socket) => {
    console.log("a user connected");

    const chatroom_id = chatroomInsertResult.insertedId;
    const sender_id = insertResult.insertedId;

    socket.on("disconnect", () => {
      console.log("user disconnected");
    });

    socket.on("chat message", async (msg) => {
      console.log("message:", msg);
      io.emit("chat message", { msg, id: "client" });

      // Save user message to the database
      await saveUserMessage(db, chatroom_id, sender_id, msg);
    });

    socket.on("server ms", async (msg) => {
      const response = await getCompletion(msg);
      const answer = response.data.choices[0].message.content;
      console.log(answer);
      io.emit("chat message", { msg: answer, id: "server" });

      // Save server message to the database
      await saveServerMessage(db, chatroom_id, sender_id, answer);
    });
  });

  // Start server
  server.listen(3000, () => {
    console.log('listening on *:3000');
  });
}

main();