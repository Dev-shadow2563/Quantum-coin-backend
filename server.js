const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const cron = require('node-cron');

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
app.use(express.static('.')); // Serve files from current directory

// Database setup
const db = new sqlite3.Database('./quantumcoin.db');

// Initialize database
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    funding_balance REAL DEFAULT 3506.83,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
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
    ['testuser', 'test@quantumcoin.com', userPassword, 5000, 100000]);

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
  [1, 'TradeSensei', 'Best order execution I’ve seen'],
  [1, 'CryptoNova', 'Withdrew $900 successfully'],
  [1, 'WhaleWatcher', 'Market depth feature is amazing'],
  [1, 'FastHands', 'Instant buy/sell, no lag'],
  [1, 'ProfitPilot', 'Hit my daily target, $500 done'],
  [1, 'DustCollector', 'Turned small balance into $120'],
  [1, 'MoonRacer', 'Almost liquidated but recovered nicely'],
  [1, 'RiskManager', 'Stop-loss saved me from a $400 loss'],
  [1, 'SmartTrader', 'Very beginner friendly interface'],
  [1, 'CoinSeeker', 'Found new tokens easily here'],
  [1, 'BitMiner', 'BTC fees are fair compared to others'],
  [1, 'AlphaTrader', 'Consistent profits all week'],
  [1, 'ZenTrader', 'Calm trading experience, no clutter'],
  [1, 'FlashTrade', 'Executed trades instantly'],
  [1, 'CryptoSam', 'Made $260 flipping SOL'],
  [1, 'BullishBob', 'Feeling bullish after today’s gains'],
  [1, 'SteadyEarner', 'Slow but steady $180 profit'],
  [1, 'NightTrader', 'Late-night trades worked out well'],
  [1, 'TokenFlip', 'Quick $75 flip'],
  [1, 'DeepChart', 'Advanced chart tools are solid'],
  [1, 'ProfitFlow', 'Cash flow is consistent here'],
  [1, 'MarketMind', 'Very transparent pricing'],
  [1, 'TradeWave', 'Rode the wave for $390 profit'],
  [1, 'CryptoEdge', 'This platform gives real edge'],
  [1, 'VolumeKing', 'Volume spikes are easy to spot'],
  [1, 'TrendHunter', 'Trend lines work perfectly'],
  [1, 'CoinFlip', 'Win some, lose some — fair system'],
  [1, 'StableStack', 'Low volatility trades worked'],
  [1, 'RiskTaker', 'High risk paid off, $1,300 profit'],
  [1, 'SafePlay', 'Conservative trading but consistent'],
  [1, 'ProfitStacker', 'Stacking profits daily'],
  [1, 'TradePilot', 'Navigation is super intuitive'],
  [1, 'SignalHunter', 'Signals helped a lot'],
  [1, 'CryptoJet', 'Fastest platform I’ve used'],
  [1, 'MarketAce', 'Market orders execute cleanly'],
  [1, 'CoinWizard', 'Feels like pro trading software'],
  [1, 'DeltaTrader', 'Delta tracking is accurate'],
  [1, 'WalletPro', 'Deposit and withdrawal are smooth'],
  [1, 'ExitPerfect', 'Exited at the top perfectly'],
  [1, 'EntryKing', 'Entry points are easy to plan'],
  [1, 'CryptoDash', 'Dashboard layout is clean'],
  [1, 'ProfitTrail', 'Trailing stops work great'],
  [1, 'TradeStorm', 'High volatility handled well'],
  [1, 'CoinRunner', 'Ran profits up to $640'],
  [1, 'LongGame', 'Long trades feel secure'],
  [1, 'ShortKing', 'Shorted BTC for $520 gain'],
  [1, 'PriceAction', 'Price action is very clear'],
  [1, 'CryptoLane', 'Everything is well organized'],
  [1, 'MarginSafe', 'Margin system feels controlled'],
  [1, 'DailyTrader', 'Daily trading made easy'],
  [1, 'SwingPro', 'Swing trade paid $870'],
  [1, 'QuickExit', 'Fast exit saved profits'],
  [1, 'ChartFocus', 'No distractions on charts'],
  [1, 'TradeLogic', 'Logic-based trading works here'],
  [1, 'CryptoRay', 'Bright future for this platform'],
  [1, 'OrderBook', 'Order book depth is impressive'],
  [1, 'ProfitRush', 'Rush hour trading went well'],
  [1, 'CoinSense', 'Makes sense even for beginners'],
  [1, 'TrendBreaker', 'Broke resistance, nice gains'],
  [1, 'CryptoPulse', 'Market pulse is easy to read'],
  [1, 'SmartExit', 'Exited with profit before dump'],
  [1, 'TradeFlow', 'Everything flows smoothly'],
  [1, 'CryptoPeak', 'Peak performance trading'],
  [1, 'BalanceGrow', 'Account balance growing steadily'],
  [1, 'HypeFree', 'No fake hype, just real trading'],
  [1, 'ProfitMind', 'Mindset + platform = profits'],
  [1, 'CoinMaster', 'Feels like a pro exchange'],
  [1, 'TradeVision', 'Clear vision on every trade'],
  [1, 'CryptoPath', 'Best path for serious traders']
  ];

  db.run(`DELETE FROM chat_messages`);
  initialMessages.forEach(msg => {
    db.run(`INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)`, msg);
  });
});

