import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const server = http.createServer(app);


const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";


const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/worktech";

mongoose
  .connect(mongoURI)
  .then(() => console.log(" Connected to MongoDB"))
  .catch((err) => console.error(" MongoDB connection error:", err));



const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});


userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

const User = mongoose.model("User", userSchema);


const chatSchema = new mongoose.Schema({
  roomId: String,
  user: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});

const Chat = mongoose.model("Chat", chatSchema);

// Collaborative Code
const codeSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  code: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
});

const Code = mongoose.model("Code", codeSchema);

// Workspaces
const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: String, default: "guest" },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  language: { type: String, default: "python" },
  roomId: { type: String, required: true, unique: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users with access to this room
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Workspace = mongoose.model("Workspace", workspaceSchema);

// ---------------------- Socket.IO ---------------------

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = {}; // { roomId: code }
const roomsUsers = {}; // { roomId: { username: { color } } }

const getRandomColor = () =>
  "#" + Math.floor(Math.random() * 16777215).toString(16);

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("join_user", (username) => {
    socket.username = username || `User-${socket.id.slice(0, 4)}`;
    console.log(` ${socket.username} joined`);
  });

  // Join workspace room
  socket.on("join_room", async (roomId, userId) => {
    try {
      // Verify workspace exists and user is a member
      const workspace = await Workspace.findOne({ roomId });

      if (!workspace) {
        socket.emit("join_error", { error: "Room not found" });
        return;
      }

      // Check if user is a member (handle both string and ObjectId)
      const isMember = workspace.members.some(
        (memberId) => memberId.toString() === userId || memberId.toString() === userId?.toString()
      );

      if (!isMember) {
        socket.emit("join_error", { error: "Access denied. You are not a member of this room." });
        return;
      }

      // User is authorized, proceed with join
      socket.join(roomId);
      socket.roomId = roomId;

      if (!roomsUsers[roomId]) roomsUsers[roomId] = {};

      if (!roomsUsers[roomId][socket.username]) {
        roomsUsers[roomId][socket.username] = { color: getRandomColor() };
      }

      socket.emit("users_in_room", roomsUsers[roomId]);
      socket.to(roomId).emit("user_joined", { user: socket.username, color: roomsUsers[roomId][socket.username].color });

      // Load existing code
      let existing = await Code.findOne({ roomId });
      if (existing) {
        rooms[roomId] = existing.code;
      } else {
        existing = await Code.create({ roomId, code: "" });
        rooms[roomId] = "";
      }

      socket.emit("code_sync", rooms[roomId]);

      // Send chat history
      const messages = await Chat.find({ roomId })
        .sort({ timestamp: 1 })
        .limit(100);

      socket.emit("chat_history", messages);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("join_error", { error: "Failed to join room" });
    }
  });

  // --- Chat ---
  socket.on("send_message", async ({ roomId, text }) => {
    const message = {
      roomId,
      user: socket.username || "Anonymous",
      text,
      timestamp: new Date(),
    };

    await Chat.create(message);

    io.to(roomId).emit("receive_message", message);
  });

  // --- Collaborative Code ---
  socket.on("code_change", async ({ roomId, code }) => {
    rooms[roomId] = code;

    await Code.findOneAndUpdate(
      { roomId },
      { code, updatedAt: new Date() },
      { upsert: true }
    );

    socket.to(roomId).emit("code_sync", code);
  });

  socket.on("cursor_change", ({ roomId, cursor }) => {
    socket.to(roomId).emit("cursor_update", {
      user: socket.username,
      cursor,
    });
  });

  socket.on("disconnect", () => {
    console.log(` User disconnected: ${socket.username || socket.id}`);

    for (const roomId in roomsUsers) {
      if (roomsUsers[roomId][socket.username]) {
        delete roomsUsers[roomId][socket.username];
        socket.to(roomId).emit("user_left", { user: socket.username });
      }
    }
  });
});

// ---------------------- Authentication Middleware ----------------------

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Room Authorization Middleware
const roomAuthMiddleware = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    const workspace = await Workspace.findOne({ roomId });

    if (!workspace) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Check if user is a member of this room
    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === userId
    );

    if (!isMember) {
      return res.status(403).json({ error: "Access denied. You are not a member of this room." });
    }

    req.workspace = workspace;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authorization failed" });
  }
};

