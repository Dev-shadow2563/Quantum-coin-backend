// ========== SERVER CODE (Backend) ==========
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const app = express();
const axios = require('axios');
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ========== CORS CONFIGURATION ==========
const corsOptions = {
  origin: [
    'https://quantumcoin.com.ng',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'https://quantum-coin-slv1.vercel.app',
    'https://quantum-coin-backend.onrender.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// ========== GOOGLE OAUTH CONFIGURATION ==========
const GOOGLE_CLIENT_ID = '960526558312-gijpb2ergfdaco08e8et34vlqjr09o36.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ========== DATABASE SETUP ==========
const db = new sqlite3.Database(':memory:');

function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      funding_balance REAL DEFAULT 5000.00,
      demo_balance REAL DEFAULT 100000.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`);

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      network TEXT,
      wallet_address TEXT,
      transaction_hash TEXT,
      fees REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      admin_approved BOOLEAN DEFAULT 0,
      admin_id INTEGER,
      admin_notes TEXT,
      user_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // User notifications table
    db.run(`CREATE TABLE IF NOT EXISTS user_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Admin users table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default admin if not exists
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO admins (username, password) VALUES (?, ?)`, 
      ['admin', adminPassword]);

    // Insert default user if not exists
    const userPassword = bcrypt.hashSync('password123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)`, 
      ['testuser', 'test@quantumcoin.com', userPassword, 5000.00, 100000.00]);
    
    console.log('✅ Database initialized with complete features');
  });
}

