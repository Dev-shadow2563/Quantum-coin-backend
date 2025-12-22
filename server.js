// server.js - QuantumCoin API Backend (COMPLETE MERGED VERSION)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const moment = require('moment');

const app = express();
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

    // Portfolio table
    db.run(`CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_symbol TEXT NOT NULL,
      amount REAL NOT NULL,
      purchase_price REAL NOT NULL,
      current_value REAL,
      profit_loss REAL DEFAULT 0,
      account_type TEXT DEFAULT 'funding',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Trade history table
    db.run(`CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_symbol TEXT NOT NULL,
      trade_type TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      account_type TEXT NOT NULL,
      prediction TEXT,
      result TEXT,
      profit_loss REAL,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Chat messages table
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    // Insert initial chat messages
    const initialMessages = [
      [1, 'AltcoinAce', 'Just closed a $320 profit on SOL. Loving the speed!'],
      [1, 'BlockMaster', 'Charts load instantly, very smooth experience'],
      [1, 'CryptoWolf', 'Withdrew $1,200 today, no stress at all'],
      [1, 'ChainGuru', 'Made $780 trading BTC volatility'],
      [1, 'BullRunBen', 'Caught the pump early, $450 profit'],
      [1, 'BearTrap', 'Lost $150 but risk management saved me'],
      [1, 'TokenQueen', 'UI feels premium, very easy to use'],
      [1, 'SatoshiLite', 'First trade ever, made $90 profit'],
      [1, 'PumpRider', 'DOGE run gave me $600 gains'],
      [1, 'ChartSniper', 'Indicators are very accurate'],
      [1, 'EtherLord', 'ETH breakout earned me $1,050'],
      [1, 'QuickFlip', 'Scalped $210 in under 10 minutes'],
      [1, 'MarginMike', 'Leverage tools are well designed'],
      [1, 'HodlKing', 'Holding long-term, platform feels safe'],
      [1, 'GreenCandle', 'Account went green today, $340 up'],
      [1, 'RedCandle', 'Small loss today, but learned a lot'],
      [1, 'TradeSensei', 'Best order execution I\'ve seen'],
      [1, 'CryptoNova', 'Withdrew $900 successfully'],
      [1, 'WhaleWatcher', 'Market depth feature is amazing'],
      [1, 'FastHands', 'Instant buy/sell, no lag'],
      [1, 'Trader21', 'Closed $280 profit on BTC'],
      [1, 'Trader22', 'Smooth withdrawal process'],
      [1, 'Trader23', 'Charts feel professional'],
      [1, 'Trader24', 'Quick execution, very impressed'],
      [1, 'Trader25', 'Made $510 trading ETH'],
      [1, 'Trader26', 'Low fees compared to others'],
      [1, 'Trader27', 'UI is clean and simple'],
      [1, 'Trader28', 'Risk tools saved my account'],
      [1, 'Trader29', 'Took $430 profit today'],
      [1, 'Trader30', 'Everything works perfectly'],
      [1, 'Trader31', 'Good experience so far'],
      [1, 'Trader32', 'Withdraw completed fast'],
      [1, 'Trader33', 'Platform feels legit'],
      [1, 'Trader34', 'Nice profit run today'],
      [1, 'Trader35', 'Charts update instantly'],
      [1, 'Trader36', 'Very beginner friendly'],
      [1, 'Trader37', 'Execution speed is great'],
      [1, 'Trader38', 'Market data looks accurate'],
      [1, 'Trader39', 'Account balance increasing'],
      [1, 'Trader40', 'Happy with performance'],
      [1, 'Trader41', 'Made $190 profit'],
      [1, 'Trader42', 'Lost a bit but recovered'],
      [1, 'Trader43', 'Solid trading tools'],
      [1, 'Trader44', 'BTC trades are smooth'],
      [1, 'Trader45', 'Fast order fills'],
      [1, 'Trader46', 'No lag noticed'],
      [1, 'Trader47', 'Easy withdrawals'],
      [1, 'Trader48', 'Nice clean dashboard'],
      [1, 'Trader49', 'Trading feels safe'],
      [1, 'Trader50', 'Good overall experience'],
      [1, 'Trader51', 'Closed green today'],
      [1, 'Trader52', 'ETH scalps working well'],
      [1, 'Trader53', 'Very responsive charts'],
      [1, 'Trader54', 'No crashes so far'],
      [1, 'Trader55', 'Simple and effective'],
      [1, 'Trader56', 'Withdrew without issues'],
      [1, 'Trader57', 'Good risk management'],
      [1, 'Trader58', 'Made steady profits'],
      [1, 'Trader59', 'Smooth navigation'],
      [1, 'Trader60', 'Satisfied user'],
      [1, 'Trader61', 'BTC breakout paid off'],
      [1, 'Trader62', 'Quick deposit approval'],
      [1, 'Trader63', 'Platform is stable'],
      [1, 'Trader64', 'Clear price action'],
      [1, 'Trader65', 'Small wins add up'],
      [1, 'Trader66', 'Good stop loss tools'],
      [1, 'Trader67', 'No hidden fees'],
      [1, 'Trader68', 'Easy to understand'],
      [1, 'Trader69', 'Made $360 today'],
      [1, 'Trader70', 'Everything looks good'],
      [1, 'Trader71', 'Charts are sharp'],
      [1, 'Trader72', 'Nice execution speed'],
      [1, 'Trader73', 'Account growing slowly'],
      [1, 'Trader74', 'Works as expected'],
      [1, 'Trader75', 'Very smooth trades'],
      [1, 'Trader76', 'Market depth is helpful'],
      [1, 'Trader77', 'Profits came in'],
      [1, 'Trader78', 'Withdraw successful'],
      [1, 'Trader79', 'UI feels modern'],
      [1, 'Trader80', 'Reliable platform'],
      [1, 'Trader81', 'BTC scalp worked'],
      [1, 'Trader82', 'ETH trade went green'],
      [1, 'Trader83', 'Fast confirmations'],
      [1, 'Trader84', 'No complaints so far'],
      [1, 'Trader85', 'Easy to trade'],
      [1, 'Trader86', 'Good indicators'],
      [1, 'Trader87', 'Quick response time'],
      [1, 'Trader88', 'Funds safe here'],
      [1, 'Trader89', 'Nice profit margin'],
      [1, 'Trader90', 'Stable experience'],
      [1, 'Trader91', 'DOGE pump paid'],
      [1, 'Trader92', 'Clean charts'],
      [1, 'Trader93', 'Simple layout'],
      [1, 'Trader94', 'Good trading engine'],
      [1, 'Trader95', 'No slippage noticed'],
      [1, 'Trader96', 'Withdrew profits today'],
      [1, 'Trader97', 'Very smooth'],
      [1, 'Trader98', 'Nice balance growth'],
      [1, 'Trader99', 'Trades executed fast'],
      [1, 'Trader100', 'Happy trader'],
      [1, 'Trader101', 'All good here'],
      [1, 'Trader102', 'Trading daily'],
      [1, 'Trader103', 'No issues'],
      [1, 'Trader104', 'Good platform'],
      [1, 'Trader105', 'Solid performance'],
      [1, 'Trader106', 'Charts load fast'],
      [1, 'Trader107', 'Easy withdrawals'],
      [1, 'Trader108', 'Consistent profits'],
      [1, 'Trader109', 'User friendly'],
      [1, 'Trader110', 'Reliable'],
      [1, 'Trader291', 'Everything works fine'],
      [1, 'Trader292', 'Smooth trades'],
      [1, 'Trader293', 'No errors seen'],
      [1, 'Trader294', 'Fast execution'],
      [1, 'Trader295', 'Withdraw OK'],
      [1, 'Trader296', 'Charts are clean'],
      [1, 'Trader297', 'Good experience'],
      [1, 'Trader298', 'Stable platform'],
      [1, 'Trader299', 'Trading feels safe'],
      [1, 'Trader300', 'Satisfied overall']
    ];

    db.run(`DELETE FROM chat_messages`);
    initialMessages.forEach(msg => {
      db.run(`INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)`, msg);
    });
    
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
// Realistic crypto data with proper price ranges
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
  },
  SHIB: { 
    name: 'Shiba Inu', 
    price: 0.0000089, 
    change: 8.67, 
    volume: 480000000, 
    color: '#ff00c8',
    volatility: 0.08 
  },
  ADA: { 
    name: 'Cardano', 
    price: 0.52, 
    change: -1.23, 
    volume: 320000000, 
    color: '#0033ad',
    volatility: 0.04 
  },
  SOL: { 
    name: 'Solana', 
    price: 96.75, 
    change: 4.89, 
    volume: 2100000000, 
    color: '#00ffa3',
    volatility: 0.06 
  },
  XRP: { 
    name: 'Ripple', 
    price: 0.62, 
    change: 0.45, 
    volume: 1800000000, 
    color: '#23292f',
    volatility: 0.03 
  },
  BNB: { 
    name: 'Binance Coin', 
    price: 315.25, 
    change: 1.34, 
    volume: 1500000000, 
    color: '#f0b90b',
    volatility: 0.02 
  }
};