// JWT Secret
const JWT_SECRET = 'quantumcoin-jwt-secret-2024';

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

// Authentication middleware
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Admin authentication middleware
function authenticateAdmin(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const admin = jwt.verify(token, JWT_SECRET);
    if (!admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Routes

// User login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: false },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
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
  });
});

// User registration
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    [username, email, hashedPassword],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
      
      const token = jwt.sign(
        { id: this.lastID, username: username, isAdmin: false },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({
        token,
        user: {
          id: this.lastID,
          username,
          email,
          funding_balance: 3506.83,
          demo_balance: 100000.00
        }
      });
    }
  );
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
    if (err || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = bcrypt.compareSync(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: admin.id, username: admin.username, isAdmin: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, admin: { id: admin.id, username: admin.username } });
  });
});

// Get market data
app.get('/api/market-data', (req, res) => {
  res.json(cryptoData);
});

// Get chart data
app.get('/api/chart-data/:symbol/:timeframe', (req, res) => {
  const { symbol, timeframe } = req.params;
  const data = generateChartData(symbol, timeframe);
  res.json(data);
});

// Get user portfolio
app.get('/api/portfolio', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM portfolio WHERE user_id = ?',
    [req.user.id],
    (err, portfolio) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(portfolio);
    }
  );
});

// Get user transactions
app.get('/api/transactions', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM transactions 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [req.user.id],
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(transactions);
    }
  );
});

// Get user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, email, funding_balance, demo_balance, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    }
  );
});

// Create deposit request
app.post('/api/deposit', authenticateToken, (req, res) => {
  const { amount } = req.body;
  
  if (amount < 10) {
    return res.status(400).json({ error: 'Minimum deposit is $10' });
  }
  
  if (amount > 100000) {
    return res.status(400).json({ error: 'Maximum deposit is $100,000' });
  }
  
  const bonus = amount >= 1000 ? amount * 0.05 : 0;
  
  db.run(
    `INSERT INTO transactions 
     (user_id, type, amount, bonus, status, created_at) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.user.id, 'deposit', amount, bonus, 'pending'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create deposit request' });
      }
      
      res.json({
        success: true,
        message: 'Deposit request submitted',
        transactionId: this.lastID,
        amount,
        bonus,
        totalAmount: amount + bonus
      });
    }
  );
});

// Create withdrawal request
app.post('/api/withdraw', authenticateToken, (req, res) => {
  const { amount, network, wallet_address } = req.body;
  
  // Validate
  if (amount < 10) {
    return res.status(400).json({ error: 'Minimum withdrawal is $10' });
  }
  
  if (amount > 50000) {
    return res.status(400).json({ error: 'Maximum withdrawal is $50,000' });
  }
  
  // Check user balance
  db.get(
    'SELECT funding_balance FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: 'User not found' });
      }
      
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
      
      db.run(
        `INSERT INTO transactions 
         (user_id, type, amount, fees, status, network, wallet_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.user.id, 'withdrawal', amount, totalFees, 'pending', network, wallet_address],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create withdrawal request' });
          }
          
          // Deduct from balance immediately
          db.run(
            'UPDATE users SET funding_balance = funding_balance - ? WHERE id = ?',
            [amount, req.user.id]
          );
          
          // Update user in database
          db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, updatedUser) => {
            if (!err && updatedUser) {
              io.to(`user_${req.user.id}`).emit('balance_update', {
                funding_balance: updatedUser.funding_balance
              });
            }
          });
          
          res.json({
            success: true,
            message: 'Withdrawal request submitted',
            transactionId: this.lastID,
            amount,
            fees: totalFees,
            receiveAmount
          });
        }
      );
    }
  );
});

