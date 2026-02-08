
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

// ========== DATABASE SETUP ==========
const db = new sqlite3.Database(':memory:');

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

async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        console.log('🗄️  Initializing database...');
        
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          funding_balance REAL DEFAULT 5000.00,
          demo_balance REAL DEFAULT 100000.00,
          google_id TEXT UNIQUE,
          name TEXT,
          picture TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1
        )`, async (err) => {
          if (err) reject(err);
          
          console.log('✅ Users table created');
          
          // Insert default user if not exists
          const userPassword = bcrypt.hashSync('password123', 10);
          await dbQuery.run(
            `INSERT OR IGNORE INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)`, 
            ['testuser', 'test@quantumcoin.com', userPassword, 0.00, 100000.00]
          );
          console.log('✅ Default user created');
        });

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
        )`, (err) => {
          if (err) reject(err);
          console.log('✅ Transactions table created');
        });

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
        )`, (err) => {
          if (err) reject(err);
          console.log('✅ Notifications table created');
        });

        // Admin users table
        db.run(`CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, async (err) => {
          if (err) reject(err);
          console.log('✅ Admins table created');
          
          // Insert default admin if not exists
          const adminPassword = bcrypt.hashSync('admin123', 10);
          await dbQuery.run(
            `INSERT OR IGNORE INTO admins (username, password) VALUES (?, ?)`, 
            ['admin', adminPassword]
          );
          console.log('✅ Default admin created');
        });

        // Trades table
        db.run(`CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          symbol TEXT NOT NULL,
          amount REAL NOT NULL,
          price REAL NOT NULL,
          total REAL NOT NULL,
          fee REAL DEFAULT 0,
          account_type TEXT NOT NULL,
          prediction TEXT,
          profit_loss REAL,
          status TEXT DEFAULT 'completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) reject(err);
          console.log('✅ Trades table created');
        });

        // Portfolio table
        db.run(`CREATE TABLE IF NOT EXISTS portfolio (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          coin_symbol TEXT NOT NULL,
          amount REAL NOT NULL,
          purchase_price REAL NOT NULL,
          account_type TEXT NOT NULL,
          current_value REAL,
          profit_loss REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, coin_symbol, account_type),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) reject(err);
          console.log('✅ Portfolio table created');
        });

        // Price history table
        db.run(`CREATE TABLE IF NOT EXISTS price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          price REAL NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
          console.log('✅ Price history table created');
        });

        // Chat messages table
        db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
          console.log('✅ Chat messages table created');
          resolve();
        });
        
      } catch (error) {
        reject(error);
      }
    });
  });
}
// Database helper functions


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
// ========== SERVER CODE (Backend) ==========
// ... [Keep the beginning code the same until line 108] ...

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
  BNB: {
    name: 'Binance Coin',
    price: 312.50,
    change: 1.12,
    volume: 850000000,
    color: '#f3ba2f',
    volatility: 0.025
  },
  SOL: {
    name: 'Solana',
    price: 102.84,
    change: 4.98,
    volume: 2100000000,
    color: '#14f195',
    volatility: 0.045
  },
  XRP: {
    name: 'Ripple',
    price: 0.62,
    change: -1.85,
    volume: 1800000000,
    color: '#23292f',
    volatility: 0.04
  },
  ADA: {
    name: 'Cardano',
    price: 0.47,
    change: 2.01,
    volume: 720000000,
    color: '#0033ad',
    volatility: 0.035
  },
  DOGE: {
    name: 'Dogecoin',
    price: 0.086,
    change: 5.45,
    volume: 1200000000,
    color: '#c2a633',
    volatility: 0.05
  },
  SHIB: {
    name: 'Shiba Inu',
    price: 0.000021,
    change: 6.72,
    volume: 650000000,
    color: '#ff4d00',
    volatility: 0.07
  },
  MATIC: {
    name: 'Polygon',
    price: 0.89,
    change: 3.77,
    volume: 940000000,
    color: '#8247e5',
    volatility: 0.04
  },
  AVAX: {
    name: 'Avalanche',
    price: 34.18,
    change: 2.55,
    volume: 560000000,
    color: '#e84142',
    volatility: 0.045
  },
  TON: {
    name: 'Toncoin',
    price: 2.35,
    change: 1.40,
    volume: 310000000,
    color: '#0098ea',
    volatility: 0.03
  },
  PEPE: {
    name: 'Pepe',
    price: 0.0000013,
    change: 9.80,
    volume: 420000000,
    color: '#57b846',
    volatility: 0.09
  }
};

// REMOVE the duplicate updateMarketPrices() function at line 109-122
// Keep only this one function:

// Update market prices and save to database
async function updateMarketPrices() {
  for (const coin in cryptoData) {
    const volatility = cryptoData[coin].volatility || 0.02;
    const changePercent = (Math.random() * volatility * 2) - volatility;
    
    cryptoData[coin].price = cryptoData[coin].price * (1 + changePercent);
    cryptoData[coin].change = parseFloat((changePercent * 100).toFixed(2));
    cryptoData[coin].volume = cryptoData[coin].volume * (1 + Math.random() * 0.1 - 0.05);
    
    // Save to database
    try {
      await dbQuery.run(
        'INSERT INTO price_history (symbol, price) VALUES (?, ?)',
        [coin, cryptoData[coin].price]
      );
    } catch (error) {
      console.error('Failed to save price history:', error);
    }
  }
  
  // Broadcast update to all connected clients
  io.emit('market_update', cryptoData);
}

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
// Add Google OAuth client configuration (use your actual Google Client ID)
const GOOGLE_CLIENT_ID = '960526558312-gijpb2ergfdaco08e8et34vlqjr09o36.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Add Google OAuth endpoint (place this with other auth routes)
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'No credential provided' });
    }
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    // Extract user info from Google payload
    const googleId = payload.sub;
    const email = payload.email;
    const username = payload.name || email.split('@')[0];
    const name = payload.name;
    const picture = payload.picture;
    
    // Check if user already exists
    let user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      // Create new user with Google info
      const result = await dbQuery.run(
        `INSERT INTO users (username, email, password, funding_balance, demo_balance) 
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, `google_${googleId}`, 0.00, 100000.00]
      );
      
      user = {
        id: result.id,
        username: username,
        email: email,
        funding_balance: 0.00,
        demo_balance: 100000.00,
        name: name,
        picture: picture
      };
    } else {
      // Update last login for existing user
      await dbQuery.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
      
      console.log('Existing Google user logged in:', user.id);
    }
    // Create session token
    const token = `google_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance,
        name: name,
        picture: picture,
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
        demo_balance: user.demo_balance,
        name: name,
        picture: picture
      }
    });
    
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});


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

// Add registration endpoint (place with other auth routes)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if username or email already exists
    const existingUser = await dbQuery.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }
    
    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Create user
    const result = await dbQuery.run(
      `INSERT INTO users (username, email, password, funding_balance, demo_balance) 
       VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, 0.00, 100000.00]
    );
    
    // Create session token
    const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: result.id,
        username: username,
        email: email,
        funding_balance: 0.00,
        demo_balance: 100000.00,
        isAdmin: false
      },
      createdAt: Date.now()
    });
    
    res.json({
      token,
      user: {
        id: result.id,
        username: username,
        email: email,
        funding_balance: 0.00,
        demo_balance: 100000.00
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
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

// POST /api/auth/logout - Logout user
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    // Remove session
    sessions.delete(token);
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Update market prices and save to database
async function updateMarketPrices() {
  for (const coin in cryptoData) {
    const volatility = cryptoData[coin].volatility || 0.02;
    const changePercent = (Math.random() * volatility * 2) - volatility;
    
    cryptoData[coin].price = cryptoData[coin].price * (1 + changePercent);
    cryptoData[coin].change = parseFloat((changePercent * 100).toFixed(2));
    cryptoData[coin].volume = cryptoData[coin].volume * (1 + Math.random() * 0.1 - 0.05);
    
    // Save to database
    try {
      await dbQuery.run(
        'INSERT INTO price_history (symbol, price) VALUES (?, ?)',
        [coin, cryptoData[coin].price]
      );
    } catch (error) {
      console.error('Failed to save price history:', error);
    }
  }
  
  // Broadcast update to all connected clients
  io.emit('market_update', cryptoData);
}

async function initializeSampleData() {
  try {
    // Add some initial chat messages
    await dbQuery.run(
      `INSERT OR IGNORE INTO chat_messages (user_id, username, message, timestamp) VALUES
       (0, 'System', 'Welcome to QuantumCoin Trading Platform!', datetime('now', '-2 hours')),
       (0, 'Trader_Pro', 'Market looks bullish today! Great time to buy BTC', datetime('now', '-1 hour')),
       (0, 'Crypto_Queen', 'Just made 15% profit on ETH trades!', datetime('now', '-30 minutes'))`
    );
    
    // Add initial price history
    const coins = ['BTC', 'ETH', 'DOGE', 'SOL', 'ADA', 'XRP', 'BNB'];
    for (const coin of coins) {
      if (!cryptoData[coin]) {
        cryptoData[coin] = {
          name: coin,
          price: Math.random() * 1000,
          change: (Math.random() - 0.5) * 10,
          volume: Math.random() * 1000000000,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
          volatility: 0.02 + Math.random() * 0.03
        };
      }
      
      // Add 24 hours of price history
      for (let i = 24; i >= 0; i--) {
        const price = cryptoData[coin].price * (1 + (Math.random() - 0.5) * 0.02);
        await dbQuery.run(
          'INSERT INTO price_history (symbol, price, timestamp) VALUES (?, ?, datetime("now", ?))',
          [coin, price, `-${i} hours`]
        );
      }
    }
    
    console.log('✅ Sample data initialized');
  } catch (error) {
    console.error('Failed to initialize sample data:', error);
  }
}


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

// ✅ FIXED: Market data endpoint
// GET /api/market/data - Real market data
app.get('/api/market/data', authenticateToken, async (req, res) => {
  try {
    const ALL_COINS = ['BTC','ETH','DOGE','SHIB','ADA','SOL','XRP','BNB','MATIC','AVAX','TON','PEPE'];

    // Get latest prices
    const priceHistory = await dbQuery.all(`
      SELECT ph.* FROM price_history ph 
      INNER JOIN (
        SELECT symbol, MAX(timestamp) as max_time 
        FROM price_history 
        GROUP BY symbol
      ) latest 
      ON ph.symbol = latest.symbol AND ph.timestamp = latest.max_time
    `);

    const result = {};

    // Convert DB results into object
    priceHistory.forEach(ph => {
      const coinInfo = cryptoData[ph.symbol] || {};

      result[ph.symbol] = {
        name: ph.symbol,
        price: ph.price,
        change: coinInfo.change || 0,
        volume: coinInfo.volume || 1000000,
        color: coinInfo.color || '#00f0ff',
        volatility: coinInfo.volatility || 0.02
      };
    });

    // Fill missing coins automatically (simulation fallback)
    ALL_COINS.forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = {
          name: symbol,
          price: Math.random() * 100,
          change: (Math.random() - 0.5) * 10,
          volume: Math.random() * 1000000000,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
          volatility: 0.02 + Math.random() * 0.03
        };
      }
    });

    res.json(result);

  } catch (error) {
    console.error('Market data error:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// GET /api/trade/history - Real trade history
app.get('/api/trade/history', authenticateToken, async (req, res) => {
  try {
    const trades = await dbQuery.all(
      `SELECT * FROM trades 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    
    res.json(trades);
  } catch (error) {
    console.error('Trade history error:', error);
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

// POST /api/trade - Execute trade with real database operations
app.post('/api/trade', authenticateToken, async (req, res) => {
  try {
    const { type, symbol, amount, account_type, prediction } = req.body;
    
    if (!['buy', 'sell'].includes(type)) {
      return res.status(400).json({ error: 'Invalid trade type' });
    }
    
    if (!symbol || !amount || !account_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const coinData = cryptoData[symbol];
    if (!coinData) {
      return res.status(404).json({ error: 'Coin not found' });
    }
    
    const currentPrice = coinData.price;
    const totalCost = type === 'buy' ? amount : amount * currentPrice;
    const fee = totalCost * 0.001; // 0.1% fee
    
    // Get user's current balance
    const user = await dbQuery.get(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let newFundingBalance = user.funding_balance;
    let newDemoBalance = user.demo_balance;
    
    // Validate balance
    if (account_type === 'funding') {
      if (type === 'buy' && user.funding_balance < (totalCost + fee)) {
        return res.status(400).json({ 
          error: 'Insufficient funds in funding account',
          required: totalCost + fee,
          available: user.funding_balance
        });
      }
    } else if (account_type === 'demo') {
      if (type === 'buy' && user.demo_balance < (totalCost + fee)) {
        return res.status(400).json({ 
          error: 'Insufficient funds in demo account',
          required: totalCost + fee,
          available: user.demo_balance
        });
      }
    } else {
      return res.status(400).json({ error: 'Invalid account type' });
    }
    
    // Start transaction
    await dbQuery.run('BEGIN TRANSACTION');
    
    try {
      // Update user balance
      if (account_type === 'funding') {
        if (type === 'buy') {
          newFundingBalance = user.funding_balance - (totalCost + fee);
        } else {
          newFundingBalance = user.funding_balance + (totalCost - fee);
        }
        
        await dbQuery.run(
          'UPDATE users SET funding_balance = ? WHERE id = ?',
          [newFundingBalance, req.user.id]
        );
      } else {
        if (type === 'buy') {
          newDemoBalance = user.demo_balance - (totalCost + fee);
        } else {
          newDemoBalance = user.demo_balance + (totalCost - fee);
        }
        
        await dbQuery.run(
          'UPDATE users SET demo_balance = ? WHERE id = ?',
          [newDemoBalance, req.user.id]
        );
      }
      
      // Record the trade
      const tradeResult = await dbQuery.run(
        `INSERT INTO trades (user_id, type, symbol, amount, price, total, fee, account_type, prediction, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [req.user.id, type, symbol, amount, currentPrice, totalCost, fee, account_type, prediction]
      );
      
      // Update portfolio
      if (type === 'buy') {
        const existingHolding = await dbQuery.get(
          'SELECT * FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?',
          [req.user.id, symbol, account_type]
        );
        
        if (existingHolding) {
          // Update existing holding
          const newAmount = existingHolding.amount + (amount / currentPrice);
          const avgPurchasePrice = (
            (existingHolding.amount * existingHolding.purchase_price) + 
            (amount / currentPrice * currentPrice)
          ) / newAmount;
          
          await dbQuery.run(
            `UPDATE portfolio SET 
             amount = ?,
             purchase_price = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newAmount, avgPurchasePrice, existingHolding.id]
          );
        } else {
          // Create new holding
          await dbQuery.run(
            `INSERT INTO portfolio (user_id, coin_symbol, amount, purchase_price, account_type)
             VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, symbol, amount / currentPrice, currentPrice, account_type]
          );
        }
      } else {
        // Sell transaction
        const existingHolding = await dbQuery.get(
          'SELECT * FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?',
          [req.user.id, symbol, account_type]
        );
        
        if (!existingHolding || existingHolding.amount < amount) {
          throw new Error('Insufficient coin holdings to sell');
        }
        
        const newAmount = existingHolding.amount - amount;
        
        if (newAmount <= 0) {
          // Remove from portfolio
          await dbQuery.run(
            'DELETE FROM portfolio WHERE id = ?',
            [existingHolding.id]
          );
        } else {
          // Update holding
          await dbQuery.run(
            `UPDATE portfolio SET 
             amount = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newAmount, existingHolding.id]
          );
        }
      }
      
      // Record transaction
      await dbQuery.run(
        `INSERT INTO transactions (user_id, username, type, amount, status, created_at)
         VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`,
        [req.user.id, req.user.username, type, totalCost]
      );
      
      await dbQuery.run('COMMIT');
      
      // Emit balance update via WebSocket
      io.to(`user_${req.user.id}`).emit('balance_update', {
        funding_balance: newFundingBalance,
        demo_balance: newDemoBalance
      });
      
      // Emit trade notification
      io.to(`user_${req.user.id}`).emit('trade_executed', {
        tradeId: tradeResult.id,
        type,
        symbol,
        amount,
        price: currentPrice,
        total: totalCost
      });
      
      res.json({
        success: true,
        message: `Trade ${type} executed successfully`,
        funding_balance: newFundingBalance,
        demo_balance: newDemoBalance,
        trade: {
          id: tradeResult.id,
          type,
          symbol,
          amount,
          price: currentPrice,
          fee,
          total: totalCost,
          account_type,
          prediction
        }
      });
      
    } catch (error) {
      await dbQuery.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Trade execution error:', error);
    res.status(500).json({ error: 'Failed to execute trade: ' + error.message });
  }
});



// GET /api/market/chart/:coin/:timeframe - Real chart data
// GET /api/market/chart/:coin/:timeframe - Real + fallback chart data
app.get('/api/market/chart/:coin/:timeframe', authenticateToken, async (req, res) => {
  try {
    const { coin, timeframe } = req.params;

    /* ---------------- TIMEFRAME CONFIG ---------------- */
    const intervals = {
      '1h': { hours: 1, interval: 60000, type: 'minute' },
      '1d': { hours: 24, interval: 3600000, type: 'hour' },
      '1w': { hours: 168, interval: 86400000, type: 'day' },
      '1m': { hours: 720, interval: 86400000, type: 'day' },
      '1y': { hours: 8760, interval: 2592000000, type: 'month' }
    };

    const config = intervals[timeframe] || intervals['1d'];

    const coinData = cryptoData[coin];
    if (!coinData) {
      return res.status(404).json({ error: 'Coin not found' });
    }

    /* ---------------- FETCH RAW DATA ---------------- */
    const rawData = await dbQuery.all(
      `SELECT timestamp, price
       FROM price_history
       WHERE symbol = ?
         AND timestamp >= datetime('now', ?)
       ORDER BY timestamp ASC`,
      [coin, `-${config.hours} hours`]
    );

    /* ---------------- HELPER: FAKE CANDLES ---------------- */
    const generateFakeData = (points = 100) => {
      let currentPrice = coinData.price;
      const now = Date.now();
      const fake = [];

      for (let i = points; i >= 0; i--) {
        const time = new Date(now - i * config.interval);

        const change = (Math.random() - 0.5) * (coinData.volatility || 0.02);

        const open = currentPrice;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);

        fake.push({
          time: time.toISOString(),
          open: +open.toFixed(2),
          high: +high.toFixed(2),
          low: +low.toFixed(2),
          close: +close.toFixed(2)
        });

        currentPrice = close;
      }

      return fake;
    };

    /* ---------------- IF EMPTY → FAKE ---------------- */
    if (rawData.length === 0) {
      return res.json(generateFakeData());
    }

    /* ---------------- GROUP → OHLC ---------------- */
    const grouped = {};

    rawData.forEach(row => {
      const d = new Date(row.timestamp);
      let key;

      switch (config.type) {
        case 'minute':
          key = `${d.getHours()}:${Math.floor(d.getMinutes() / 5) * 5}`;
          break;

        case 'hour':
          key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:00`;
          break;

        case 'day':
          key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
          break;

        case 'month':
          key = `${d.getFullYear()}-${d.getMonth()+1}`;
          break;

        default:
          key = d.toISOString();
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row.price);
    });

    const chartData = Object.entries(grouped).map(([time, prices]) => ({
      time,
      open: +prices[0].toFixed(2),
      high: +Math.max(...prices).toFixed(2),
      low: +Math.min(...prices).toFixed(2),
      close: +prices[prices.length - 1].toFixed(2)
    }));

    chartData.sort((a, b) => new Date(a.time) - new Date(b.time));

    /* ---------------- PAD SMALL DATASETS ---------------- */
    if (chartData.length < 10) {
      const padding = generateFakeData(100 - chartData.length);
      chartData.unshift(...padding);
    }

    res.json(chartData);

  } catch (error) {
    console.error('Chart endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});



// GET /api/portfolio - Real portfolio data
app.get('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    const portfolio = await dbQuery.all(
      `SELECT * FROM portfolio 
       WHERE user_id = ? 
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    
    // If empty portfolio, check if user has any trades
    if (portfolio.length === 0) {
      const userTrades = await dbQuery.all(
        `SELECT * FROM trades WHERE user_id = ?`,
        [req.user.id]
      );
      
      if (userTrades.length === 0) {
        return res.json([]); // Return empty array
      }
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// GET /api/user/notifications - Real notifications
app.get('/api/user/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await dbQuery.all(
      `SELECT * FROM user_notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [req.user.id]
    );
    
    // Mark as read
    await dbQuery.run(
      'UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    
    res.json(notifications);
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Add this after the existing market routes

// ========== TRANSACTIONS ROUTES ==========
// GET /api/transactions - Get user transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await dbQuery.all(
      `SELECT * FROM transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    
    res.json(transactions);
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions/deposit - Create deposit request
app.post('/api/transactions/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount, network, wallet_address, notes } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const result = await dbQuery.run(
      `INSERT INTO transactions (user_id, username, type, amount, network, wallet_address, status, user_notes)
       VALUES (?, ?, 'deposit', ?, ?, ?, 'pending', ?)`,
      [req.user.id, req.user.username, amount, network, wallet_address, notes || '']
    );
    
    // Create notification for user
    await createNotification(
      req.user.id,
      'info',
      'Deposit Requested 💰',
      `Your deposit request of $${amount.toFixed(2)} has been received and is pending admin approval.`,
      { 
        transactionId: result.id,
        amount: amount,
        action: 'view_transaction'
      }
    );
    
    // Notify admins
    io.to('admin_room').emit('new_deposit_request', {
      transactionId: result.id,
      username: req.user.username,
      amount: amount,
      network: network,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Deposit request submitted successfully',
      transactionId: result.id
    });
    
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// POST /api/transactions/withdraw - Create withdrawal request
app.post('/api/transactions/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount, network, wallet_address, notes } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Check user balance
    const user = await dbQuery.get(
      'SELECT funding_balance FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user || user.funding_balance < amount) {
      return res.status(400).json({ 
        error: 'Insufficient funds',
        available: user?.funding_balance || 0,
        required: amount
      });
    }
    
    // Deduct from balance temporarily
    await dbQuery.run(
      'UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?',
      [amount, req.user.id]
    );
    
    // Create withdrawal request
    const result = await dbQuery.run(
      `INSERT INTO transactions (user_id, username, type, amount, network, wallet_address, status, user_notes)
       VALUES (?, ?, 'withdrawal', ?, ?, ?, 'pending', ?)`,
      [req.user.id, req.user.username, amount, network, wallet_address, notes || '']
    );
    
    // Create notification for user
    await createNotification(
      req.user.id,
      'info',
      'Withdrawal Requested 💸',
      `Your withdrawal request of $${amount.toFixed(2)} has been received and is pending admin approval.`,
      { 
        transactionId: result.id,
        amount: amount,
        network: network,
        wallet_address: wallet_address,
        action: 'view_transaction'
      }
    );
    
    // Notify admins
    io.to('admin_room').emit('new_withdrawal_request', {
      transactionId: result.id,
      username: req.user.username,
      amount: amount,
      network: network,
      wallet_address: wallet_address,
      timestamp: new Date().toISOString()
    });
    
    // Emit balance update
    const updatedUser = await dbQuery.get(
      'SELECT funding_balance FROM users WHERE id = ?',
      [req.user.id]
    );
    
    io.to(`user_${req.user.id}`).emit('balance_update', {
      funding_balance: updatedUser.funding_balance
    });
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      transactionId: result.id,
      new_balance: updatedUser.funding_balance
    });
    
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to create withdrawal request' });
  }
});

// ========== USER DATA ROUTES ==========
// GET /api/user/data - Get complete user data
app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    const user = await dbQuery.get(
      'SELECT id, username, email, funding_balance, demo_balance, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('User data error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
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
  
  // Chat message handler
  socket.on('chat_message', async (data) => {
    try {
      // Save to database
      const result = await dbQuery.run(
        'INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)',
        [data.userId, data.username, data.message]
      );
      
      // Broadcast to all clients
      const messageObj = {
        id: result.id,
        userId: data.userId,
        username: data.username,
        message: data.message,
        timestamp: new Date().toISOString()
      };
      
      // Emit to all clients - both events for compatibility
      io.emit('receive_message', messageObj);
      io.emit('new_chat_message', messageObj);
      
    } catch (error) {
      console.error('Chat error:', error);
    }
  });
  
  socket.on('get_chat_history', async () => {
    try {
      const messages = await dbQuery.all(
        `SELECT * FROM chat_messages 
         ORDER BY timestamp DESC 
         LIMIT 50`
      );
      
      socket.emit('chat_history', messages.reverse());
    } catch (error) {
      console.error('Chat history error:', error);
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
  console.log(`👑 Admin login: admin / admin123`);
  console.log(`👤 User login: testuser / password123`);
  console.log(`💸 Admin Panel Features:`);
  console.log(`   • Complete withdrawal management`);
  console.log(`   • Deposit approval system`);
  console.log(`   • User management`);
  console.log(`   • Real-time notifications`);
  console.log(`   • Dashboard statistics`);
});


// Export the server for use in other files if needed
module.exports = { app, server };