// Price ranges for realistic fluctuations
const priceRanges = {
  BTC: { min: 35000, max: 50000 },
  ETH: { min: 2000, max: 2800 },
  DOGE: { min: 0.07, max: 0.12 },
  SHIB: { min: 0.000007, max: 0.000012 },
  ADA: { min: 0.45, max: 0.65 },
  SOL: { min: 80, max: 120 },
  XRP: { min: 0.55, max: 0.75 },
  BNB: { min: 290, max: 340 }
};

// Simulate market updates
function updateMarketPrices() {
  for (const coin in cryptoData) {
    const range = priceRanges[coin];
    const volatility = cryptoData[coin].volatility || 0.02;
    const changePercent = (Math.random() * volatility * 2) - volatility;
    
    // Update price with realistic bounds
    let newPrice = cryptoData[coin].price * (1 + changePercent);
    newPrice = Math.max(range.min, Math.min(range.max, newPrice));
    
    // Update change percentage
    const oldPrice = cryptoData[coin].price;
    const actualChange = ((newPrice - oldPrice) / oldPrice) * 100;
    
    cryptoData[coin].price = parseFloat(newPrice.toFixed(coin === 'SHIB' ? 8 : 2));
    cryptoData[coin].change = parseFloat(actualChange.toFixed(2));
    cryptoData[coin].volume = cryptoData[coin].volume * (1 + Math.random() * 0.1 - 0.05);
  }
  
  // Broadcast update to all connected clients
  io.emit('market_update', cryptoData);
  io.emit('market_data', cryptoData);
}