// Execute trade
app.post('/api/trade', authenticateToken, (req, res) => {
  const { type, symbol, amount, account_type } = req.body;
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
    const totalCost = amount;
    
    db.get(
      `SELECT ${balanceColumn} as balance FROM users WHERE id = ?`,
      [req.user.id],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (user.balance < totalCost) {
          return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        const coinAmount = (totalCost - fee) / price;
        
        // Update balance
        db.run(
          `UPDATE users SET ${balanceColumn} = ${balanceColumn} - ? WHERE id = ?`,
          [totalCost, req.user.id]
        );
        
        // Add to portfolio or update existing
        db.get(
          'SELECT * FROM portfolio WHERE user_id = ? AND coin_symbol = ?',
          [req.user.id, symbol],
          (err, existing) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (existing) {
              const newAmount = existing.amount + coinAmount;
              const avgPrice = ((existing.amount * existing.purchase_price) + (coinAmount * price)) / newAmount;
              
              db.run(
                `UPDATE portfolio SET 
                 amount = ?,
                 purchase_price = ?,
                 current_value = ? * ?,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [newAmount, avgPrice, newAmount, price, existing.id]
              );
            } else {
              db.run(
                `INSERT INTO portfolio 
                 (user_id, coin_symbol, amount, purchase_price, current_value) 
                 VALUES (?, ?, ?, ?, ?)`,
                [req.user.id, symbol, coinAmount, price, coinAmount * price]
              );
            }
            
            // Record transaction
            db.run(
              `INSERT INTO transactions 
               (user_id, type, amount, fees, status, created_at) 
               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [req.user.id, 'buy', totalCost, fee, 'completed']
            );
            
            // Get updated user data
            db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, updatedUser) => {
              if (!err && updatedUser) {
                io.to(`user_${req.user.id}`).emit('balance_update', {
                  funding_balance: updatedUser.funding_balance,
                  demo_balance: updatedUser.demo_balance
                });
                
                res.json({
                  success: true,
                  message: `Bought ${coinAmount.toFixed(6)} ${symbol}`,
                  coinAmount,
                  totalCost,
                  newBalance: updatedUser[balanceColumn]
                });
              }
            });
          }
        );
      }
    );
    
  } else if (type === 'sell') {
    // Sell logic
    db.get(
      'SELECT * FROM portfolio WHERE user_id = ? AND coin_symbol = ?',
      [req.user.id, symbol],
      (err, holding) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!holding || holding.amount < amount) {
          return res.status(400).json({ error: 'Insufficient coins' });
        }
        
        const totalValue = amount * price;
        const receiveAmount = totalValue - fee;
        
        // Update portfolio
        if (holding.amount === amount) {
          db.run('DELETE FROM portfolio WHERE id = ?', [holding.id]);
        } else {
          const newAmount = holding.amount - amount;
          db.run(
            'UPDATE portfolio SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newAmount, holding.id]
          );
        }
        
        // Update balance (always goes to funding account)
        db.run(
          'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
          [receiveAmount, req.user.id]
        );
        
        // Record transaction
        db.run(
          `INSERT INTO transactions 
           (user_id, type, amount, fees, status, created_at) 
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [req.user.id, 'sell', receiveAmount, fee, 'completed']
        );
        
        // Get updated user data
        db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, updatedUser) => {
          if (!err && updatedUser) {
            io.to(`user_${req.user.id}`).emit('balance_update', {
              funding_balance: updatedUser.funding_balance,
              demo_balance: updatedUser.demo_balance
            });
            
            res.json({
              success: true,
              message: `Sold ${amount} ${symbol} for $${receiveAmount.toFixed(2)}`,
              receiveAmount,
              newBalance: updatedUser.funding_balance
            });
          }
        });
      }
    );
  }
});

// Admin routes

// Get all pending transactions
app.get('/api/admin/transactions/pending', authenticateAdmin, (req, res) => {
  db.all(
    `SELECT t.*, u.username, u.email 
     FROM transactions t 
     JOIN users u ON t.user_id = u.id 
     WHERE t.status = 'pending' 
     ORDER BY t.created_at DESC`,
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(transactions);
    }
  );
});

// Get all users
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  db.all(
    `SELECT id, username, email, funding_balance, demo_balance, 
            created_at, last_login, is_active 
     FROM users 
     ORDER BY created_at DESC`,
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    }
  );
});

// Get dashboard stats
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
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
  
  function executeQuery(index) {
    if (index >= queries.length) {
      res.json(stats);
      return;
    }
    
    db.get(queries[index], (err, result) => {
      if (!err && result) {
        Object.assign(stats, result);
      }
      executeQuery(index + 1);
    });
  }
  
  executeQuery(0);
});

// Get completed transactions
app.get('/api/admin/transactions/completed', authenticateAdmin, (req, res) => {
  db.all(
    `SELECT t.*, u.username, u.email, a.username as admin_username
     FROM transactions t 
     JOIN users u ON t.user_id = u.id 
     LEFT JOIN admins a ON t.admin_id = a.id
     WHERE t.status IN ('completed', 'rejected')
     ORDER BY t.completed_at DESC
     LIMIT 50`,
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(transactions);
    }
  );
});

// Approve transaction
app.post('/api/admin/transactions/:id/approve', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  db.get(
    'SELECT * FROM transactions WHERE id = ?',
    [id],
    (err, transaction) => {
      if (err || !transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      if (transaction.type === 'deposit') {
        // Add funds to user account (including bonus)
        db.run(
          `UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?`,
          [transaction.amount + (transaction.bonus || 0), transaction.user_id]
        );
      }
      // For withdrawals, funds were already deducted
      
      // Update transaction status
      db.run(
        `UPDATE transactions SET 
         status = 'completed',
         admin_approved = 1,
         admin_id = ?,
         notes = ?,
         completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.admin.id, notes || 'Approved by admin', id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to approve transaction' });
          }
          
          // Get updated user data
          db.get('SELECT * FROM users WHERE id = ?', [transaction.user_id], (err, user) => {
            if (!err && user) {
              // Notify user via WebSocket
              io.to(`user_${transaction.user_id}`).emit('transaction_approved', {
                transactionId: id,
                type: transaction.type,
                amount: transaction.amount,
                status: 'completed',
                notes: notes || 'Approved by admin'
              });
              
              io.to(`user_${transaction.user_id}`).emit('balance_update', {
                funding_balance: user.funding_balance,
                demo_balance: user.demo_balance
              });
            }
          });
          
          res.json({ success: true, message: 'Transaction approved' });
        }
      );
    }
  );
});

