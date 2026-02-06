const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Get JWT secrets from environment or generate them
const JWT_SECRET = process.env.JWT_SECRET || generateSecret();
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || generateSecret();

// Log startup info
console.log('🔐 Security Mode: ' + (process.env.JWT_SECRET ? 'Using .env secrets' : 'Using generated secrets'));

// Generate random secret if not provided
function generateSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Database initialization
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

// Database helper functions
const dbAsync = {
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, function(err, row) {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, function(err, rows) {
        if (err) reject(err);
        else resolve(rows || []);
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

// Initialize Database Schema
function initDatabase() {
  const schemas = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      funding_balance REAL DEFAULT 0,
      demo_balance REAL DEFAULT 5000,
      crypto_holdings TEXT DEFAULT '{}',
      trade_history TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`,

    // Admin users table
    `CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`,

    // Transactions table
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      network TEXT,
      wallet_address TEXT,
      tx_hash TEXT,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_by INTEGER,
      completed_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(completed_by) REFERENCES admin_users(id)
    )`,

    // Withdrawals table
    `CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      withdrawal_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      amount REAL NOT NULL,
      network TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      processing_fee REAL DEFAULT 0,
      network_fee REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      tx_hash TEXT,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_by INTEGER,
      completed_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(completed_by) REFERENCES admin_users(id)
    )`,

    // Notifications table
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,

    // Price history table
    `CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      change_24h REAL DEFAULT 0,
      change_percent REAL DEFAULT 0,
      market_cap REAL DEFAULT 0,
      volume_24h REAL DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  schemas.forEach(schema => {
    db.run(schema, (err) => {
      if (err) console.error('❌ Schema creation error:', err);
    });
  });

  // Create default admin user
  const defaultAdminPassword = bcrypt.hashSync('admin123', 10);
  db.run(
    `INSERT OR IGNORE INTO admin_users (username, password, email, role) VALUES (?, ?, ?, ?)`,
    ['admin', defaultAdminPassword, 'admin@quantumcoin.com', 'admin'],
    (err) => {
      if (err) console.error('❌ Admin creation error:', err);
      else console.log('✅ Admin user initialized (username: admin, password: admin123)');
    }
  );

  // Create sample user
  const sampleUserPassword = bcrypt.hashSync('password123', 10);
  db.run(
    `INSERT OR IGNORE INTO users (username, email, password, funding_balance, demo_balance) 
     VALUES (?, ?, ?, ?, ?)`,
    ['testuser', 'test@quantumcoin.com', sampleUserPassword, 1000, 5000],
    (err) => {
      if (err) console.error('❌ User creation error:', err);
      else console.log('✅ Sample user initialized (username: testuser, password: password123)');
    }
  );
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Admin Authentication Middleware
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  jwt.verify(token, ADMIN_JWT_SECRET, (err, admin) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired admin token' });
    }
    req.admin = admin;
    next();
  });
}

// ==================== USER AUTHENTICATION ====================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    await dbAsync.run(
      `INSERT INTO users (username, email, password, demo_balance) VALUES (?, ?, ?, ?)`,
      [username, email, hashedPassword, 5000]
    );

    const user = await dbAsync.get('SELECT id, username, email FROM users WHERE username = ?', [username]);

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: 0,
        demo_balance: 5000
      }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await dbAsync.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login
    await dbAsync.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
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
    res.status(500).json({ error: error.message });
  }
});

// Get User Profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await dbAsync.get('SELECT id, username, email, funding_balance, demo_balance, created_at, last_login FROM users WHERE id = ?', [req.user.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEPOSITS ====================

// Create Deposit Request
app.post('/api/transactions/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit amount is $10' });
    }

    if (amount > 100000) {
      return res.status(400).json({ error: 'Maximum deposit amount is $100,000' });
    }

    const transactionId = `DEP-${Date.now()}-${uuidv4().slice(0, 8)}`;

    await dbAsync.run(
      `INSERT INTO transactions (transaction_id, user_id, username, type, amount, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [transactionId, req.user.id, req.user.username, 'deposit', amount, 'pending']
    );

    // Create notification
    await createNotification(
      req.user.id,
      'deposit_pending',
      'Deposit Request Submitted',
      `Your deposit request for $${amount.toFixed(2)} has been submitted for review.`,
      { amount, transactionId }
    );

    res.status(201).json({
      message: 'Deposit request submitted successfully',
      transactionId,
      amount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Deposit History
app.get('/api/transactions/deposits', authenticateToken, async (req, res) => {
  try {
    const deposits = await dbAsync.all(
      `SELECT * FROM transactions WHERE user_id = ? AND type = 'deposit' ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== WITHDRAWALS ====================

// Create Withdrawal Request
app.post('/api/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount, network, wallet_address } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is $10' });
    }

    if (!network || !wallet_address) {
      return res.status(400).json({ error: 'Network and wallet address required' });
    }

    const user = await dbAsync.get('SELECT funding_balance FROM users WHERE id = ?', [req.user.id]);

    if (user.funding_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const withdrawalId = `WTH-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const processingFee = amount * 0.01;
    const networkFees = { 'BTC': 3, 'ETH': 8, 'USDT': 1 };
    const networkFee = networkFees[network] || 3;

    await dbAsync.run(
      `INSERT INTO withdrawals 
       (withdrawal_id, user_id, username, amount, network, wallet_address, processing_fee, network_fee, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [withdrawalId, req.user.id, req.user.username, amount, network, wallet_address, processingFee, networkFee, 'pending']
    );

    // Create notification
    await createNotification(
      req.user.id,
      'withdrawal_pending',
      'Withdrawal Request Submitted',
      `Your withdrawal request for $${amount.toFixed(2)} to ${network} has been submitted for review.`,
      { amount, network, withdrawalId }
    );

    res.status(201).json({
      message: 'Withdrawal request submitted successfully',
      transactionId: withdrawalId,
      amount,
      network,
      wallet: wallet_address
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Withdrawal History
app.get('/api/withdrawals', authenticateToken, async (req, res) => {
  try {
    const withdrawals = await dbAsync.all(
      `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN AUTHENTICATION ====================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = await dbAsync.get('SELECT * FROM admin_users WHERE username = ?', [username]);

    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Update last login
    await dbAsync.run('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      ADMIN_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful',
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN DASHBOARD ====================

// Get Admin Dashboard Stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await dbAsync.get('SELECT COUNT(*) as count FROM users');
    const totalFunding = await dbAsync.get('SELECT SUM(funding_balance) as total FROM users');
    const totalDemo = await dbAsync.get('SELECT SUM(demo_balance) as total FROM users');
    const pendingWithdrawals = await dbAsync.get('SELECT COUNT(*) as count FROM withdrawals WHERE status = "pending"');
    const pendingWithdrawalAmount = await dbAsync.get('SELECT SUM(amount) as total FROM withdrawals WHERE status = "pending"');
    const pendingDeposits = await dbAsync.get('SELECT COUNT(*) as count FROM transactions WHERE type = "deposit" AND status = "pending"');
    const pendingDepositAmount = await dbAsync.get('SELECT SUM(amount) as total FROM transactions WHERE type = "deposit" AND status = "pending"');
    const activeToday = await dbAsync.get('SELECT COUNT(*) as count FROM users WHERE last_login >= datetime("now", "-1 day")');

    res.json({
      total_users: totalUsers.count || 0,
      total_funding: totalFunding.total || 0,
      total_demo: totalDemo.total || 0,
      pending_withdrawals: pendingWithdrawals.count || 0,
      pending_withdrawal_amount: pendingWithdrawalAmount.total || 0,
      pending_deposits: pendingDeposits.count || 0,
      pending_deposit_amount: pendingDepositAmount.total || 0,
      active_today: activeToday.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN WITHDRAWALS ====================

// Get Pending Withdrawals
app.get('/api/admin/withdrawals/pending', authenticateAdmin, async (req, res) => {
  try {
    const withdrawals = await dbAsync.all(
      `SELECT * FROM withdrawals WHERE status = 'pending' ORDER BY created_at DESC`
    );

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Withdrawals (Completed)
app.get('/api/admin/withdrawals', authenticateAdmin, async (req, res) => {
  try {
    const withdrawals = await dbAsync.all(
      `SELECT w.*, 
              a.username as admin_username 
       FROM withdrawals w 
       LEFT JOIN admin_users a ON w.completed_by = a.id 
       WHERE w.status IN ('completed', 'rejected') 
       ORDER BY w.updated_at DESC`
    );

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve Withdrawal
app.post('/api/admin/withdrawals/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { tx_hash, admin_notes } = req.body;
    const withdrawalId = req.params.id;

    if (!tx_hash) {
      return res.status(400).json({ error: 'Transaction hash required' });
    }

    const withdrawal = await dbAsync.get('SELECT * FROM withdrawals WHERE id = ?', [withdrawalId]);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending withdrawals can be approved' });
    }

    // Update withdrawal status
    await dbAsync.run(
      `UPDATE withdrawals SET status = 'completed', tx_hash = ?, admin_notes = ?, completed_by = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [tx_hash, admin_notes || '', req.admin.id, withdrawalId]
    );

    // Deduct from user balance
    await dbAsync.run(
      `UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?`,
      [withdrawal.amount, withdrawal.user_id]
    );

    // Create notification for user
    await createNotification(
      withdrawal.user_id,
      'withdrawal_approved',
      'Withdrawal Approved',
      `Your withdrawal of $${withdrawal.amount.toFixed(2)} to ${withdrawal.network} has been approved and sent. Transaction: ${tx_hash}`,
      { amount: withdrawal.amount, tx_hash, network: withdrawal.network }
    );

    res.json({ message: 'Withdrawal approved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject Withdrawal
app.post('/api/admin/withdrawals/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const withdrawalId = req.params.id;

    const withdrawal = await dbAsync.get('SELECT * FROM withdrawals WHERE id = ?', [withdrawalId]);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending withdrawals can be rejected' });
    }

    // Update withdrawal status
    await dbAsync.run(
      `UPDATE withdrawals SET status = 'rejected', admin_notes = ?, completed_by = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [reason || 'No reason provided', req.admin.id, withdrawalId]
    );

    // Create notification for user
    await createNotification(
      withdrawal.user_id,
      'withdrawal_rejected',
      'Withdrawal Rejected',
      `Your withdrawal request of $${withdrawal.amount.toFixed(2)} has been rejected. Reason: ${reason || 'No reason provided'}. Funds have been returned to your account.`,
      { amount: withdrawal.amount, reason }
    );

    res.json({ message: 'Withdrawal rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN DEPOSITS ====================

// Get Pending Deposits
app.get('/api/admin/transactions/pending', authenticateAdmin, async (req, res) => {
  try {
    const deposits = await dbAsync.all(
      `SELECT * FROM transactions WHERE type = 'deposit' AND status = 'pending' ORDER BY created_at DESC`
    );

    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve Deposit
app.post('/api/admin/transactions/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { admin_notes } = req.body;

    const transaction = await dbAsync.get('SELECT * FROM transactions WHERE id = ?', [transactionId]);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be approved' });
    }

    // Calculate bonus
    const bonus = transaction.amount >= 1000 ? transaction.amount * 0.05 : 0;
    const totalAmount = transaction.amount + bonus;

    // Update transaction status
    await dbAsync.run(
      `UPDATE transactions SET status = 'completed', admin_notes = ?, completed_by = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [admin_notes || '', req.admin.id, transactionId]
    );

    // Add funds to user balance
    await dbAsync.run(
      `UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?`,
      [totalAmount, transaction.user_id]
    );

    // Create notification for user
    const bonusText = bonus > 0 ? ` (includes $${bonus.toFixed(2)} bonus)` : '';
    await createNotification(
      transaction.user_id,
      'deposit_approved',
      'Deposit Approved',
      `Your deposit of $${transaction.amount.toFixed(2)} has been approved. Total added: $${totalAmount.toFixed(2)}${bonusText}`,
      { amount: transaction.amount, bonus, totalAmount }
    );

    res.json({ message: 'Deposit approved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject Deposit
app.post('/api/admin/transactions/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { reason } = req.body;

    const transaction = await dbAsync.get('SELECT * FROM transactions WHERE id = ?', [transactionId]);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be rejected' });
    }

    // Update transaction status
    await dbAsync.run(
      `UPDATE transactions SET status = 'rejected', admin_notes = ?, completed_by = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [reason || 'No reason provided', req.admin.id, transactionId]
    );

    // Create notification for user
    await createNotification(
      transaction.user_id,
      'deposit_rejected',
      'Deposit Rejected',
      `Your deposit request of $${transaction.amount.toFixed(2)} has been rejected. Reason: ${reason || 'No reason provided'}`,
      { amount: transaction.amount, reason }
    );

    res.json({ message: 'Deposit rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN USERS ====================

// Get All Users
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await dbAsync.all(
      `SELECT id, username, email, funding_balance, demo_balance, created_at, last_login FROM users ORDER BY created_at DESC`
    );

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== NOTIFICATIONS ====================

// Get User Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await dbAsync.all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark Notification as Read
app.put('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    await dbAsync.run(
      `UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`,
      [notificationId, req.user.id]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HEALTH CHECK ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== HELPER FUNCTIONS ====================

async function createNotification(userId, type, title, message, data = {}) {
  try {
    const notificationId = `NOTIF-${Date.now()}-${uuidv4().slice(0, 8)}`;

    await dbAsync.run(
      `INSERT INTO notifications (notification_id, user_id, type, title, message, data) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [notificationId, userId, type, title, message, JSON.stringify(data)]
    );

    return { id: notificationId };
  } catch (error) {
    console.error('❌ Notification creation error:', error);
  }
}

// Update market prices (simulated)
function updateMarketPrices() {
  const cryptoData = [
    { name: 'Bitcoin', symbol: 'BTC', price: 45000, change: 2.5 },
    { name: 'Ethereum', symbol: 'ETH', price: 2500, change: 1.8 },
    { name: 'Ripple', symbol: 'XRP', price: 2.5, change: -0.5 },
    { name: 'Cardano', symbol: 'ADA', price: 0.98, change: 3.2 },
    { name: 'Solana', symbol: 'SOL', price: 145, change: 5.1 }
  ];

  cryptoData.forEach(crypto => {
    const randomChange = (Math.random() - 0.5) * 5;
    const newPrice = crypto.price * (1 + randomChange / 100);

    dbAsync.run(
      `INSERT INTO price_history (coin, symbol, price, change_24h) VALUES (?, ?, ?, ?)`,
      [crypto.name, crypto.symbol, newPrice, randomChange]
    ).catch(err => console.error('❌ Price update error:', err));
  });
}

// ==================== ERROR HANDLING ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER STARTUP ====================

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     🚀 QuantumCoin API Server 🚀      ║
╠════════════════════════════════════════╣
║ Server: http://localhost:${PORT}         ║
║ Status: ✅ Running                     ║
║                                        ║
║ Demo Admin:                            ║
║   Username: admin                      ║
║   Password: admin123                   ║
║                                        ║
║ Demo User:                             ║
║   Username: testuser                   ║
║   Password: password123                ║
╚════════════════════════════════════════╝
  `);
  
  // Update prices every 30 seconds
  setInterval(updateMarketPrices, 30000);
  updateMarketPrices(); // Initial update
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
