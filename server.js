// server.js - QuantumCoin API Backend (Modified without JWT) - FIXED VERSION
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
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api', (req, res) => {
  res.json({
    status: "OK",
    message: "QuantumCoin API is running 🚀",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      market: "/api/market",
      trade: "/api/trade",
      transactions: "/api/transactions",
      portfolio: "/api/portfolio",
      admin: "/api/admin"
    }
  });
});

// Database setup
const db = new sqlite3.Database(':memory:'); // Use in-memory for simplicity

// Initialize database
function initDatabase() {
  db.serialize(() => {
    // Users table - MODIFIED: funding_balance starts at 0 for new accounts
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      funding_balance REAL DEFAULT 0.00,  // CHANGED: Start at 0 for new accounts
      demo_balance REAL DEFAULT 100000.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`);

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
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
      account_type TEXT DEFAULT 'funding',  // ADDED: Track which account was used
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Trade history table (for storing predictions and results)
    db.run(`CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_symbol TEXT NOT NULL,
      trade_type TEXT NOT NULL,  // 'buy' or 'sell'
      amount REAL NOT NULL,
      price REAL NOT NULL,
      account_type TEXT NOT NULL,  // 'funding' or 'demo'
      prediction TEXT,  // 'up' or 'down'
      result TEXT,  // 'win' or 'loss'
      profit_loss REAL,
      status TEXT DEFAULT 'open',  // 'open', 'closed', 'expired'
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

    // Insert default user if not exists (with 0 funding balance)
    const userPassword = bcrypt.hashSync('password123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)`, 
      ['testuser', 'test@quantumcoin.com', userPassword, 0.00, 100000.00]);

    // Insert initial chat messages
    const initialMessages = [

[1,'AltcoinAce','Just closed a $320 profit on SOL. Loving the speed!'],
[1,'BlockMaster','Charts load instantly, very smooth experience'],
[1,'CryptoWolf','Withdrew $1,200 today, no stress at all'],
[1,'ChainGuru','Made $780 trading BTC volatility'],
[1,'BullRunBen','Caught the pump early, $450 profit'],
[1,'BearTrap','Lost $150 but risk management saved me'],
[1,'TokenQueen','UI feels premium, very easy to use'],
[1,'SatoshiLite','First trade ever, made $90 profit'],
[1,'PumpRider','DOGE run gave me $600 gains'],
[1,'ChartSniper','Indicators are very accurate'],
[1,'EtherLord','ETH breakout earned me $1,050'],
[1,'QuickFlip','Scalped $210 in under 10 minutes'],
[1,'MarginMike','Leverage tools are well designed'],
[1,'HodlKing','Holding long-term, platform feels safe'],
[1,'GreenCandle','Account went green today, $340 up'],
[1,'RedCandle','Small loss today, but learned a lot'],
[1,'TradeSensei','Best order execution I’ve seen'],
[1,'CryptoNova','Withdrew $900 successfully'],
[1,'WhaleWatcher','Market depth feature is amazing'],
[1,'FastHands','Instant buy/sell, no lag'],
[1,'Trader21','Closed $280 profit on BTC'],
[1,'Trader22','Smooth withdrawal process'],
[1,'Trader23','Charts feel professional'],
[1,'Trader24','Quick execution, very impressed'],
[1,'Trader25','Made $510 trading ETH'],
[1,'Trader26','Low fees compared to others'],
[1,'Trader27','UI is clean and simple'],
[1,'Trader28','Risk tools saved my account'],
[1,'Trader29','Took $430 profit today'],
[1,'Trader30','Everything works perfectly'],
[1,'Trader31','Good experience so far'],
[1,'Trader32','Withdraw completed fast'],
[1,'Trader33','Platform feels legit'],
[1,'Trader34','Nice profit run today'],
[1,'Trader35','Charts update instantly'],
[1,'Trader36','Very beginner friendly'],
[1,'Trader37','Execution speed is great'],
[1,'Trader38','Market data looks accurate'],
[1,'Trader39','Account balance increasing'],
[1,'Trader40','Happy with performance'],
[1,'Trader41','Made $190 profit'],
[1,'Trader42','Lost a bit but recovered'],
[1,'Trader43','Solid trading tools'],
[1,'Trader44','BTC trades are smooth'],
[1,'Trader45','Fast order fills'],
[1,'Trader46','No lag noticed'],
[1,'Trader47','Easy withdrawals'],
[1,'Trader48','Nice clean dashboard'],
[1,'Trader49','Trading feels safe'],
[1,'Trader50','Good overall experience'],
[1,'Trader51','Closed green today'],
[1,'Trader52','ETH scalps working well'],
[1,'Trader53','Very responsive charts'],
[1,'Trader54','No crashes so far'],
[1,'Trader55','Simple and effective'],
[1,'Trader56','Withdrew without issues'],
[1,'Trader57','Good risk management'],
[1,'Trader58','Made steady profits'],
[1,'Trader59','Smooth navigation'],
[1,'Trader60','Satisfied user'],
[1,'Trader61','BTC breakout paid off'],
[1,'Trader62','Quick deposit approval'],
[1,'Trader63','Platform is stable'],
[1,'Trader64','Clear price action'],
[1,'Trader65','Small wins add up'],
[1,'Trader66','Good stop loss tools'],
[1,'Trader67','No hidden fees'],
[1,'Trader68','Easy to understand'],
[1,'Trader69','Made $360 today'],
[1,'Trader70','Everything looks good'],
[1,'Trader71','Charts are sharp'],
[1,'Trader72','Nice execution speed'],
[1,'Trader73','Account growing slowly'],
[1,'Trader74','Works as expected'],
[1,'Trader75','Very smooth trades'],
[1,'Trader76','Market depth is helpful'],
[1,'Trader77','Profits came in'],
[1,'Trader78','Withdraw successful'],
[1,'Trader79','UI feels modern'],
[1,'Trader80','Reliable platform'],
[1,'Trader81','BTC scalp worked'],
[1,'Trader82','ETH trade went green'],
[1,'Trader83','Fast confirmations'],
[1,'Trader84','No complaints so far'],
[1,'Trader85','Easy to trade'],
[1,'Trader86','Good indicators'],
[1,'Trader87','Quick response time'],
[1,'Trader88','Funds safe here'],
[1,'Trader89','Nice profit margin'],
[1,'Trader90','Stable experience'],
[1,'Trader91','DOGE pump paid'],
[1,'Trader92','Clean charts'],
[1,'Trader93','Simple layout'],
[1,'Trader94','Good trading engine'],
[1,'Trader95','No slippage noticed'],
[1,'Trader96','Withdrew profits today'],
[1,'Trader97','Very smooth'],
[1,'Trader98','Nice balance growth'],
[1,'Trader99','Trades executed fast'],
[1,'Trader100','Happy trader'],
[1,'Trader101','All good here'],
[1,'Trader102','Trading daily'],
[1,'Trader103','No issues'],
[1,'Trader104','Good platform'],
[1,'Trader105','Solid performance'],
[1,'Trader106','Charts load fast'],
[1,'Trader107','Easy withdrawals'],
[1,'Trader108','Consistent profits'],
[1,'Trader109','User friendly'],
[1,'Trader110','Reliable'],
[1,'Trader291','Everything works fine'],
[1,'Trader292','Smooth trades'],
[1,'Trader293','No errors seen'],
[1,'Trader294','Fast execution'],
[1,'Trader295','Withdraw OK'],
[1,'Trader296','Charts are clean'],
[1,'Trader297','Good experience'],
[1,'Trader298','Stable platform'],
[1,'Trader299','Trading feels safe'],
[1,'Trader300','Satisfied overall']
    ];

    db.run(`DELETE FROM chat_messages`);
    initialMessages.forEach(msg => {
      db.run(`INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)`, msg);
    });
    
    console.log('✅ Database initialized');
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

// Simple session storage (replacing JWT)
const sessions = new Map();

// Authentication middleware (simplified without JWT)
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  req.user = session.user;
  next();
}

function authenticateAdmin(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  const session = sessions.get(token);
  if (!session || !session.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.user = session.user;
  next();
}

// Market Data Simulation
let cryptoData = {
  BTC: { name: 'Bitcoin', price: 42869.29, change: 5.32, volume: 24500000000, color: '#f7931a' },
  ETH: { name: 'Ethereum', price: 2350.45, change: 3.21, volume: 9800000000, color: '#627eea' },
  DOGE: { name: 'Dogecoin', price: 0.089, change: 12.45, volume: 1200000000, color: '#c2a633' },
  SHIB: { name: 'Shiba Inu', price: 0.00000876, change: 23.67, volume: 480000000, color: '#ff00c8' },
  ADA: { name: 'Cardano', price: 0.52, change: -1.23, volume: 320000000, color: '#0033ad' },
  SOL: { name: 'Solana', price: 95.67, change: 7.89, volume: 2100000000, color: '#00ffa3' },
  XRP: { name: 'Ripple', price: 0.62, change: 0.45, volume: 1800000000, color: '#23292f' },
  BNB: { name: 'Binance Coin', price: 310.25, change: 2.34, volume: 1500000000, color: '#f0b90b' }
};

// Simulate market updates
function updateMarketPrices() {
  for (const coin in cryptoData) {
    const volatility = coin === 'DOGE' || coin === 'SHIB' ? 0.05 : 0.02;
    const changePercent = (Math.random() * volatility * 2) - volatility;
    cryptoData[coin].price *= (1 + changePercent);
    cryptoData[coin].change = changePercent * 100;
    cryptoData[coin].volume *= (1 + Math.random() * 0.1 - 0.05);
  }
  io.emit('market_update', cryptoData);
}

// Update prices every 3 seconds
setInterval(updateMarketPrices, 3000);

// Generate chart data
function generateChartData(symbol, timeframe) {
  const basePrice = cryptoData[symbol]?.price || 1000;
  const volatility = Math.abs(cryptoData[symbol]?.change / 100) || 0.02;
  const data = [];
  
  let points = 50;
  let timeUnit = 'minutes';
  
  switch(timeframe) {
    case '1h': points = 60; timeUnit = 'minutes'; break;
    case '1d': points = 24; timeUnit = 'hours'; break;
    case '1w': points = 7; timeUnit = 'days'; break;
    case '1m': points = 30; timeUnit = 'days'; break;
    case '1y': points = 12; timeUnit = 'months'; break;
  }
  
  let currentPrice = basePrice;
  let currentTime = moment().subtract(points, timeUnit);
  
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * volatility;
    const newPrice = currentPrice * (1 + change);
    
    data.push({
      time: currentTime.valueOf(),
      open: currentPrice,
      high: Math.max(currentPrice, newPrice) * (1 + Math.random() * volatility * 0.5),
      low: Math.min(currentPrice, newPrice) * (1 - Math.random() * volatility * 0.5),
      close: newPrice,
      volume: Math.random() * 1000000 + 500000
    });
    
    currentPrice = newPrice;
    currentTime = currentTime.add(1, timeUnit);
  }
  
  return data;
}

// ==================== API ROUTES ====================

// AUTH ROUTES (Modified without JWT)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await dbQuery.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await dbQuery.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    // Create simple session token
    const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
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
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await dbQuery.run(
      'INSERT INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 0.00, 100000.00]  // Funding starts at 0
    );
    
    // Create simple session token
    const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: result.id,
        username: username,
        email: email,
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
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Google Auth Route
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
      // Create new user with 0 funding balance
      const hashedPassword = bcrypt.hashSync(Date.now().toString(), 10);
      const result = await dbQuery.run(
        'INSERT INTO users (username, email, password, funding_balance, demo_balance) VALUES (?, ?, ?, ?, ?)',
        [username, email, hashedPassword, 0.00, 100000.00]  // Funding starts at 0
      );
      
      user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [result.id]);
    }
    
    // Update last login
    await dbQuery.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    // Create simple session token
    const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(token, { 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
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
  const token = req.headers['authorization'];
  if (token) {
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
    
    // Create simple session token
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

// MARKET DATA ROUTES
app.get('/api/market/data', (req, res) => {
  res.json(cryptoData);
});

app.get('/api/market/chart/:symbol/:timeframe', (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const data = generateChartData(symbol, timeframe);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate chart data' });
  }
});

// PORTFOLIO ROUTES
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
      const profitLossPercent = ((profitLoss / (item.amount * item.purchase_price)) * 100);
      
      return {
        ...item,
        current_price: currentPrice,
        current_value: currentValue,
        profit_loss: profitLoss,
        profit_loss_percent: profitLossPercent
      };
    });
    
    res.json(updatedPortfolio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// TRANSACTION ROUTES
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await dbQuery.all(
      `SELECT * FROM transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit is $10' });
    }
    
    if (amount > 100000) {
      return res.status(400).json({ error: 'Maximum deposit is $100,000' });
    }
    
    const bonus = amount >= 1000 ? amount * 0.05 : 0;
    
    const result = await dbQuery.run(
      `INSERT INTO transactions 
       (user_id, type, amount, bonus, status, created_at) 
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.id, 'deposit', amount, bonus, 'pending']
    );
    
    res.json({
      success: true,
      message: 'Deposit request submitted',
      transactionId: result.id,
      amount,
      bonus,
      totalAmount: amount + bonus
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

app.post('/api/transactions/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount, network, wallet_address } = req.body;
    
    if (amount < 10) {
      return res.status(400).json({ error: 'Minimum withdrawal is $10' });
    }
    
    if (amount > 50000) {
      return res.status(400).json({ error: 'Maximum withdrawal is $50,000' });
    }
    
    const user = await dbQuery.get(
      'SELECT funding_balance FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (user.funding_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const fees = {
      'BTC': 3.00,
      'ETH': 8.00,
      'USDT': 1.00
    }[network] || 3.00;
    
    const processingFee = amount * 0.01;
    const totalFees = processingFee + fees;
    const receiveAmount = amount - totalFees;
    
    const result = await dbQuery.run(
      `INSERT INTO transactions 
       (user_id, type, amount, fees, status, network, wallet_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.id, 'withdrawal', amount, totalFees, 'pending', network, wallet_address]
    );
    
    await dbQuery.run(
      'UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?',
      [amount, req.user.id]
    );
    
    const updatedUser = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted',
      transactionId: result.id,
      amount,
      fees: totalFees,
      receiveAmount,
      funding_balance: updatedUser.funding_balance
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create withdrawal request' });
  }
});

// TRADE ROUTES (Modified for prediction-based trading)
app.post('/api/trade', authenticateToken, async (req, res) => {
  try {
    const { type, symbol, amount, account_type, prediction } = req.body;
    const price = cryptoData[symbol]?.price;
    
    if (!price) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const balanceColumn = account_type === 'demo' ? 'demo_balance' : 'funding_balance';
    const fee = amount * 0.001;
    
    if (type === 'buy') {
      return await buyTrade(req, res, symbol, amount, price, balanceColumn, fee, account_type, prediction);
    } else if (type === 'sell') {
      return await sellTrade(req, res, symbol, amount, price, account_type);
    } else {
      return res.status(400).json({ error: 'Invalid trade type' });
    }
  } catch (error) {
    console.error('Trade error:', error);
    res.status(500).json({ error: 'Trade execution failed' });
  }
});

async function buyTrade(req, res, symbol, amount, price, balanceColumn, fee, account_type, prediction) {
  const totalCost = amount;
  
  const user = await dbQuery.get(
    `SELECT ${balanceColumn} as balance FROM users WHERE id = ?`,
    [req.user.id]
  );
  
  if (user.balance < totalCost) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  const coinAmount = (totalCost - fee) / price;
  
  // FIXED: Use proper SQL syntax for updating balance
  if (balanceColumn === 'demo_balance') {
    await dbQuery.run(
      `UPDATE users SET demo_balance = demo_balance - ? WHERE id = ?`,
      [totalCost, req.user.id]
    );
  } else {
    await dbQuery.run(
      `UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?`,
      [totalCost, req.user.id]
    );
  }
  
  // Create trade history entry for prediction
  await dbQuery.run(
    `INSERT INTO trade_history 
     (user_id, coin_symbol, trade_type, amount, price, account_type, prediction, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, symbol, 'buy', coinAmount, price, account_type, prediction || 'up', 'open']
  );
  
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
  
  await dbQuery.run(
    `INSERT INTO transactions 
     (user_id, type, amount, fees, status, created_at) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.user.id, 'buy', totalCost, fee, 'completed']
  );
  
  const updatedUser = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
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
  
  if (tradeHistory) {
    const predictionCorrect = (tradeHistory.prediction === 'up' && price > tradeHistory.price) || 
                             (tradeHistory.prediction === 'down' && price < tradeHistory.price);
    const profitLoss = (price - tradeHistory.price) * amount;
    
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
  
  await dbQuery.run(
    `INSERT INTO transactions 
     (user_id, type, amount, fees, status, created_at) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.user.id, 'sell', receiveAmount, fee, 'completed']
  );
  
  const updatedUser = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
  res.json({
    success: true,
    message: `Sold ${amount} ${symbol} for $${receiveAmount.toFixed(2)}`,
    receiveAmount,
    fee,
    funding_balance: updatedUser.funding_balance,
    demo_balance: updatedUser.demo_balance
  });
}

// TRADE HISTORY ROUTE (Added for dashboard)
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

// ADMIN ROUTES
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

app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as total_users FROM users',
      'SELECT COUNT(*) as active_today FROM users WHERE last_login > datetime("now", "-1 day")',
      'SELECT SUM(funding_balance) as total_funding FROM users',
      'SELECT SUM(demo_balance) as total_demo FROM users',
      'SELECT COUNT(*) as pending_deposits FROM transactions WHERE type = "deposit" AND status = "pending"',
      'SELECT SUM(amount) as pending_deposit_amount FROM transactions WHERE type = "deposit" AND status = "pending"',
      'SELECT COUNT(*) as pending_withdrawals FROM transactions WHERE type = "withdrawal" AND status = "pending"',
      'SELECT SUM(amount) as pending_withdrawal_amount FROM transactions WHERE type = "withdrawal" AND status = "pending"'
    ];
    
    const stats = {};
    
    for (const query of queries) {
      const result = await dbQuery.get(query);
      Object.assign(stats, result);
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
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

app.post('/api/admin/transactions/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const transaction = await dbQuery.get(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.type === 'deposit') {
      await dbQuery.run(
        `UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?`,
        [transaction.amount + (transaction.bonus || 0), transaction.user_id]
      );
    }
    
    await dbQuery.run(
      `UPDATE transactions SET 
       status = 'completed',
       admin_approved = 1,
       admin_id = ?,
       notes = ?,
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
    const { notes } = req.body;
    
    const transaction = await dbQuery.get(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.type === 'withdrawal') {
      await dbQuery.run(
        'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
        [transaction.amount, transaction.user_id]
      );
    }
    
    await dbQuery.run(
      `UPDATE transactions SET 
       status = 'rejected',
       admin_approved = 0,
       admin_id = ?,
       notes = ?,
       completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, notes || 'Rejected by admin', id]
    );
    
    res.json({ success: true, message: 'Transaction rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject transaction' });
  }
});

