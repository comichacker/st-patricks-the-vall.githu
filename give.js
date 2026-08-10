// server.js - SoundPulse / MovieBox WebSocket Server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Track online users
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`[+] Client connected: ${socket.id}`);

  // User joins room / authenticates
  socket.on('user_join', (data) => {
    const user = {
      id: socket.id,
      name: data.username || 'Anonymous Listener',
      avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      room: data.room || 'general'
    };

    onlineUsers.set(socket.id, user);
    socket.join(user.room);

    // Notify room of user join
    io.to(user.room).emit('user_list_update', Array.from(onlineUsers.values()).filter(u => u.room === user.room));
    socket.to(user.room).emit('system_message', { text: `${user.name} joined the channel.` });
  });

  // Handle incoming chat messages
  socket.on('send_message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const messagePayload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: user.name,
      avatar: user.avatar,
      text: data.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      self: false
    };

    // Broadcast to everyone else in the room
    socket.to(user.room).emit('receive_message', messagePayload);
  });

  // Handle typing indicators
  socket.on('typing_start', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.to(user.room).emit('user_typing', { name: user.name });
  });

  socket.on('typing_stop', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.to(user.room).emit('user_stop_typing', { name: user.name });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.to(user.room).emit('system_message', { text: `${user.name} left the channel.` });
      onlineUsers.delete(socket.id);
      io.to(user.room).emit('user_list_update', Array.from(onlineUsers.values()).filter(u => u.room === user.room));
    }
    console.log(`[-] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 SoundPulse WebSocket Server running on port ${PORT}`);
});