// Database helper functions
const dbQuery = {
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

// Simple session storage
const sessions = new Map();

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const session = sessions.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  req.user = session.user;
  next();
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const session = sessions.get(token);
  
  if (!session || !session.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.user = session.user;
  next();
}

// ========== MARKET DATA SIMULATION ==========
let cryptoData = {
  BTC: { 
    name: 'Bitcoin', 
    price: 42150.75, 
    change: 2.34, 
    volume: 24500000000, 
    color: '#f7931a',
    volatility: 0.02 
  },
  ETH: { 
    name: 'Ethereum', 
    price: 2315.42, 
    change: 3.21, 
    volume: 9800000000, 
    color: '#627eea',
    volatility: 0.03 
  },
  DOGE: { 
    name: 'Dogecoin', 
    price: 0.086, 
    change: 5.45, 
    volume: 1200000000, 
    color: '#c2a633',
    volatility: 0.05 
  }
};

// Simulate market updates
function updateMarketPrices() {
  for (const coin in cryptoData) {
    const volatility = cryptoData[coin].volatility || 0.02;
    const changePercent = (Math.random() * volatility * 2) - volatility;
    
    cryptoData[coin].price = cryptoData[coin].price * (1 + changePercent);
    cryptoData[coin].change = parseFloat((changePercent * 100).toFixed(2));
    cryptoData[coin].volume = cryptoData[coin].volume * (1 + Math.random() * 0.1 - 0.05);
  }
  
  // Broadcast update to all connected clients
  io.emit('market_update', cryptoData);
}

// Update prices every 3 seconds
setInterval(updateMarketPrices, 3000);

// ========== HELPER FUNCTIONS ==========
async function createNotification(userId, type, title, message, data = {}) {
  try {
    await dbQuery.run(
      `INSERT INTO user_notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, JSON.stringify(data)]
    );
    
    // Send via WebSocket
    io.to(`user_${userId}`).emit('notification', {
      type: type,
      title: title,
      message: message,
      data: data,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

// ========== API ROUTES ==========

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'QuantumCoin API',
    version: '1.0.0'
  });
});

// API Root
app.get('/api', (req, res) => {
  res.json({
    status: "OK",
    message: "QuantumCoin API v1.0 - Complete with Admin Panel",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      market: "/api/market",
      admin: "/api/admin",
      health: "/api/health",
      withdrawal: "/api/transactions/withdraw"
    }
  });
});

// ========== AUTH ROUTES ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await dbQuery.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await dbQuery.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    // Create session token
    const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance,
        isAdmin: false
      },
      createdAt: Date.now()
    });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== GOOGLE AUTH ENDPOINT ==========
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'No Google credential provided' });
    }

    console.log('🔐 Google auth attempt received');

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    if (!payload.email_verified) {
      return res.status(400).json({ error: 'Email not verified by Google' });
    }

    const { email, name, picture, sub: googleId } = payload;
    const username = email.split('@')[0];

    console.log(`✅ Google auth successful for: ${email}`);

    // Check if user already exists
    let user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      // Create new user with Google sign-in
      const randomPassword = bcrypt.hashSync(googleId + Date.now(), 10);
      
      await dbQuery.run(
        `INSERT INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)`,
        [username, email, randomPassword, 5000.00, 100000.00]
      );
      
      user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email]);
      console.log(`👤 New user created: ${username}`);
    }

    // Update last login
    await dbQuery.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Create session token
    const token = `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: name || user.username,
        picture: picture,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance,
        isAdmin: false,
        auth_method: 'google'
      },
      createdAt: Date.now()
    });

    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: name || user.username,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance,
        picture: picture
      }
    });

  } catch (error) {
    console.error('❌ Google auth error:', error.message);
    
    if (error.message.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google token expired. Please try again.' });
    }
    
    if (error.message.includes('Wrong number of segments')) {
      return res.status(400).json({ error: 'Invalid Google token format' });
    }
    
    res.status(500).json({ 
      error: 'Google authentication failed',
      details: error.message 
    });
  }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await dbQuery.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await dbQuery.run(
      `INSERT INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, 5000.00, 100000.00]
    );
    
    // Get the new user
    const user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email]);
    
    // Create session token
    const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance,
        isAdmin: false
      },
      createdAt: Date.now()
    });
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    sessions.delete(token);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = await dbQuery.get('SELECT * FROM admins WHERE username = ?', [username]);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = bcrypt.compareSync(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session token
    const token = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: admin.id,
        username: admin.username,
        isAdmin: true
      },
      createdAt: Date.now()
    });
    
    res.json({ success: true, token, admin: { id: admin.id, username: admin.username } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ADMIN ROUTES ==========

// GET /api/admin/dashboard - Get admin dashboard stats
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      dbQuery.get('SELECT COUNT(*) as total_users FROM users'),
      dbQuery.get('SELECT COUNT(*) as active_today FROM users WHERE last_login > datetime("now", "-1 day")'),
      dbQuery.get('SELECT SUM(funding_balance) as total_funding FROM users'),
      dbQuery.get('SELECT SUM(demo_balance) as total_demo FROM users'),
      dbQuery.get('SELECT COUNT(*) as pending_withdrawals FROM transactions WHERE type = "withdrawal" AND status = "pending"'),
      dbQuery.get('SELECT SUM(amount) as pending_withdrawal_amount FROM transactions WHERE type = "withdrawal" AND status = "pending"'),
      dbQuery.get('SELECT COUNT(*) as pending_deposits FROM transactions WHERE type = "deposit" AND status = "pending"'),
      dbQuery.get('SELECT SUM(amount) as pending_deposit_amount FROM transactions WHERE type = "deposit" AND status = "pending"')
    ]);
    
    res.json({
      total_users: stats[0].total_users,
      active_today: stats[1].active_today,
      total_funding: stats[2].total_funding || 0,
      total_demo: stats[3].total_demo || 0,
      pending_withdrawals: stats[4].pending_withdrawals,
      pending_withdrawal_amount: stats[5].pending_withdrawal_amount || 0,
      pending_deposits: stats[6].pending_deposits,
      pending_deposit_amount: stats[7].pending_deposit_amount || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await dbQuery.all(
      `SELECT id, username, email, funding_balance, demo_balance, 
              created_at, last_login, is_active 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/transactions/pending', authenticateAdmin, async (req, res) => {
  try {
    const transactions = await dbQuery.all(
      `SELECT t.*, u.username, u.email 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.status = 'pending' 
       ORDER BY t.created_at DESC`
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

app.get('/api/admin/transactions', authenticateAdmin, async (req, res) => {
  try {
    const transactions = await dbQuery.all(
      `SELECT t.*, u.username, u.email, a.username as admin_username
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       LEFT JOIN admins a ON t.admin_id = a.id
       WHERE t.status IN ('completed', 'rejected')
       ORDER BY t.completed_at DESC
       LIMIT 50`
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completed transactions' });
  }
});

// ========== WITHDRAWAL MANAGEMENT ROUTES ==========

// GET /api/admin/withdrawals/pending - Get pending withdrawals (for admin)
app.get('/api/admin/withdrawals/pending', authenticateAdmin, async (req, res) => {
  try {
    const withdrawals = await dbQuery.all(
      `SELECT t.*, u.username, u.email, u.funding_balance 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.type = 'withdrawal' AND t.status = 'pending'
       ORDER BY t.created_at DESC`
    );
    
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

// GET /api/admin/withdrawals/:id - Get specific withdrawal
app.get('/api/admin/withdrawals/:id', authenticateAdmin, async (req, res) => {
  try {
    const withdrawal = await dbQuery.get(
      `SELECT t.*, u.username, u.email, u.funding_balance 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ? AND t.type = 'withdrawal'`,
      [req.params.id]
    );
    
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    res.json(withdrawal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch withdrawal' });
  }
});

// POST /api/admin/withdrawals/:id/complete - Admin completes withdrawal
app.post('/api/admin/withdrawals/:id/complete', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_hash, notes } = req.body;
    
    // Get transaction
    const transaction = await dbQuery.get(
      `SELECT t.*, u.username, u.email 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ?`,
      [id]
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ error: 'Not a withdrawal transaction' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    // Update transaction as completed
    await dbQuery.run(
      `UPDATE transactions SET 
       status = 'completed',
       admin_approved = 1,
       admin_id = ?,
       admin_notes = ?,
       transaction_hash = ?,
       completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, notes || 'Withdrawal completed by admin', transaction_hash, id]
    );
    
    // Create notification for user
    await createNotification(
      transaction.user_id,
      'success',
      '✅ Withdrawal Completed',
      `Your withdrawal of $${transaction.amount.toFixed(2)} has been completed. Transaction Hash: ${transaction_hash}`,
      { 
        transactionId: id,
        amount: transaction.amount,
        transaction_hash: transaction_hash,
        network: transaction.network,
        wallet_address: transaction.wallet_address,
        action: 'view_transaction'
      }
    );
    
    res.json({
      success: true,
      message: 'Withdrawal marked as completed',
      transactionId: id,
      amount: transaction.amount,
      username: transaction.username
    });
  } catch (error) {
    console.error('Complete withdrawal error:', error);
    res.status(500).json({ error: 'Failed to complete withdrawal' });
  }
});

// POST /api/admin/withdrawals/:id/reject - Admin rejects withdrawal
app.post('/api/admin/withdrawals/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const transaction = await dbQuery.get(
      `SELECT t.*, u.username 
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ?`,
      [id]
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Return funds to user
    await dbQuery.run(
      'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
      [transaction.amount, transaction.user_id]
    );
    
    // Update transaction as rejected
    await dbQuery.run(
      `UPDATE transactions SET 
       status = 'rejected',
       admin_approved = 0,
       admin_id = ?,
       admin_notes = ?,
       completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, notes || 'Withdrawal rejected by admin', id]
    );
    
    // Create notification for user
    await createNotification(
      transaction.user_id,
      'danger',
      '❌ Withdrawal Rejected',
      `Your withdrawal of $${transaction.amount.toFixed(2)} has been rejected. Funds have been returned to your account.`,
      { 
        transactionId: id,
        amount: transaction.amount,
        notes: notes,
        action: 'contact_support'
      }
    );
    
    res.json({
      success: true,
      message: 'Withdrawal rejected and funds returned',
      transactionId: id,
      amount: transaction.amount,
      username: transaction.username
    });
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

app.post('/api/admin/transactions/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, action } = req.body;
    
    const transaction = await dbQuery.get('SELECT * FROM transactions WHERE id = ?', [id]);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.type === 'deposit') {
      const bonus = transaction.amount >= 1000 ? transaction.amount * 0.05 : 0;
      const totalAmount = transaction.amount + bonus;
      
      await dbQuery.run(
        'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
        [totalAmount, transaction.user_id]
      );
      
      // Send notification to user
      await createNotification(
        transaction.user_id,
        'success',
        'Deposit Approved ✅',
        `Your deposit of $${transaction.amount.toFixed(2)} has been approved. $${totalAmount.toFixed(2)} (including $${bonus.toFixed(2)} bonus) has been added to your account.`,
        { 
          transactionId: id,
          amount: transaction.amount,
          bonus: bonus,
          total: totalAmount
        }
      );
      
      // Emit balance update
      const updatedUser = await dbQuery.get('SELECT funding_balance FROM users WHERE id = ?', [transaction.user_id]);
      io.to(`user_${transaction.user_id}`).emit('balance_update', {
        funding_balance: updatedUser.funding_balance
      });
    }
    
    await dbQuery.run(
      `UPDATE transactions SET 
       status = 'completed',
       admin_approved = 1,
       admin_id = ?,
       admin_notes = ?,
       completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, notes || 'Approved by admin', id]
    );
    
    res.json({ success: true, message: 'Transaction approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve transaction' });
  }
});

app.post('/api/admin/transactions/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, action } = req.body;
    
    const transaction = await dbQuery.get('SELECT * FROM transactions WHERE id = ?', [id]);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.type === 'withdrawal') {
      await dbQuery.run(
        'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
        [transaction.amount, transaction.user_id]
      );
    }
    
    // Send notification to user
    const notificationMessage = action === 'not_seen' 
      ? `Your deposit of $${transaction.amount.toFixed(2)} was not received. Please check your payment and try again.`
      : `Your transaction of $${transaction.amount.toFixed(2)} has been rejected.`;
    
    const notificationTitle = action === 'not_seen' 
      ? 'Payment Not Received ⚠️'
      : 'Transaction Rejected ❌';
    
    await createNotification(
      transaction.user_id,
      action === 'not_seen' ? 'warning' : 'danger',
      notificationTitle,
      notificationMessage,
      { 
        transactionId: id,
        amount: transaction.amount,
        notes: notes,
        action: action === 'not_seen' ? 'retry_deposit' : 'contact_support'
      }
    );
    
    await dbQuery.run(
      `UPDATE transactions SET 
       status = 'rejected',
       admin_approved = 0,
       admin_id = ?,
       admin_notes = ?,
       completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, notes || 'Rejected by admin', id]
    );
    
    res.json({ success: true, message: 'Transaction rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject transaction' });
  }
});

// ========== FRONTEND ADMIN PANEL ==========
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QuantumCoin Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #00f0ff;
            --primary-dark: #00a8b5;
            --success: #00ff88;
            --danger: #ff006e;
            --warning: #ffcc00;
            --background: #050510;
            --card-bg: #0a0a1a;
            --text: #e2fafc;
            --text-secondary: #8a9ea0;
            --border: rgba(0, 240, 255, 0.1);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, sans-serif;
        }
        
        body {
            background: var(--background);
            color: var(--text);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Login View */
        #loginView {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #050510 0%, #0a0a20 100%);
        }
        
        .login-container {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 50px rgba(0, 240, 255, 0.1);
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-header h1 {
            color: var(--primary);
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, var(--primary), var(--success));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .login-header p {
            color: var(--text-secondary);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text);
            font-weight: 500;
        }
        
        .form-control {
            width: 100%;
            padding: 12px 16px;
            background: rgba(0, 240, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 10px;
            color: var(--text);
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2);
        }
        
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(45deg, var(--primary), var(--primary-dark));
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            text-align: center;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0, 240, 255, 0.3);
        }
        
        .btn-block {
            width: 100%;
        }
        
        .error-message {
            background: rgba(255, 0, 110, 0.1);
            border: 1px solid rgba(255, 0, 110, 0.3);
            color: var(--danger);
            padding: 12px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        
        /* Admin View */
        #adminView {
            display: none;
        }
        
        .admin-header {
            background: var(--card-bg);
            border-bottom: 1px solid var(--border);
            padding: 20px 0;
            margin-bottom: 30px;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .logo h1 {
            color: var(--primary);
            font-size: 1.8rem;
        }
        
        .admin-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 25px;
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 240, 255, 0.1);
            border-color: var(--primary);
        }
        
        .stat-icon {
            width: 50px;
            height: 50px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
            font-size: 1.5rem;
        }
        
        .stat-icon.users { background: rgba(0, 240, 255, 0.1); color: var(--primary); }
        .stat-icon.active { background: rgba(0, 255, 136, 0.1); color: var(--success); }
        .stat-icon.funding { background: rgba(255, 204, 0, 0.1); color: var(--warning); }
        .stat-icon.demo { background: rgba(148, 0, 211, 0.1); color: #9400d3; }
        .stat-icon.withdrawals { background: rgba(255, 0, 110, 0.1); color: var(--danger); }
        .stat-icon.deposits { background: rgba(0, 100, 255, 0.1); color: #0064ff; }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }
        
        /* Tabs */
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 10px;
            overflow-x: auto;
        }
        
        .tab {
            padding: 12px 24px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 10px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.3s ease;
            white-space: nowrap;
        }
        
        .tab:hover {
            background: rgba(0, 240, 255, 0.05);
            color: var(--text);
        }
        
        .tab.active {
            background: rgba(0, 240, 255, 0.1);
            border-color: var(--primary);
            color: var(--primary);
        }
        
        /* Tables */
        .table-container {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        thead {
            background: rgba(0, 240, 255, 0.05);
        }
        
        th {
            padding: 15px;
            text-align: left;
            color: var(--primary);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
        }
        
        td {
            padding: 15px;
            border-bottom: 1px solid rgba(226, 250, 252, 0.05);
        }
        
        tbody tr:hover {
            background: rgba(0, 240, 255, 0.02);
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
        }
        
        .badge-pending {
            background: rgba(255, 204, 0, 0.1);
            color: var(--warning);
        }
        
        .badge-approved {
            background: rgba(0, 255, 136, 0.1);
            color: var(--success);
        }
        
        .badge-rejected {
            background: rgba(255, 0, 110, 0.1);
            color: var(--danger);
        }
        
        .action-buttons {
            display: flex;
            gap: 8px;
        }
        
        .action-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .approve-btn {
            background: rgba(0, 255, 136, 0.1);
            color: var(--success);
            border: 1px solid rgba(0, 255, 136, 0.3);
        }
        
        .approve-btn:hover {
            background: rgba(0, 255, 136, 0.2);
        }
        
        .reject-btn {
            background: rgba(255, 0, 110, 0.1);
            color: var(--danger);
            border: 1px solid rgba(255, 0, 110, 0.3);
        }
        
        .reject-btn:hover {
            background: rgba(255, 0, 110, 0.2);
        }
        
        /* Modals */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 16, 0.9);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }
        
        .modal-content {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 20px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 30px;
            position: relative;
            box-shadow: 0 0 50px rgba(0, 240, 255, 0.2);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        
        .modal-header h2 {
            color: var(--primary);
            font-size: 1.5rem;
        }
        
        .close-modal {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 1.5rem;
            cursor: pointer;
            transition: color 0.3s ease;
        }
        
        .close-modal:hover {
            color: var(--danger);
        }
        
        .transaction-details {
            background: rgba(0, 240, 255, 0.05);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 25px;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(226, 250, 252, 0.1);
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            color: var(--text-secondary);
        }
        
        .detail-value {
            font-weight: 500;
        }
        
        .wallet-address {
            font-family: monospace;
            font-size: 0.9rem;
            word-break: break-all;
        }
        
        /* Loading Spinner */
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(0, 240, 255, 0.1);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Toast */
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 1001;
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateX(150%);
            transition: transform 0.3s ease;
        }
        
        .toast-success {
            background: rgba(0, 255, 136, 0.15);
            border: 1px solid rgba(0, 255, 136, 0.3);
            color: var(--success);
        }
        
        .toast-danger {
            background: rgba(255, 0, 110, 0.15);
            border: 1px solid rgba(255, 0, 110, 0.3);
            color: var(--danger);
        }
        
        .toast-warning {
            background: rgba(255, 204, 0, 0.15);
            border: 1px solid rgba(255, 204, 0, 0.3);
            color: var(--warning);
        }
        
        .toast-info {
            background: rgba(0, 240, 255, 0.15);
            border: 1px solid rgba(0, 240, 255, 0.3);
            color: var(--primary);
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
            
            .tabs {
                flex-wrap: wrap;
            }
            
            .table-container {
                overflow-x: auto;
            }
            
            table {
                min-width: 800px;
            }
            
            .modal-content {
                width: 95%;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Login View -->
    <div id="loginView">
        <div class="login-container">
            <div class="login-header">
                <h1><i class="fas fa-quantum-computer"></i> QuantumCoin</h1>
                <p>Admin Control Panel</p>
            </div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" class="form-control" placeholder="Enter admin username" required>
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" class="form-control" placeholder="Enter password" required>
                </div>
                
                <button type="submit" class="btn btn-block">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
                
                <div id="loginError" class="error-message">
                    <i class="fas fa-exclamation-circle"></i> Invalid credentials
                </div>
            </form>
        </div>
    </div>
    
    <!-- Admin View -->
    <div id="adminView">
        <header class="admin-header">
            <div class="container">
                <div class="header-content">
                    <div class="logo">
                        <i class="fas fa-quantum-computer" style="font-size: 2rem; color: var(--primary);"></i>
                        <h1>QuantumCoin Admin</h1>
                    </div>
                    
                    <div class="admin-info">
                        <span id="adminName">Admin</span>
                        <button id="logoutBtn" class="btn">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </button>
                    </div>
                </div>
            </div>
        </header>
        
        <main class="container">
            <!-- Stats Overview -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon users">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-value" id="totalUsers">0</div>
                    <div class="stat-label">Total Users</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon active">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-value" id="activeToday">0</div>
                    <div class="stat-label">Active Today</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon funding">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-value" id="totalFunding">$0</div>
                    <div class="stat-label">Total Funding</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon demo">
                        <i class="fas fa-gamepad"></i>
                    </div>
                    <div class="stat-value" id="totalDemo">$0</div>
                    <div class="stat-label">Total Demo</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon withdrawals">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="stat-value" id="pendingWithdrawals">0</div>
                    <div class="stat-value" id="pendingWithdrawalAmount">$0</div>
                    <div class="stat-label">Pending Withdrawals</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon deposits">
                        <i class="fas fa-credit-card"></i>
                    </div>
                    <div class="stat-value" id="pendingDeposits">0</div>
                    <div class="stat-value" id="pendingDepositAmount">$0</div>
                    <div class="stat-label">Pending Deposits</div>
                </div>
            </div>
            
            <!-- Tabs Navigation -->
            <div class="tabs">
                <button class="tab active" data-tab="withdrawals">
                    <i class="fas fa-wallet"></i> Pending Withdrawals
                </button>
                <button class="tab" data-tab="deposits">
                    <i class="fas fa-credit-card"></i> Pending Deposits
                </button>
                <button class="tab" data-tab="completed">
                    <i class="fas fa-history"></i> Completed Transactions
                </button>
                <button class="tab" data-tab="users">
                    <i class="fas fa-users"></i> All Users
                </button>
            </div>
            
            <!-- Tab Contents -->
            <div id="withdrawalsTab" class="tab-content" style="display: block;">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Amount</th>
                                <th>Network</th>
                                <th>Wallet Address</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="withdrawalsTable">
                            <!-- Data loaded dynamically -->
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">
                                    <div class="loading-spinner"></div>
                                    <div style="margin-top: 10px; color: var(--primary);">Loading pending withdrawals...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="depositsTab" class="tab-content" style="display: none;">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="depositsTable">
                            <!-- Data loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="completedTab" class="tab-content" style="display: none;">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Approved By</th>
                            </tr>
                        </thead>
                        <tbody id="completedTable">
                            <!-- Data loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="usersTab" class="tab-content" style="display: none;">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Balance</th>
                                <th>Joined</th>
                                <th>Last Login</th>
                            </tr>
                        </thead>
                        <tbody id="usersTable">
                            <!-- Data loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>
    
    <!-- Withdrawal Processing Modal -->
    <div id="withdrawalModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-wallet"></i> Process Withdrawal</h2>
                <button id="closeWithdrawalModal" class="close-modal">&times;</button>
            </div>
            
            <div id="withdrawalDetails">
                <!-- Transaction details loaded here -->
            </div>
            
            <div class="form-group">
                <label for="transactionHash">
                    <i class="fas fa-hashtag"></i> Transaction Hash
                </label>
                <input type="text" id="transactionHash" class="form-control" 
                       placeholder="Enter blockchain transaction hash" required>
            </div>
            
            <div class="form-group">
                <label for="adminNotes">
                    <i class="fas fa-sticky-note"></i> Admin Notes
                </label>
                <textarea id="adminNotes" class="form-control" rows="3" 
                          placeholder="Add any notes for this transaction..."></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 25px;">
                <button id="completeWithdrawalBtn" class="btn" style="flex: 1;">
                    <i class="fas fa-check"></i> Mark as Completed
                </button>
                <button id="rejectWithdrawalBtn" class="btn" style="flex: 1; background: var(--danger);">
                    <i class="fas fa-times"></i> Reject Withdrawal
                </button>
            </div>
        </div>
    </div>
    
    <!-- Rejection Confirmation Modal -->
    <div id="rejectModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-exclamation-triangle"></i> Confirm Rejection</h2>
                <button id="closeRejectModal" class="close-modal">&times;</button>
            </div>
            
            <div class="form-group">
                <label for="rejectReason">
                    <i class="fas fa-comment"></i> Rejection Reason
                </label>
                <textarea id="rejectReason" class="form-control" rows="4" 
                          placeholder="Please provide a reason for rejecting this withdrawal..."></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 25px;">
                <button id="confirmRejectBtn" class="btn" style="flex: 1; background: var(--danger);">
                    <i class="fas fa-times"></i> Confirm Rejection
                </button>
                <button id="cancelRejectBtn" class="btn" style="flex: 1;">
                    <i class="fas fa-arrow-left"></i> Cancel
                </button>
            </div>
        </div>
    </div>

    <script>
    // ========== CONFIGURATION ==========
    const API_URL = window.location.origin.includes('localhost') 
        ? 'http://localhost:10000/api' 
        : 'https://quantum-coin-backend.onrender.com/api';

    console.log('QuantumCoin Admin Panel - API URL:', API_URL);

    let adminToken = null;
    let currentTransaction = null;

    // ========== DOM ELEMENTS ==========
    const loginView = document.getElementById('loginView');
    const adminView = document.getElementById('adminView');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const tabs = document.querySelectorAll('.tab');

    // Table bodies
    const withdrawalsTable = document.getElementById('withdrawalsTable');
    const depositsTable = document.getElementById('depositsTable');
    const completedTable = document.getElementById('completedTable');
    const usersTable = document.getElementById('usersTable');

    // Stats elements
    const totalUsers = document.getElementById('totalUsers');
    const activeToday = document.getElementById('activeToday');
    const totalFunding = document.getElementById('totalFunding');
    const totalDemo = document.getElementById('totalDemo');
    const pendingWithdrawals = document.getElementById('pendingWithdrawals');
    const pendingWithdrawalAmount = document.getElementById('pendingWithdrawalAmount');
    const pendingDeposits = document.getElementById('pendingDeposits');
    const pendingDepositAmount = document.getElementById('pendingDepositAmount');

    // Modal elements
    const withdrawalModal = document.getElementById('withdrawalModal');
    const rejectModal = document.getElementById('rejectModal');
    const closeWithdrawalModal = document.getElementById('closeWithdrawalModal');
    const closeRejectModal = document.getElementById('closeRejectModal');
    const withdrawalDetails = document.getElementById('withdrawalDetails');
    const transactionHashInput = document.getElementById('transactionHash');
    const adminNotesInput = document.getElementById('adminNotes');
    const rejectReasonInput = document.getElementById('rejectReason');
    const completeWithdrawalBtn = document.getElementById('completeWithdrawalBtn');
    const rejectWithdrawalBtn = document.getElementById('rejectWithdrawalBtn');
    const confirmRejectBtn = document.getElementById('confirmRejectBtn');
    const cancelRejectBtn = document.getElementById('cancelRejectBtn');

    // ========== INITIALIZATION ==========
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Admin panel initialized');
        
        // Try to get token from localStorage
        adminToken = localStorage.getItem('quantumcoin_admin_token');
        
        if (adminToken) {
            verifyAdminToken();
        } else {
            showLoginView();
        }
        
        setupEventListeners();
        
        // Test API connection
        testAPIConnection();
    });

    async function testAPIConnection() {
        try {
            const response = await fetch(\`\${API_URL}/health\`);
            const data = await response.json();
            console.log('✅ API Connection Test:', data.status);
        } catch (error) {
            console.error('❌ API Connection Failed:', error);
            alert('Warning: Cannot connect to API server. Some features may not work.');
        }
    }

    function setupEventListeners() {
        // Login form
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await loginAdmin();
        });
        
        // Logout
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('quantumcoin_admin_token');
            adminToken = null;
            showLoginView();
            showToast('Logged out successfully', 'info');
        });
        
        // Tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Show corresponding content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                document.getElementById(\`\${tabName}Tab\`).style.display = 'block';
                
                // Load data for this tab
                if (tabName === 'withdrawals') {
                    loadPendingWithdrawals();
                } else if (tabName === 'deposits') {
                    loadPendingDeposits();
                } else if (tabName === 'completed') {
                    loadCompletedTransactions();
                } else if (tabName === 'users') {
                    loadAllUsers();
                }
            });
        });
        
        // Modal close buttons
        closeWithdrawalModal.addEventListener('click', function() {
            withdrawalModal.style.display = 'none';
            resetModalInputs();
        });
        
        closeRejectModal.addEventListener('click', function() {
            rejectModal.style.display = 'none';
            rejectReasonInput.value = '';
        });
        
        // Complete withdrawal
        completeWithdrawalBtn.addEventListener('click', function() {
            completeWithdrawal();
        });
        
        // Open reject modal
        rejectWithdrawalBtn.addEventListener('click', function() {
            rejectModal.style.display = 'flex';
        });
        
        // Confirm rejection
        confirmRejectBtn.addEventListener('click', function() {
            rejectWithdrawal();
        });
        
        // Cancel rejection
        cancelRejectBtn.addEventListener('click', function() {
            rejectModal.style.display = 'none';
            rejectReasonInput.value = '';
        });
        
        // Close modals on outside click
        window.addEventListener('click', function(e) {
            if (e.target === withdrawalModal) {
                withdrawalModal.style.display = 'none';
                resetModalInputs();
            }
            if (e.target === rejectModal) {
                rejectModal.style.display = 'none';
                rejectReasonInput.value = '';
            }
        });
        
        // Enter key to submit in modals
        transactionHashInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                completeWithdrawal();
            }
        });
    }

    function resetModalInputs() {
        transactionHashInput.value = '';
        adminNotesInput.value = '';
        rejectReasonInput.value = '';
    }

    // ========== API HELPER FUNCTIONS ==========
    async function apiRequest(endpoint, options = {}) {
        const url = \`\${API_URL}\${endpoint}\`;
        console.log(\`🔗 API Request: \${options.method || 'GET'} \${url}\`);
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (adminToken) {
            headers['Authorization'] = \`Bearer \${adminToken}\`;
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers,
                mode: 'cors',
                credentials: 'include'
            });
            
            console.log(\`📥 Response Status: \${response.status} \${response.statusText}\`);
            
            if (response.status === 401) {
                localStorage.removeItem('quantumcoin_admin_token');
                adminToken = null;
                showLoginView();
                showToast('Session expired. Please login again.', 'warning');
                return null;
            }
            
            if (response.status === 403) {
                showToast('Access denied. Admin privileges required.', 'danger');
                return null;
            }
            
            if (!response.ok && response.status !== 404) {
                throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }
            
            // Check if response has content
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || data.message || \`Request failed with status \${response.status}\`);
                }
                
                return data;
            } else {
                // Handle non-JSON responses
                const text = await response.text();
                if (!response.ok) {
                    throw new Error(text || \`Request failed with status \${response.status}\`);
                }
                return { success: true, message: text };
            }
        } catch (error) {
            console.error('❌ API Request Failed:', error);
            
            // Don't show alert for network errors to avoid spam
            if (!error.message.includes('Failed to fetch')) {
                showError(error.message);
            }
            
            return null;
        }
    }

    // ========== AUTHENTICATION FUNCTIONS ==========
    async function verifyAdminToken() {
        showLoading('Verifying admin session...');
        
        try {
            const result = await apiRequest('/admin/dashboard');
            if (result) {
                showAdminView();
                loadDashboardStats();
                loadPendingWithdrawals();
                showToast('Admin session verified', 'success');
            } else {
                showLoginView();
            }
        } catch (error) {
            console.error('❌ Token verification failed:', error);
            showLoginView();
        } finally {
            hideLoading();
        }
    }

    async function loginAdmin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            showLoginError('Please enter both username and password');
            return;
        }
        
        loginError.style.display = 'none';
        showLoading('Logging in...');
        
        try {
            const response = await fetch(\`\${API_URL}/admin/login\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                adminToken = data.token;
                localStorage.setItem('quantumcoin_admin_token', adminToken);
                showAdminView();
                loadDashboardStats();
                loadPendingWithdrawals();
                showToast('Login successful!', 'success');
            } else {
                throw new Error(data?.error || 'Invalid username or password');
            }
        } catch (error) {
            showLoginError(error.message || 'Login failed. Please check credentials.');
            console.error('❌ Login error:', error);
        } finally {
            hideLoading();
        }
    }

    function showLoginError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    function showLoginView() {
        loginView.style.display = 'block';
        adminView.style.display = 'none';
        loginError.style.display = 'none';
    }

    function showAdminView() {
        loginView.style.display = 'none';
        adminView.style.display = 'block';
    }

    // ========== DASHBOARD FUNCTIONS ==========
    async function loadDashboardStats() {
        try {
            const stats = await apiRequest('/admin/dashboard');
            if (stats) {
                totalUsers.textContent = stats.total_users || 0;
                activeToday.textContent = stats.active_today || 0;
                totalFunding.textContent = \`\$\{(stats.total_funding || 0).toFixed(2)}\`;
                totalDemo.textContent = \`\$\{(stats.total_demo || 0).toFixed(2)}\`;
                pendingWithdrawals.textContent = stats.pending_withdrawals || 0;
                pendingWithdrawalAmount.textContent = \`\$\{(stats.pending_withdrawal_amount || 0).toFixed(2)}\`;
                pendingDeposits.textContent = stats.pending_deposits || 0;
                pendingDepositAmount.textContent = \`\$\{(stats.pending_deposit_amount || 0).toFixed(2)}\`;
                
                console.log('📊 Dashboard stats loaded');
            }
        } catch (error) {
            console.error('❌ Failed to load dashboard stats:', error);
        }
    }

    // ========== WITHDRAWAL FUNCTIONS ==========
    async function loadPendingWithdrawals() {
        try {
            withdrawalsTable.innerHTML = \`
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <div class="loading-spinner"></div>
                        <div style="margin-top: 10px; color: var(--primary);">Loading pending withdrawals...</div>
                    </td>
                </tr>
            \`;
            
            const withdrawals = await apiRequest('/admin/withdrawals/pending');
            
            if (!withdrawals || withdrawals.length === 0) {
                withdrawalsTable.innerHTML = \`
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px; color: rgba(226, 250, 252, 0.5);">
                            <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--success); margin-bottom: 10px;"></i>
                            <div>No pending withdrawals</div>
                            <div style="font-size: 0.9rem; margin-top: 5px;">All withdrawals have been processed</div>
                        </td>
                    </tr>
                \`;
                return;
            }
            
            withdrawalsTable.innerHTML = '';
            
            withdrawals.forEach(withdrawal => {
                const row = document.createElement('tr');
                const date = new Date(withdrawal.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const walletAddress = withdrawal.wallet_address || 'N/A';
                const walletShort = walletAddress.length > 15 
                    ? \`\${walletAddress.substring(0, 12)}...\${walletAddress.substring(walletAddress.length - 3)}\` 
                    : walletAddress;
                
                row.innerHTML = \`
                    <td>#\${withdrawal.id}</td>
                    <td>
                        <strong>\${withdrawal.username}</strong><br>
                        <small style="color: rgba(226, 250, 252, 0.6);">\${withdrawal.email || ''}</small>
                    </td>
                    <td><strong style="color: var(--primary);">\$\${withdrawal.amount?.toFixed(2) || '0.00'}</strong></td>
                    <td><span class="badge" style="background: rgba(0, 240, 255, 0.1); color: var(--primary);">\${withdrawal.network || 'N/A'}</span></td>
                    <td title="\${walletAddress}">
                        <div style="font-family: monospace; font-size: 0.85rem;">\${walletShort}</div>
                    </td>
                    <td>\${date}</td>
                    <td><span class="badge badge-pending"><i class="fas fa-clock"></i> Pending</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn approve-btn" 
                                    onclick="openWithdrawalModal(\${withdrawal.id})">
                                <i class="fas fa-check"></i> Process
                            </button>
                        </div>
                    </td>
                \`;
                withdrawalsTable.appendChild(row);
            });
            
            console.log(\`✅ Loaded \${withdrawals.length} pending withdrawals\`);
        } catch (error) {
            console.error('❌ Failed to load withdrawals:', error);
            withdrawalsTable.innerHTML = \`
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <div>Error loading withdrawals</div>
                        <div style="font-size: 0.9rem; margin-top: 5px;">\${error.message || 'Please try again'}</div>
                    </td>
                </tr>
            \`;
        }
    }

    async function openWithdrawalModal(id) {
        try {
            showLoading('Loading withdrawal details...');
            
            const withdrawal = await apiRequest(\`/admin/withdrawals/\${id}\`);
            if (withdrawal) {
                currentTransaction = withdrawal;
                
                const date = new Date(withdrawal.created_at).toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const fees = withdrawal.fees || 0;
                const netAmount = withdrawal.amount - fees;
                
                withdrawalDetails.innerHTML = \`
                    <div class="transaction-details">
                        <div class="detail-row">
                            <div class="detail-label">Transaction ID:</div>
                            <div class="detail-value">#\${withdrawal.id}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">User:</div>
                            <div class="detail-value">\${withdrawal.username} (\${withdrawal.email || 'No email'})</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Amount:</div>
                            <div class="detail-value" style="color: var(--primary); font-weight: bold;">\$\${withdrawal.amount?.toFixed(2) || '0.00'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Network Fee:</div>
                            <div class="detail-value">\$\${fees.toFixed(2)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Net Amount:</div>
                            <div class="detail-value" style="color: var(--success);">\$\${netAmount.toFixed(2)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Network:</div>
                            <div class="detail-value">\${withdrawal.network || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Wallet Address:</div>
                            <div class="detail-value wallet-address">\${withdrawal.wallet_address || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Date:</div>
                            <div class="detail-value">\${date}</div>
                        </div>
                    </div>
                \`;
                
                transactionHashInput.value = '';
                adminNotesInput.value = '';
                withdrawalModal.style.display = 'flex';
                
                console.log(\`✅ Loaded withdrawal #\${id} details\`);
            }
        } catch (error) {
            console.error('❌ Failed to load withdrawal details:', error);
            showError('Failed to load withdrawal details: ' + (error.message || 'Unknown error'));
        } finally {
            hideLoading();
        }
    }

    async function completeWithdrawal() {
        if (!currentTransaction) {
            showError('No withdrawal selected');
            return;
        }
        
        const transactionHash = transactionHashInput.value.trim();
        const notes = adminNotesInput.value.trim();
        
        if (!transactionHash) {
            showError('Please enter the transaction hash');
            transactionHashInput.focus();
            return;
        }
        
        if (!confirm(\`Confirm: Mark withdrawal #\${currentTransaction.id} as completed?\`)) {
            return;
        }
        
        showLoading('Completing withdrawal...');
        
        try {
            const result = await apiRequest(\`/admin/withdrawals/\${currentTransaction.id}/complete\`, {
                method: 'POST',
                body: JSON.stringify({ 
                    transaction_hash: transactionHash,
                    notes: notes || 'Withdrawal completed by admin'
                })
            });
            
            if (result && result.success) {
                withdrawalModal.style.display = 'none';
                resetModalInputs();
                
                showToast(\`✅ Withdrawal #\${currentTransaction.id} marked as completed\`, 'success');
                
                // Refresh data
                loadDashboardStats();
                loadPendingWithdrawals();
                loadCompletedTransactions();
                
                console.log(\`✅ Completed withdrawal #\${currentTransaction.id}\`);
            }
        } catch (error) {
            console.error('❌ Failed to complete withdrawal:', error);
            showError('Failed to complete withdrawal: ' + (error.message || 'Unknown error'));
        } finally {
            hideLoading();
        }
    }

    async function rejectWithdrawal() {
        if (!currentTransaction) {
            showError('No withdrawal selected');
            return;
        }
        
        const reason = rejectReasonInput.value.trim() || 'Withdrawal rejected by admin';
        
        if (!confirm(\`Reject withdrawal #\${currentTransaction.id} and return funds to user?\`)) {
            return;
        }
        
        showLoading('Rejecting withdrawal...');
        
        try {
            const result = await apiRequest(\`/admin/withdrawals/\${currentTransaction.id}/reject\`, {
                method: 'POST',
                body: JSON.stringify({ notes: reason })
            });
            
            if (result && result.success) {
                withdrawalModal.style.display = 'none';
                rejectModal.style.display = 'none';
                resetModalInputs();
                
                showToast(\`❌ Withdrawal #\${currentTransaction.id} rejected\`, 'warning');
                
                // Refresh data
                loadDashboardStats();
                loadPendingWithdrawals();
                loadCompletedTransactions();
                
                console.log(\`❌ Rejected withdrawal #\${currentTransaction.id}\`);
            }
        } catch (error) {
            console.error('❌ Failed to reject withdrawal:', error);
            showError('Failed to reject withdrawal: ' + (error.message || 'Unknown error'));
        } finally {
            hideLoading();
        }
    }

    // ========== DEPOSIT FUNCTIONS ==========
    async function loadPendingDeposits() {
        try {
            depositsTable.innerHTML = \`
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <div class="loading-spinner"></div>
                        <div style="margin-top: 10px; color: var(--primary);">Loading pending deposits...</div>
                    </td>
                </tr>
            \`;
            
            const deposits = await apiRequest('/admin/transactions/pending');
            
            if (!deposits || deposits.length === 0) {
                depositsTable.innerHTML = \`
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: rgba(226, 250, 252, 0.5);">
                            <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--success); margin-bottom: 10px;"></i>
                            <div>No pending deposits</div>
                        </td>
                    </tr>
                \`;
                return;
            }
            
            depositsTable.innerHTML = '';
            
            // Filter for deposit transactions only
            const depositTransactions = deposits.filter(t => t.type === 'deposit');
            
            if (depositTransactions.length === 0) {
                depositsTable.innerHTML = \`
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: rgba(226, 250, 252, 0.5);">
                            No pending deposits
                        </td>
                    </tr>
                \`;
                return;
            }
            
            depositTransactions.forEach(deposit => {
                const row = document.createElement('tr');
                const date = new Date(deposit.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                const bonus = deposit.amount >= 1000 ? deposit.amount * 0.05 : 0;
                
                row.innerHTML = \`
                    <td>#\${deposit.id}</td>
                    <td>
                        <strong>\${deposit.username}</strong><br>
                        <small style="color: rgba(226, 250, 252, 0.6);">\${deposit.email || ''}</small>
                    </td>
                    <td>
                        <strong style="color: var(--primary);">\$\${deposit.amount?.toFixed(2) || '0.00'}</strong>
                        \${bonus > 0 ? \`<br><small style="color: var(--success);">+ \$\${bonus.toFixed(2)} bonus</small>\` : ''}
                    </td>
                    <td>\${date}</td>
                    <td><span class="badge badge-pending"><i class="fas fa-clock"></i> Pending</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn approve-btn" 
                                    onclick="approveDeposit(\${deposit.id})">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="action-btn reject-btn" 
                                    onclick="rejectDeposit(\${deposit.id})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </td>
                \`;
                depositsTable.appendChild(row);
            });
            
            console.log(\`✅ Loaded \${depositTransactions.length} pending deposits\`);
        } catch (error) {
            console.error('❌ Failed to load deposits:', error);
            depositsTable.innerHTML = \`
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i> Error loading deposits
                    </td>
                </tr>
            \`;
        }
    }

    async function approveDeposit(id) {
        if (!confirm('Approve this deposit and credit funds to user?')) {
            return;
        }
        
        showLoading('Approving deposit...');
        
        try {
            const result = await apiRequest(\`/admin/transactions/\${id}/approve\`, {
                method: 'POST',
                body: JSON.stringify({ 
                    notes: 'Deposit approved by admin',
                    action: 'approve'
                })
            });
            
            if (result && result.success) {
                showToast(\`✅ Deposit #\${id} approved\`, 'success');
                
                // Refresh data
                loadDashboardStats();
                loadPendingDeposits();
                loadCompletedTransactions();
                
                console.log(\`✅ Approved deposit #\${id}\`);
            }
        } catch (error) {
            console.error('❌ Failed to approve deposit:', error);
            showError('Failed to approve deposit: ' + (error.message || 'Unknown error'));
        } finally {
            hideLoading();
        }
    }

    async function rejectDeposit(id) {
        const reason = prompt('Enter rejection reason (optional):', 'Deposit rejected by admin');
        
        if (reason === null) {
            return; // User cancelled
        }
        
        if (!confirm('Reject this deposit?')) {
            return;
        }
        
        showLoading('Rejecting deposit...');
        
        try {
            const result = await apiRequest(\`/admin/transactions/\${id}/reject\`, {
                method: 'POST',
                body: JSON.stringify({ 
                    notes: reason || 'Deposit rejected by admin',
                    action: 'reject'
                })
            });
            
            if (result && result.success) {
                showToast(\`❌ Deposit #\${id} rejected\`, 'warning');
                
                // Refresh data
                loadDashboardStats();
                loadPendingDeposits();
                loadCompletedTransactions();
                
                console.log(\`❌ Rejected deposit #\${id}\`);
            }
        } catch (error) {
            console.error('❌ Failed to reject deposit:', error);
            showError('Failed to reject deposit: ' + (error.message || 'Unknown error'));
        } finally {
            hideLoading();
        }
    }

    // ========== TRANSACTION FUNCTIONS ==========
    async function loadCompletedTransactions() {
        try {
            completedTable.innerHTML = \`
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <div class="loading-spinner"></div>
                        <div style="margin-top: 10px; color: var(--primary);">Loading transactions...</div>
                    </td>
                </tr>
            \`;
            
            const transactions = await apiRequest('/admin/transactions');
            
            if (!transactions || transactions.length === 0) {
                completedTable.innerHTML = \`
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: rgba(226, 250, 252, 0.5);">
                            No completed transactions
                        </td>
                    </tr>
                \`;
                return;
            }
            
            completedTable.innerHTML = '';
            
            transactions.forEach(transaction => {
                const row = document.createElement('tr');
                const date = new Date(transaction.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                const typeText = transaction.type === 'deposit' ? 'Deposit' : 
                               transaction.type === 'withdrawal' ? 'Withdrawal' : 
                               transaction.type === 'buy' ? 'Buy Trade' : 
                               transaction.type === 'sell' ? 'Sell Trade' : transaction.type;
                
                const statusClass = transaction.status === 'completed' ? 'badge-approved' : 
                                  transaction.status === 'rejected' ? 'badge-rejected' : 'badge-warning';
                
                const statusText = transaction.status === 'completed' ? 'Completed' : 
                                 transaction.status === 'rejected' ? 'Rejected' : 
                                 transaction.status === 'pending' ? 'Pending' : transaction.status;
                
                row.innerHTML = \`
                    <td>#\${transaction.id}</td>
                    <td>
                        <strong>\${transaction.username}</strong><br>
                        <small style="color: rgba(226, 250, 252, 0.6);">\${transaction.email || ''}</small>
                    </td>
                    <td>\${typeText}</td>
                    <td>
                        <strong style="color: \${transaction.type === 'deposit' ? 'var(--success)' : 'var(--primary)'};">\$\${transaction.amount?.toFixed(2) || '0.00'}</strong>
                        \${transaction.bonus > 0 ? \`<br><small style="color: var(--success);">+ \$\${transaction.bonus.toFixed(2)} bonus</small>\` : ''}
                    </td>
                    <td>\${date}</td>
                    <td><span class="badge \${statusClass}">\${statusText}</span></td>
                    <td>\${transaction.admin_username || 'System'}</td>
                \`;
                completedTable.appendChild(row);
            });
            
            console.log(\`✅ Loaded \${transactions.length} completed transactions\`);
        } catch (error) {
            console.error('❌ Failed to load completed transactions:', error);
            completedTable.innerHTML = \`
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i> Error loading transactions
                    </td>
                </tr>
            \`;
        }
    }

    // ========== USER FUNCTIONS ==========
    async function loadAllUsers() {
        try {
            usersTable.innerHTML = \`
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <div class="loading-spinner"></div>
                        <div style="margin-top: 10px; color: var(--primary);">Loading users...</div>
                    </td>
                </tr>
            \`;
            
            const users = await apiRequest('/admin/users');
            
            if (!users || users.length === 0) {
                usersTable.innerHTML = \`
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: rgba(226, 250, 252, 0.5);">
                            No users found
                        </td>
                    </tr>
                \`;
                return;
            }
            
            usersTable.innerHTML = '';
            
            users.forEach(user => {
                const row = document.createElement('tr');
                const joinDate = new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                const lastLogin = user.last_login 
                    ? new Date(user.last_login).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Never';
                
                const totalBalance = (user.funding_balance || 0) + (user.demo_balance || 0);
                
                row.innerHTML = \`
                    <td>#\${user.id}</td>
                    <td>
                        <strong>\${user.username}</strong><br>
                        <small style="color: rgba(226, 250, 252, 0.6);">\${user.email || 'No email'}</small>
                    </td>
                    <td>\${user.email || 'N/A'}</td>
                    <td>
                        <div style="margin-bottom: 4px;">
                            <span style="color: var(--primary); font-weight: bold;">\$\${(user.funding_balance || 0).toFixed(2)}</span> funding
                        </div>
                        <div>
                            <span style="color: rgba(226, 250, 252, 0.7);">\$\${(user.demo_balance || 0).toFixed(2)}</span> demo
                        </div>
                        <div style="margin-top: 4px; border-top: 1px solid rgba(226, 250, 252, 0.1); padding-top: 4px;">
                            <strong>Total: \$\${totalBalance.toFixed(2)}</strong>
                        </div>
                    </td>
                    <td>\${joinDate}</td>
                    <td>
                        \${lastLogin === 'Never' 
                            ? '<span style="color: rgba(226, 250, 252, 0.5);">Never</span>' 
                            : \`<div>\${lastLogin}</div>\`
                        }
                    </td>
                \`;
                usersTable.appendChild(row);
            });
            
            console.log(\`✅ Loaded \${users.length} users\`);
        } catch (error) {
            console.error('❌ Failed to load users:', error);
            usersTable.innerHTML = \`
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i> Error loading users
                    </td>
                </tr>
            \`;
        }
    }

    // ========== UI HELPER FUNCTIONS ==========
    function showLoading(message = 'Loading...') {
        // Create or update loading overlay
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.style.cssText = \`
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(5, 5, 16, 0.9);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(5px);
            \`;
            
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.cssText = 'width: 60px; height: 60px; border-width: 4px;';
            
            const text = document.createElement('div');
            text.id = 'loadingText';
            text.style.cssText = \`
                margin-top: 20px;
                color: var(--primary);
                font-size: 1.1rem;
                font-weight: 500;
            \`;
            text.textContent = message;
            
            loadingOverlay.appendChild(spinner);
            loadingOverlay.appendChild(text);
            document.body.appendChild(loadingOverlay);
        } else {
            document.getElementById('loadingText').textContent = message;
            loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    function showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = \`toast toast-\${type}\`;
        toast.style.cssText = \`
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            background: \${type === 'success' ? 'rgba(0, 255, 136, 0.15)' : 
                        type === 'danger' ? 'rgba(255, 0, 110, 0.15)' : 
                        type === 'warning' ? 'rgba(255, 204, 0, 0.15)' : 
                        'rgba(0, 240, 255, 0.15)'};
            border: 1px solid \${type === 'success' ? 'rgba(0, 255, 136, 0.3)' : 
                        type === 'danger' ? 'rgba(255, 0, 110, 0.3)' : 
                        type === 'warning' ? 'rgba(255, 204, 0, 0.3)' : 
                        'rgba(0, 240, 255, 0.3)'};
            color: \${type === 'success' ? 'var(--success)' : 
                    type === 'danger' ? 'var(--danger)' : 
                    type === 'warning' ? 'var(--warning)' : 
                    'var(--primary)'};
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            backdrop-filter: blur(10px);
            transform: translateX(150%);
            transition: transform 0.3s ease;
            max-width: 400px;
            word-break: break-word;
        \`;
        
        const icon = type === 'success' ? '✓' :
                     type === 'danger' ? '✗' :
                     type === 'warning' ? '⚠' : 'ℹ';
        
        toast.innerHTML = \`
            <span style="font-size: 1.2rem; font-weight: bold;">\${icon}</span>
            <span>\${message}</span>
        \`;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.transform = 'translateX(150%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    function showError(message) {
        showToast(message, 'danger');
    }

    // ========== GLOBAL FUNCTION EXPORTS ==========
    // Make functions available globally for onclick handlers
    window.openWithdrawalModal = openWithdrawalModal;
    window.approveDeposit = approveDeposit;
    window.rejectDeposit = rejectDeposit;
    </script>
</body>
</html>
  `);
});