// Update prices every 3 seconds
setInterval(updateMarketPrices, 3000);

// ========== CHART DATA GENERATION ==========
function generateChartData(symbol, timeframe = '1h') {
  const basePrice = cryptoData[symbol]?.price || 1000;
  const volatility = cryptoData[symbol]?.volatility || 0.02;
  const range = priceRanges[symbol] || { min: basePrice * 0.9, max: basePrice * 1.1 };
  const data = [];
  
  let points = 50;
  let timeUnit = 60000; // 1 minute in milliseconds
  
  switch(timeframe) {
    case '1h': points = 60; timeUnit = 60000; break; // 1 minute intervals
    case '1d': points = 24; timeUnit = 3600000; break; // 1 hour intervals
    case '1w': points = 7; timeUnit = 86400000; break; // 1 day intervals
    case '1m': points = 30; timeUnit = 86400000; break; // 1 day intervals
    case '1y': points = 12; timeUnit = 2592000000; break; // 1 month intervals
    default: points = 60; timeUnit = 60000;
  }
  
  let currentPrice = basePrice;
  let currentTime = Date.now() - (points * timeUnit);
  
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * volatility;
    let newPrice = currentPrice * (1 + change);
    newPrice = Math.max(range.min * 0.95, Math.min(range.max * 1.05, newPrice));
    
    const high = Math.max(currentPrice, newPrice) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(currentPrice, newPrice) * (1 - Math.random() * volatility * 0.5);
    const open = currentPrice;
    const close = newPrice;
    
    data.push({
      time: currentTime,
      timestamp: new Date(currentTime).toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.random() * 1000000 + 500000
    });
    
    currentPrice = newPrice;
    currentTime += timeUnit;
  }
  
  return data;
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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'QuantumCoin API',
    version: '1.0.0',
    features: ['notifications', 'chart-data', 'real-time-market', 'admin-panel', 'withdrawal-system']
  });
});

