const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ================= DATABASE =================
const db = new sqlite3.Database('./quantumcoin.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    funding_balance REAL DEFAULT 3506.83,
    demo_balance REAL DEFAULT 100000,
    last_login DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(
    `INSERT OR IGNORE INTO admins (username, password)
     VALUES ('admin', ?)`,
    bcrypt.hashSync('admin123', 10)
  );

  db.run(
    `INSERT OR IGNORE INTO users (username, email, password)
     VALUES ('testuser','test@quantumcoin.com',?)`,
    bcrypt.hashSync('password123', 10)
  );
});

// ================= JWT =================
const JWT_SECRET = 'quantumcoin-secret';

// ================= HEALTH CHECK =================
app.get('/api', (req, res) => {
  res.json({
    status: 'OK',
    message: 'QuantumCoin API is running 🚀'
  });
});

// ================= AUTH =================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username=?`, [username], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user });
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM admins WHERE username=?`, [username], (err, admin) => {
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin.id, isAdmin: true }, JWT_SECRET);
    res.json({ token });
  });
});

// ================= MARKET DATA =================
let cryptoData = {
  BTC: { price: 43000 },
  ETH: { price: 2300 },
  DOGE: { price: 0.09 }
};

setInterval(() => {
  Object.keys(cryptoData).forEach(c => {
    cryptoData[c].price *= 1 + (Math.random() - 0.5) * 0.01;
  });
  io.emit('market_update', cryptoData);
}, 3000);

app.get('/api/market-data', (req, res) => {
  res.json(cryptoData);
});

// ================= SOCKET =================
io.on('connection', socket => {
  socket.on('chat_message', msg => {
    db.run(
      `INSERT INTO chat_messages (username,message) VALUES (?,?)`,
      [msg.username, msg.message]
    );
    io.emit('new_chat_message', msg);
  });
});

// ================= START =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