// CHAT ROUTES
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

// WebSocket connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });
  
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });
  
  socket.on('chat_message', async (data) => {
    const { userId, username, message } = data;
    
    if (!userId || !username || !message) {
      return;
    }
    
    try {
      const result = await dbQuery.run(
        'INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)',
        [userId, username, message]
      );
      
      const chatMessage = {
        id: result.id,
        userId,
        username,
        message,
        timestamp: new Date().toISOString()
      };
      
      io.emit('new_chat_message', chatMessage);
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
  
  // Simulate chat messages from other users (every 60 seconds)
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
  }, 60000); // Every 60 seconds
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

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

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    available_endpoints: {
      health: 'GET /api',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        google: 'POST /api/auth/google',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/profile',
        admin_login: 'POST /api/auth/admin/login'
      },
      market: {
        data: 'GET /api/market/data',
        chart: 'GET /api/market/chart/:symbol/:timeframe'
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
      chat: 'GET /api/chat/history',
      admin: 'Various routes (Admin Auth)'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// Initialize and start server
initDatabase();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 QuantumCoin API running on port ${PORT}`);
  console.log(`📊 Admin login: admin / admin123`);
  console.log(`👤 User login: testuser / password123`);
  console.log(`🔗 API available at: http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend URL: https://quantumcoin.com.ng`);
  console.log(`💡 Modifications made:`);
  console.log(`   • Removed JWT authentication`);
  console.log(`   • New accounts start with $0 funding balance`);
  console.log(`   • Added prediction-based trading`);
  console.log(`   • Live chat messages every 60 seconds`);
  console.log(`   • Sell function properly adds to correct account`);
});

module.exports = { app, server };