// API Root
app.get('/api', (req, res) => {
  res.json({
    status: "OK",
    message: "QuantumCoin API v1.0 - Complete with Notifications & Withdrawal System 🚀",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      market: "/api/market",
      trade: "/api/trade",
      transactions: "/api/transactions",
      portfolio: "/api/portfolio",
      notifications: "/api/user/notifications",
      admin: "/api/admin",
      chat: "/api/chat",
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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await dbQuery.run(
      'INSERT INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 0.00, 100000.00]
    );
    
    // Create welcome notification
    await createNotification(
      result.id,
      'success',
      'Welcome to QuantumCoin! 🎉',
      'Your account has been created successfully. You have $100,000 in demo balance to start trading.',
      { type: 'welcome', demo_balance: 100000.00 }
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
    
    res.status(201).json({
      token,
      user: {
        id: result.id,
        username,
        email,
        funding_balance: 0.00,
        demo_balance: 100000.00
      }
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Google OAuth Route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Google credential required' });
    }
    
    // For demo purposes - create a user
    const email = `google_${Date.now()}@quantumcoin.com`;
    const username = `google_user_${Date.now().toString().slice(-6)}`;
    
    // Check if user exists
    const existingUser = await dbQuery.get(
      'SELECT * FROM users WHERE email LIKE ?',
      [`google_%@quantumcoin.com`]
    );
    
    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      // Create new user
      const hashedPassword = bcrypt.hashSync(Date.now().toString(), 10);
      const result = await dbQuery.run(
        'INSERT INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)',
        [username, email, hashedPassword, 0.00, 100000.00]
      );
      
      user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [result.id]);
    }
    
    // Update last login
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
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    sessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// User profile endpoint
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// User balance endpoint
app.get('/api/user/balance', authenticateToken, async (req, res) => {
  try {
    const user = await dbQuery.get(
      'SELECT funding_balance, demo_balance FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      funding_balance: user.funding_balance,
      demo_balance: user.demo_balance
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Admin login
app.post('/api/auth/admin/login', async (req, res) => {
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
    
    res.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== NOTIFICATION ROUTES ==========
app.get('/api/user/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await dbQuery.all(
      `SELECT * FROM user_notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    
    // Mark as read
    await dbQuery.run(
      'UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    
    res.json({ notifications });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/admin/notify-user', authenticateAdmin, async (req, res) => {
  try {
    const { userId, notification } = req.body;
    
    if (!userId || !notification) {
      return res.status(400).json({ error: 'User ID and notification required' });
    }
    
    await createNotification(
      userId,
      notification.type,
      notification.title,
      notification.message,
      notification.data
    );
    
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ========== MARKET DATA ROUTES ==========
app.get('/api/market/data', (req, res) => {
  res.json(cryptoData);
});

app.get('/api/market/chart/:symbol/:timeframe', (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    
    // Validate symbol
    if (!cryptoData[symbol]) {
      return res.status(404).json({ 
        error: 'Symbol not found',
        available_symbols: Object.keys(cryptoData)
      });
    }
    
    // Validate timeframe
    const validTimeframes = ['1h', '1d', '1w', '1m', '1y'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ 
        error: 'Invalid timeframe',
        valid_timeframes: validTimeframes
      });
    }
    
    const data = generateChartData(symbol, timeframe);
    
    res.json({
      symbol,
      timeframe,
      current_price: cryptoData[symbol].price,
      data: data,
      count: data.length,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ error: 'Failed to generate chart data' });
  }
});

// Real-time market data endpoint
app.get('/api/market/stream', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial data
  res.write(`data: ${JSON.stringify({ type: 'init', data: cryptoData })}\n\n`);
  
  // Send updates every 3 seconds
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'update', data: cryptoData, timestamp: Date.now() })}\n\n`);
  }, 3000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

// ========== TRANSACTION ROUTES ==========
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
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await dbQuery.get(
      `SELECT * FROM transactions WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// ========== WITHDRAWAL ROUTES ==========
app.post('/api/transactions/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount, network, wallet_address } = req.body;
    
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum withdrawal is $10' });
    if (amount > 50000) return res.status(400).json({ error: 'Maximum withdrawal is $50,000' });
    if (!network || !wallet_address) return res.status(400).json({ error: 'Network and wallet address required' });
    
    // Get user with balance
    const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (user.funding_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Calculate fees
    const networkFees = { 'BTC': 3.00, 'ETH': 8.00, 'USDT': 1.00 };
    const networkFee = networkFees[network] || 3.00;
    const processingFee = amount * 0.01;
    const totalFees = processingFee + networkFee;
    const receiveAmount = amount - totalFees;
    
    // Deduct from user balance immediately
    await dbQuery.run('UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?', 
      [amount, req.user.id]);
    
    // Create withdrawal transaction
    const result = await dbQuery.run(
      `INSERT INTO transactions (user_id, username, type, amount, fees, status, network, wallet_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.id, user.username, 'withdrawal', amount, totalFees, 'pending', network, wallet_address]
    );
    
    // Create notification for admin
    await createNotification(
      1, // Admin ID
      'info',
      '🔔 New Withdrawal Request',
      `${user.username} requested a withdrawal of $${amount.toFixed(2)} via ${network}`,
      { 
        transactionId: result.id, 
        userId: req.user.id, 
        username: user.username, 
        amount: amount, 
        network: network,
        wallet_address: wallet_address,
        action: 'review_withdrawal'
      }
    );
    
    // Create notification for user
    await createNotification(
      req.user.id,
      'info',
      '📤 Withdrawal Request Submitted',
      `Your withdrawal request of $${amount.toFixed(2)} has been submitted for admin approval.`,
      { 
        transactionId: result.id,
        amount: amount,
        network: network,
        wallet_address: wallet_address,
        fees: totalFees,
        receiveAmount: receiveAmount
      }
    );
    
    // Get updated balance
    const updatedUser = await dbQuery.get('SELECT funding_balance FROM users WHERE id = ?', [req.user.id]);
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted for admin approval',
      transactionId: result.id,
      amount,
      fees: totalFees,
      receiveAmount,
      funding_balance: updatedUser.funding_balance
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to create withdrawal request' });
  }
});

app.post('/api/transactions/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit is $10' });
    }
    
    if (amount > 100000) {
      return res.status(400).json({ error: 'Maximum deposit is $100,000' });
    }
    
    const bonus = amount >= 1000 ? amount * 0.05 : 0;
    
    const result = await dbQuery.run(
      `INSERT INTO transactions (user_id, username, type, amount, bonus, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.id, req.user.username, 'deposit', amount, bonus, 'pending']
    );
    
    // Create notification for admin
    await createNotification(
      1, // Admin user ID
      'info',
      'New Deposit Request',
      `${req.user.username} requested a deposit of $${amount.toFixed(2)}`,
      { transactionId: result.id, userId: req.user.id, username: req.user.username, amount: amount }
    );
    
    // Create notification for user
    await createNotification(
      req.user.id,
      'info',
      'Deposit Request Submitted',
      `Your deposit request of $${amount.toFixed(2)} has been submitted and is pending admin approval.`,
      { transactionId: result.id, amount: amount, bonus: bonus }
    );
    
    res.json({
      success: true,
      message: 'Deposit request submitted for admin approval',
      transactionId: result.id,
      amount,
      bonus,
      totalAmount: amount + bonus
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// ========== PORTFOLIO ROUTES ==========
app.get('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    const portfolio = await dbQuery.all(
      'SELECT * FROM portfolio WHERE user_id = ?',
      [req.user.id]
    );
    
    const updatedPortfolio = portfolio.map(item => {
      const currentPrice = cryptoData[item.coin_symbol]?.price || item.purchase_price;
      const currentValue = item.amount * currentPrice;
      const profitLoss = currentValue - (item.amount * item.purchase_price);
      const profitLossPercent = item.purchase_price > 0 ? 
        ((profitLoss / (item.amount * item.purchase_price)) * 100) : 0;
      
      return {
        ...item,
        current_price: currentPrice,
        current_value: parseFloat(currentValue.toFixed(2)),
        profit_loss: parseFloat(profitLoss.toFixed(2)),
        profit_loss_percent: parseFloat(profitLossPercent.toFixed(2))
      };
    });
    
    res.json(updatedPortfolio);
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// ========== TRADE ROUTES ==========
app.post('/api/trade', authenticateToken, async (req, res) => {
  try {
    const { type, symbol, amount, account_type, prediction } = req.body;
    const price = cryptoData[symbol]?.price;
    
    if (!price) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!['buy', 'sell'].includes(type)) {
      return res.status(400).json({ error: 'Invalid trade type' });
    }
    
    if (!['funding', 'demo'].includes(account_type)) {
      return res.status(400).json({ error: 'Invalid account type' });
    }
    
    const fee = amount * 0.001;
    
    if (type === 'buy') {
      return await buyTrade(req, res, symbol, amount, price, account_type, fee, prediction);
    } else {
      return await sellTrade(req, res, symbol, amount, price, account_type);
    }
  } catch (error) {
    console.error('Trade error:', error);
    res.status(500).json({ error: 'Trade execution failed' });
  }
});

async function buyTrade(req, res, symbol, amount, price, account_type, fee, prediction) {
  const totalCost = amount;
  
  // Get user with appropriate balance
  let user;
  if (account_type === 'demo') {
    user = await dbQuery.get(
      'SELECT demo_balance as balance FROM users WHERE id = ?',
      [req.user.id]
    );
  } else {
    user = await dbQuery.get(
      'SELECT funding_balance as balance FROM users WHERE id = ?',
      [req.user.id]
    );
  }
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (user.balance < totalCost) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  const coinAmount = (totalCost - fee) / price;
  
  // Update appropriate balance
  if (account_type === 'demo') {
    await dbQuery.run(
      'UPDATE users SET demo_balance = demo_balance - ? WHERE id = ?',
      [totalCost, req.user.id]
    );
  } else {
    await dbQuery.run(
      'UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?',
      [totalCost, req.user.id]
    );
  }
  
  // Create trade history entry
  const tradeResult = await dbQuery.run(
    `INSERT INTO trade_history 
     (user_id, coin_symbol, trade_type, amount, price, account_type, prediction, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, symbol, 'buy', coinAmount, price, account_type, prediction || 'up', 'open']
  );
  
  // Check for existing portfolio entry
  const existing = await dbQuery.get(
    'SELECT * FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?',
    [req.user.id, symbol, account_type]
  );
  
  if (existing) {
    const newAmount = existing.amount + coinAmount;
    const avgPrice = ((existing.amount * existing.purchase_price) + (coinAmount * price)) / newAmount;
    
    await dbQuery.run(
      `UPDATE portfolio SET 
       amount = ?,
       purchase_price = ?,
       current_value = ? * ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newAmount, avgPrice, newAmount, price, existing.id]
    );
  } else {
    await dbQuery.run(
      `INSERT INTO portfolio 
       (user_id, coin_symbol, amount, purchase_price, current_value, account_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, symbol, coinAmount, price, coinAmount * price, account_type]
    );
  }
  
  // Record transaction
  await dbQuery.run(
    `INSERT INTO transactions 
     (user_id, username, type, amount, fees, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.user.id, req.user.username, 'buy', totalCost, fee, 'completed']
  );
  
  // Get updated user data
  const updatedUser = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
  // Create notification for successful trade
  await createNotification(
    req.user.id,
    'success',
    'Trade Executed Successfully ✅',
    `You bought ${coinAmount.toFixed(6)} ${symbol} at $${price.toFixed(2)} for $${totalCost.toFixed(2)}`,
    { 
      tradeId: tradeResult.id,
      symbol: symbol,
      type: 'buy',
      amount: coinAmount,
      price: price,
      totalCost: totalCost,
      fee: fee
    }
  );
  
  // Emit balance update via socket
  if (req.app.get('socketio')) {
    req.app.get('socketio').to(`user_${req.user.id}`).emit('balance_update', {
      funding_balance: updatedUser.funding_balance,
      demo_balance: updatedUser.demo_balance
    });
  }
  
  res.json({
    success: true,
    message: `Bought ${coinAmount.toFixed(6)} ${symbol}`,
    coinAmount,
    totalCost,
    fee,
    funding_balance: updatedUser.funding_balance,
    demo_balance: updatedUser.demo_balance
  });
}

async function sellTrade(req, res, symbol, amount, price, account_type) {
  // Get holding for this account
  const holding = await dbQuery.get(
    'SELECT * FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?',
    [req.user.id, symbol, account_type]
  );
  
  if (!holding || holding.amount < amount) {
    return res.status(400).json({ error: 'Insufficient coins' });
  }
  
  const totalValue = amount * price;
  const fee = totalValue * 0.001;
  const receiveAmount = totalValue - fee;
  
  // Update trade history with result
  const tradeHistory = await dbQuery.get(
    'SELECT * FROM trade_history WHERE user_id = ? AND coin_symbol = ? AND status = "open" ORDER BY created_at DESC LIMIT 1',
    [req.user.id, symbol]
  );
  
  let profitLoss = 0;
  if (tradeHistory) {
    const predictionCorrect = (tradeHistory.prediction === 'up' && price > tradeHistory.price) || 
                             (tradeHistory.prediction === 'down' && price < tradeHistory.price);
    profitLoss = (price - tradeHistory.price) * amount;
    
    await dbQuery.run(
      `UPDATE trade_history SET 
       status = 'closed',
       result = ?,
       profit_loss = ?,
       closed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [predictionCorrect ? 'win' : 'loss', profitLoss, tradeHistory.id]
    );
  }
  
  // Update or delete portfolio
  if (holding.amount === amount) {
    await dbQuery.run('DELETE FROM portfolio WHERE id = ?', [holding.id]);
  } else {
    const newAmount = holding.amount - amount;
    await dbQuery.run(
      'UPDATE portfolio SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newAmount, holding.id]
    );
  }
  
  // Add to appropriate account
  if (account_type === 'demo') {
    await dbQuery.run(
      'UPDATE users SET demo_balance = demo_balance + ? WHERE id = ?',
      [receiveAmount, req.user.id]
    );
  } else {
    await dbQuery.run(
      'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
      [receiveAmount, req.user.id]
    );
  }
  
  // Record transaction
  await dbQuery.run(
    `INSERT INTO transactions 
     (user_id, username, type, amount, fees, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.user.id, req.user.username, 'sell', receiveAmount, fee, 'completed']
  );
  
  // Get updated user data
  const updatedUser = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
  // Create notification for successful trade
  const resultType = profitLoss > 0 ? 'success' : 'warning';
  const resultText = profitLoss > 0 ? 'Profit' : profitLoss < 0 ? 'Loss' : 'Break Even';
  
  await createNotification(
    req.user.id,
    resultType,
    'Trade Closed ✅',
    `You sold ${amount} ${symbol} at $${price.toFixed(2)} for $${receiveAmount.toFixed(2)} (${resultText}: $${Math.abs(profitLoss).toFixed(2)})`,
    { 
      symbol: symbol,
      type: 'sell',
      amount: amount,
      price: price,
      receiveAmount: receiveAmount,
      profitLoss: profitLoss,
      result: resultText.toLowerCase()
    }
  );
  
  // Emit balance update via socket
  if (req.app.get('socketio')) {
    req.app.get('socketio').to(`user_${req.user.id}`).emit('balance_update', {
      funding_balance: updatedUser.funding_balance,
      demo_balance: updatedUser.demo_balance
    });
  }
  
  res.json({
    success: true,
    message: `Sold ${amount} ${symbol} for $${receiveAmount.toFixed(2)}`,
    receiveAmount,
    fee,
    profitLoss,
    funding_balance: updatedUser.funding_balance,
    demo_balance: updatedUser.demo_balance
  });
}

// TRADE HISTORY ROUTE
app.get('/api/trade/history', authenticateToken, async (req, res) => {
  try {
    const history = await dbQuery.all(
      `SELECT th.*, 
              CASE 
                WHEN th.result = 'win' THEN 'Profit'
                WHEN th.result = 'loss' THEN 'Loss'
                ELSE 'Pending'
              END as status_text
       FROM trade_history th
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

// ========== CHAT ROUTES ==========
app.get('/api/chat/history', async (req, res) => {
  try {
    const messages = await dbQuery.all(
      'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 50'
    );
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// ========== ADMIN ROUTES ==========

// GET /api/admin/stats - Get admin dashboard stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
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

app.get('/api/admin/transactions/completed', authenticateAdmin, async (req, res) => {
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

// GET /api/admin/withdrawals - Get all withdrawals for admin
app.get('/api/admin/withdrawals', authenticateAdmin, async (req, res) => {
  try {
    const withdrawals = await dbQuery.all(
      `SELECT t.*, u.username, u.email, a.username as admin_username
       FROM transactions t 
       JOIN users u ON t.user_id = u.id 
       LEFT JOIN admins a ON t.admin_id = a.id
       WHERE t.type = 'withdrawal'
       ORDER BY t.created_at DESC
       LIMIT 100`
    );
    
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
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
  
  socket.on('get_market_data', () => {
    socket.emit('market_data', cryptoData);
  });
  
  socket.on('get_chart_data', ({ symbol, timeframe }) => {
    const data = generateChartData(symbol, timeframe);
    socket.emit('chart_data', { symbol, timeframe, data });
  });
  
  socket.on('chat_message', async (data) => {
    try {
      const result = await dbQuery.run(
        'INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)',
        [data.userId, data.username, data.message]
      );
      
      io.emit('new_chat_message', {
        id: result.id,
        userId: data.userId,
        username: data.username,
        message: data.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Chat message error:', error);
    }
  });
  
  socket.on('get_chat_history', async () => {
    try {
      const messages = await dbQuery.all(
        'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 50'
      );
      socket.emit('chat_history', messages.reverse());
    } catch (error) {
      console.error('Chat history error:', error);
    }
  });
  
  // Simulate random chat messages
  setInterval(() => {
    const messages = [
      "BTC looking bullish today!",
      "Just made 5% profit on ETH!",
      "Anyone trading DOGE?",
      "Market seems volatile today",
      "Great platform! Very user friendly",
      "Withdrawal processed in 2 hours!",
      "Learning a lot from demo trading",
      "Chart tools are excellent",
      "Made my first profit today!",
      "Support team is very responsive"
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const randomUsername = `Trader${Math.floor(Math.random() * 1000)}`;
    
    socket.emit('new_chat_message', {
      userId: 0,
      username: randomUsername,
      message: randomMessage,
      timestamp: new Date().toISOString()
    });
  }, 30000); // Every 30 seconds
  
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
        register: 'POST /api/auth/register',
        google: 'POST /api/auth/google',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/profile (Auth)',
        admin_login: 'POST /api/auth/admin/login'
      },
      market: {
        data: 'GET /api/market/data',
        chart: 'GET /api/market/chart/:symbol/:timeframe (1h,1d,1w,1m,1y)',
        stream: 'GET /api/market/stream (Auth)'
      },
      portfolio: 'GET /api/portfolio (Auth)',
      trade: {
        execute: 'POST /api/trade (Auth)',
        history: 'GET /api/trade/history (Auth)'
      },
      transactions: {
        list: 'GET /api/transactions (Auth)',
        deposit: 'POST /api/transactions/deposit (Auth)',
        withdraw: 'POST /api/transactions/withdraw (Auth)'
      },
      notifications: {
        list: 'GET /api/user/notifications (Auth)',
        send: 'POST /api/admin/notify-user (Admin)'
      },
      chat: 'GET /api/chat/history',
      admin: {
        stats: 'GET /api/admin/stats (Admin)',
        users: 'GET /api/admin/users (Admin)',
        withdrawals: {
          pending: 'GET /api/admin/withdrawals/pending (Admin)',
          all: 'GET /api/admin/withdrawals (Admin)',
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
  console.log(`🚀 QuantumCoin API v4.0 running on port ${PORT}`);
  console.log(`📊 Market Data: Live prices for ${Object.keys(cryptoData).length} coins`);
  console.log(`📈 Chart Data: Fixed and working for all timeframes`);
  console.log(`🔗 API available at: http://localhost:${PORT}/api`);
  console.log(`📡 WebSocket: Real-time updates enabled`);
  console.log(`👑 Admin login: admin / admin123`);
  console.log(`👤 User login: testuser / password123`);
  console.log(`💰 Test user funding balance: $5,000.00`);
  console.log(`🔔 Notification System: Active`);
  console.log(`💸 Withdrawal System: Complete`);
  console.log(`💡 Features:`);
  console.log(`   • Complete notification system`);
  console.log(`   • Fixed chart data generation`);
  console.log(`   • Real-time market updates`);
  console.log(`   • WebSocket support`);
  console.log(`   • Admin approval system`);
  console.log(`   • Live chat system`);
  console.log(`   • Complete withdrawal management`);
});

module.exports = { app, server };