// ========== WEB SOCKET ==========
app.set('socketio', io);

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });
  
  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('Admin joined admin room');
  });
  
  socket.on('subscribe', (data) => {
    if (data.userId) {
      socket.join(`user_${data.userId}`);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ========== ERROR HANDLING ==========
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    available_endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        google_login: 'POST /api/auth/google',
        register: 'POST /api/auth/register',
        logout: 'POST /api/auth/logout',
        admin_login: 'POST /api/admin/login'
      },
      admin: {
        stats: 'GET /api/admin/dashboard (Admin)',
        users: 'GET /api/admin/users (Admin)',
        withdrawals: {
          pending: 'GET /api/admin/withdrawals/pending (Admin)',
          detail: 'GET /api/admin/withdrawals/:id (Admin)',
          complete: 'POST /api/admin/withdrawals/:id/complete (Admin)',
          reject: 'POST /api/admin/withdrawals/:id/reject (Admin)'
        }
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// ========== INITIALIZE AND START SERVER ==========
initDatabase();

// Clean up old sessions every hour
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > oneDay) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 QuantumCoin API with Admin Panel running on port ${PORT}`);
  console.log(`🔗 API available at: http://localhost:${PORT}/api`);
  console.log(`🌐 Admin Panel available at: http://localhost:${PORT}/admin`);
  console.log(`✅ Google OAuth enabled with Client ID: ${GOOGLE_CLIENT_ID}`);
  console.log(`👑 Admin login: admin / admin123`);
  console.log(`👤 User login: testuser / password123`);
  console.log(`🔐 Available authentication methods:`);
  console.log(`   • Email/Password login`);
  console.log(`   • Google OAuth login`);
  console.log(`   • User registration`);
  console.log(`💸 Admin Panel Features:`);
  console.log(`   • Complete withdrawal management`);
  console.log(`   • Deposit approval system`);
  console.log(`   • User management`);
  console.log(`   • Real-time notifications`);
  console.log(`   • Dashboard statistics`);
});

// Export the server for use in other files if needed
module.exports = { app, server };