// Reject transaction
app.post('/api/admin/transactions/:id/reject', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  db.get(
    'SELECT * FROM transactions WHERE id = ?',
    [id],
    (err, transaction) => {
      if (err || !transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      if (transaction.type === 'withdrawal') {
        // Refund withdrawn amount
        db.run(
          'UPDATE users SET funding_balance = funding_balance + ? WHERE id = ?',
          [transaction.amount, transaction.user_id]
        );
      }
      
      db.run(
        `UPDATE transactions SET 
         status = 'rejected',
         admin_approved = 0,
         admin_id = ?,
         notes = ?,
         completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.admin.id, notes || 'Rejected by admin', id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to reject transaction' });
          }
          
          // Get updated user data
          db.get('SELECT * FROM users WHERE id = ?', [transaction.user_id], (err, user) => {
            if (!err && user) {
              io.to(`user_${transaction.user_id}`).emit('transaction_rejected', {
                transactionId: id,
                type: transaction.type,
                amount: transaction.amount,
                status: 'rejected',
                notes: notes || 'Rejected by admin'
              });
              
              io.to(`user_${transaction.user_id}`).emit('balance_update', {
                funding_balance: user.funding_balance,
                demo_balance: user.demo_balance
              });
            }
          });
          
          res.json({ success: true, message: 'Transaction rejected' });
        }
      );
    }
  );
});

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/deposit', (req, res) => {
  res.sendFile(path.join(__dirname, 'deposit.html'));
});

app.get('/withdraw', (req, res) => {
  res.sendFile(path.join(__dirname, 'withdraw.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Join user room
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });
  
  // Join admin room
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });
  
  // Chat messages
  socket.on('chat_message', (data) => {
    const { userId, username, message } = data;
    
    if (!userId || !username || !message) {
      return;
    }
    
    db.run(
      'INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)',
      [userId, username, message],
      function(err) {
        if (!err) {
          const chatMessage = {
            id: this.lastID,
            userId,
            username,
            message,
            timestamp: new Date().toISOString()
          };
          
          // Broadcast to all connected clients
          io.emit('new_chat_message', chatMessage);
        }
      }
    );
  });
  
  // Get chat history
  socket.on('get_chat_history', () => {
    db.all(
      'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 50',
      (err, messages) => {
        if (!err) {
          socket.emit('chat_history', messages.reverse());
        }
      }
    );
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin login: admin / admin123`);
  console.log(`User login: testuser / password123`);
  console.log(`Access at: http://localhost:${PORT}`);
});