// ---------------------- Authentication Routes ----------------------

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    console.log(" Registration request received");
    const { name, email, password } = req.body;
    console.log(" Registration data:", { name, email, passwordLength: password?.length });

    if (!name || !email || !password) {
      console.warn(" Missing required fields");
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user already exists
    console.log(" Checking if user exists:", email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(" Email already registered:", email);
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create new user
    console.log(" Creating new user:", email);
    const user = new User({ name, email, password });
    await user.save();
    console.log(" User saved to database:", user._id);

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    console.log(" JWT token generated for user:", user._id);

    const response = {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    };
    console.log(" Sending success response");
    res.json(response);
  } catch (error) {
    console.error(" Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Verify token
app.get("/api/auth/verify", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ---------------------- REST API ----------------------

// ---------------------- Code Execution (Judge0 CE proxy) ----------------------

app.post("/api/run", async (req, res) => {
  try {
    const { source_code, language_id, stdin = "" } = req.body;

    if (!source_code || !language_id) {
      return res.status(400).json({ error: "source_code and language_id are required" });
    }

    // Forward to Judge0 CE public instance
    const judge0Res = await fetch(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_code, language_id, stdin }),
      }
    );

    if (!judge0Res.ok) {
      const errText = await judge0Res.text();
      return res.status(502).json({ error: `Judge0 error: ${errText}` });
    }

    const data = await judge0Res.json();
    res.json(data);
  } catch (error) {
    console.error("Code execution error:", error);
    res.status(500).json({ error: "Code execution failed" });
  }
});

// Root
app.get("/", (req, res) =>
  res.send("🚀 Collaborative IDE Server Running")
);

// Workspaces - Get only user's workspaces
app.get("/api/workspaces", authMiddleware, async (req, res) => {
  try {
    // Find workspaces where user is a member
    const workspaces = await Workspace.find({
      members: req.userId
    }).sort({ updatedAt: -1 });
    res.json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({ error: "Failed to fetch workspaces" });
  }
});

app.post("/api/workspaces", authMiddleware, async (req, res) => {
  try {
    const { name, language } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const roomId = `${name.replace(/\s+/g, "-")}-${Date.now()}`;

    const workspace = new Workspace({
      name,
      owner: req.userEmail,
      ownerId: req.userId,
      language: language || "python",
      roomId,
      members: [req.userId], // Add creator as first member
    });

    await workspace.save();
    res.json(workspace);
  } catch (error) {
    console.error("Error creating workspace:", error);
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

// Join a room using room ID
app.post("/api/workspaces/join", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const workspace = await Workspace.findOne({ roomId });

    if (!workspace) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Check if user is already a member
    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === req.userId
    );

    if (isMember) {
      return res.status(200).json({
        message: "Already a member",
        workspace
      });
    }

    // Add user to members
    workspace.members.push(req.userId);
    await workspace.save();

    res.json({
      message: "Successfully joined room",
      workspace
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// Migration endpoint - Add owners to members array for existing workspaces
app.post("/api/workspaces/migrate", authMiddleware, async (req, res) => {
  try {
    // Find all workspaces where members array is empty or doesn't exist
    const workspaces = await Workspace.find({
      $or: [
        { members: { $exists: false } },
        { members: { $size: 0 } }
      ]
    });

    let updated = 0;
    for (const workspace of workspaces) {
      if (workspace.ownerId) {
        workspace.members = [workspace.ownerId];
        await workspace.save();
        updated++;
      }
    }

    res.json({
      message: `Migrated ${updated} workspaces`,
      updated
    });
  } catch (error) {
    console.error("Error migrating workspaces:", error);
    res.status(500).json({ error: "Migration failed" });
  }
});

// Delete or Leave workspace (permission-based)
app.delete("/api/workspaces/:id", authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.userId;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if user is the owner
    const isOwner = workspace.ownerId && workspace.ownerId.toString() === userId;

    if (isOwner) {
      // Owner deletes the entire workspace
      await Workspace.findByIdAndDelete(workspaceId);

      // Also delete associated code and chat
      await Code.deleteMany({ roomId: workspace.roomId });
      await Chat.deleteMany({ roomId: workspace.roomId });

      return res.json({
        success: true,
        action: "deleted",
        message: "Workspace deleted for all members"
      });
    } else {
      // Member leaves the workspace - remove them from members array
      const isMember = workspace.members.some(
        (memberId) => memberId.toString() === userId
      );

      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this workspace" });
      }

      // Remove user from members
      workspace.members = workspace.members.filter(
        (memberId) => memberId.toString() !== userId
      );
      await workspace.save();

      return res.json({
        success: true,
        action: "left",
        message: "You have left the workspace"
      });
    }
  } catch (error) {
    console.error("Error deleting/leaving workspace:", error);
    res.status(500).json({ error: "Failed to delete/leave workspace" });
  }
});

app.put("/api/workspaces/:id", async (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  const workspace = await Workspace.findByIdAndUpdate(
    req.params.id,
    { name, updatedAt: new Date() },
    { new: true }
  );

  res.json(workspace);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`🔥 Server running at http://localhost:${PORT}`)
);
