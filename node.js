// server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

// Enable clustering for better performance
if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Replace the dead worker
  });
} else {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Serve static files from current folder
  app.use(express.static(path.join(__dirname, "../Task3_HTML_Version")));

  // Use Redis for shared state across workers
  const Redis = require("ioredis");
  const redis = new Redis();
  const pub = new Redis();
  const sub = new Redis();

  // Subscribe to Redis channels
  sub.subscribe("text-updates");

  sub.on("message", (channel, message) => {
    if (channel === "text-updates") {
      io.emit("receive-text", message);
    }
  });

  io.on("connection", (socket) => {
    // Get initial state from Redis
    redis.get("currentText").then((text) => {
      socket.emit("receive-text", text || "");
    });

    socket.on("text-change", async (newText) => {
      // Store in Redis
      await redis.set("currentText", newText);
      // Publish to all workers
      pub.publish("text-updates", newText);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  server.listen(5000, () => {
    console.log(`Worker ${process.pid} started`);
  });
}
