// server.js - QuantumCoin Complete Trading Platform API
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["https://quantumcoin.com.ng", "http://localhost:3000", "http://localhost:5500", "http://127.0.0.1:5500"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  },
  transports: ['websocket', 'polling']
});

// Database initialization
const db = new sqlite3.Database('./quantumcoin.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development, configure for production
}));
app.use(compression());
app.use(cors({
  origin: ['https://quantumcoin.com.ng', 'http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'quantumcoin-secret-key-2024', (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

// Initialize Database Tables
const initializeDatabase = () => {
  // Users table with default funding_balance = 0 [FIXED]
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    funding_balance DECIMAL(15,2) DEFAULT 0.00,
    demo_balance DECIMAL(15,2) DEFAULT 100000.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating users table:', err);
  });

  // Portfolio table [FIXED: Allow selling coins anytime]
  db.run(`CREATE TABLE IF NOT EXISTS portfolio (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coin_symbol TEXT NOT NULL,
    amount DECIMAL(20,10) NOT NULL,
    purchase_price DECIMAL(15,2) NOT NULL,
    account_type TEXT CHECK(account_type IN ('funding', 'demo')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, coin_symbol, account_type)
  )`, (err) => {
    if (err) console.error('Error creating portfolio table:', err);
  });

  // Transactions table with proper transaction handling
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('deposit', 'withdrawal', 'buy', 'sell')) NOT NULL,
    account_type TEXT CHECK(account_type IN ('funding', 'demo')) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    coin_symbol TEXT,
    coin_amount DECIMAL(20,10),
    price DECIMAL(15,2),
    status TEXT CHECK(status IN ('pending', 'completed', 'rejected', 'cancelled')) DEFAULT 'completed',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating transactions table:', err);
  });

  // Chat messages table
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating chat_messages table:', err);
  });

  // Market data table
  db.run(`CREATE TABLE IF NOT EXISTS market_data (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    change DECIMAL(5,2) NOT NULL,
    volume DECIMAL(20,2) NOT NULL,
    color TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating market_data table:', err);
  });

  // Online users table for tracking [FIXED: Dynamic online count]
  db.run(`CREATE TABLE IF NOT EXISTS online_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    socket_id TEXT NOT NULL,
    username TEXT NOT NULL,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating online_users table:', err);
  });

  console.log('✅ Database tables initialized');
};

initializeDatabase();

// Initialize default market data
const initializeMarketData = () => {
  const initialMarketData = [
    { symbol: 'BTC', name: 'Bitcoin', price: 65432.10, change: 2.34, volume: 28543256789.23, color: '#f7931a' },
    { symbol: 'ETH', name: 'Ethereum', price: 3456.78, change: 1.56, volume: 15432678901.45, color: '#627eea' },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.156, change: 5.67, volume: 2345678901.23, color: '#c2a633' },
    { symbol: 'SHIB', name: 'Shiba Inu', price: 0.00002567, change: 3.21, volume: 567890123.45, color: '#ffa500' },
    { symbol: 'ADA', name: 'Cardano', price: 0.456, change: -0.78, volume: 3456789012.34, color: '#0033ad' },
    { symbol: 'SOL', name: 'Solana', price: 152.34, change: 4.23, volume: 4567890123.45, color: '#00ffa3' },
    { symbol: 'XRP', name: 'Ripple', price: 0.5234, change: 0.89, volume: 2345678901.23, color: '#23292f' },
    { symbol: 'BNB', name: 'Binance Coin', price: 598.76, change: 1.34, volume: 8765432109.87, color: '#f0b90b' }
  ];

  initialMarketData.forEach(data => {
    db.run(`INSERT OR REPLACE INTO market_data (symbol, name, price, change, volume, color) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      [data.symbol, data.name, data.price, data.change, data.volume, data.color],
      (err) => {
        if (err) console.error('Error inserting market data:', err);
      });
  });
};

// Initialize market data on server start
setTimeout(initializeMarketData, 1000);

// Track online users
const onlineUsers = new Map();
const userSockets = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔗 New client connected:', socket.id);
  
  // Get user from token
  const token = socket.handshake.auth.token;
  let userId = null;
  let username = null;
  let userEmail = null;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quantumcoin-secret-key-2024');
      userId = decoded.id;
      username = decoded.username;
      userEmail = decoded.email;
      socket.userId = userId;
      socket.username = username;
      
      // Join user-specific room
      socket.join(`user:${userId}`);
      
      // Track user as online
      onlineUsers.set(userId, {
        socketId: socket.id,
        username: username,
        email: userEmail,
        connectedAt: new Date()
      });
      
      userSockets.set(socket.id, userId);
      
      // Update database
      db.run(`INSERT OR REPLACE INTO online_users (user_id, socket_id, username) VALUES (?, ?, ?)`,
        [userId, socket.id, username],
        (err) => {
          if (err) console.error('Error updating online users:', err);
        });
      
      // Broadcast online count update
      updateOnlineCount();
      
      // Send welcome message
      socket.emit('connection_established', { 
        success: true, 
        message: 'Connected to QuantumCoin', 
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Send initial market data
      db.all(`SELECT symbol, name, price, change, volume, color FROM market_data`, [], (err, data) => {
        if (!err && data) {
          const marketData = {};
          data.forEach(item => {
            marketData[item.symbol] = item;
          });
          socket.emit('market_update', marketData);
        }
      });
      
      console.log(`👤 User ${username} (${userId}) connected`);
      
    } catch (error) {
      console.log('🔒 Socket authentication failed:', error.message);
      socket.emit('auth_error', { error: 'Authentication failed' });
    }
  } else {
    console.log('🔒 No token provided for socket connection');
    socket.emit('auth_error', { error: 'No authentication token provided' });
  }
  
  // Join chat room
  socket.join('global_chat');
  
  // Request chat history
  socket.on('get_chat_history', () => {
    if (!userId) return;
    
    db.all(`SELECT cm.id, cm.user_id, cm.username, cm.message, cm.created_at
            FROM chat_messages cm 
            ORDER BY cm.created_at DESC 
            LIMIT 100`,
      [], (err, messages) => {
        if (!err) {
          socket.emit('chat_history', messages.reverse());
        } else {
          console.error('Error fetching chat history:', err);
        }
      });
  });
  
  // Send chat message [FIXED: Send immediately]
  socket.on('chat_message', (data) => {
    if (!userId || !username) {
      socket.emit('chat_error', { error: 'You must be logged in to send messages' });
      return;
    }
    
    if (!data.message || data.message.trim() === '') {
      socket.emit('chat_error', { error: 'Message cannot be empty' });
      return;
    }
    
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const message = data.message.substring(0, 500).trim(); // Limit message length
    
    db.run(`INSERT INTO chat_messages (id, user_id, username, message, created_at) 
            VALUES (?, ?, ?, ?, ?)`,
      [messageId, userId, username, message, timestamp],
      (err) => {
        if (err) {
          console.error('Error saving chat message:', err);
          socket.emit('chat_error', { error: 'Failed to send message' });
          return;
        }
        
        const messageData = {
          id: messageId,
          user_id: userId,
          username: username,
          message: message,
          created_at: timestamp
        };
        
        // Broadcast to all users in chat room immediately
        io.to('global_chat').emit('new_chat_message', messageData);
        console.log(`💬 Chat message from ${username}: ${message.substring(0, 50)}...`);
      });
  });
  
  // Join user room for private messages
  socket.on('join_user', (userData) => {
    if (userData && userData.userId) {
      socket.join(`user:${userData.userId}`);
      console.log(`👥 User ${userId} joined private room`);
    }
  });
  
  // Place trade
  socket.on('place_trade', (tradeData) => {
    if (!userId) {
      socket.emit('trade_error', { error: 'Authentication required' });
      return;
    }
    
    handleTrade(socket, tradeData);
  });
  
  // Get user portfolio
  socket.on('get_portfolio', () => {
    if (!userId) return;
    
    db.all(`SELECT coin_symbol, amount, purchase_price, account_type 
            FROM portfolio WHERE user_id = ?
            ORDER BY updated_at DESC`,
      [userId], (err, portfolio) => {
        if (!err) {
          socket.emit('portfolio_update', portfolio);
        } else {
          console.error('Error fetching portfolio:', err);
        }
      });
  });
  
  // Get user transactions [FIXED: History works properly]
  socket.on('get_transactions', () => {
    if (!userId) return;
    
    db.all(`SELECT id, type, account_type, amount, coin_symbol, coin_amount, price, status, created_at
            FROM transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 100`, [userId], (err, transactions) => {
        if (!err) {
          socket.emit('transactions_update', transactions);
          console.log(`📊 Sent ${transactions.length} transactions to user ${userId}`);
        } else {
          console.error('Error fetching transactions:', err);
        }
      });
  });
  
  // Get user balance
  socket.on('get_balance', () => {
    if (!userId) return;
    
    db.get(`SELECT funding_balance, demo_balance FROM users WHERE id = ?`, 
      [userId], (err, user) => {
        if (!err && user) {
          socket.emit('balance_update', {
            funding_balance: user.funding_balance,
            demo_balance: user.demo_balance
          });
        }
      });
  });
  
  // Ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    
    const disconnectedUserId = userSockets.get(socket.id);
    
    if (disconnectedUserId) {
      onlineUsers.delete(disconnectedUserId);
      userSockets.delete(socket.id);
      
      // Remove from database
      db.run(`DELETE FROM online_users WHERE socket_id = ?`, [socket.id], (err) => {
        if (err) console.error('Error removing online user:', err);
      });
      
      // Update online count
      updateOnlineCount();
      
      console.log(`👤 User ${disconnectedUserId} disconnected`);
    }
  });
  
  // Handle connection error
  socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error);
    socket.emit('connection_error', { error: 'Connection error occurred' });
  });
});

// Update online user count and broadcast
function updateOnlineCount() {
  db.get(`SELECT COUNT(DISTINCT user_id) as count FROM online_users 
          WHERE last_seen > datetime('now', '-1 minute')`,
    [], (err, result) => {
      if (!err) {
        const realOnlineCount = result.count || 0;
        // Add some variation for realistic movement (between -3 and +3)
        const variation = Math.floor(Math.random() * 7) - 3;
        const displayCount = Math.max(15, realOnlineCount + variation);
        
        io.emit('online_count_update', displayCount);
        console.log(`👥 Online users: ${realOnlineCount} (displaying: ${displayCount})`);
      }
    });
}

// Trade handling function [FIXED: Trading works like actual app]
function handleTrade(socket, tradeData) {
  const { type, symbol, amount, account_type } = tradeData;
  const userId = socket.userId;
  
  console.log(`💰 Trade requested: ${type} ${symbol} $${amount} (${account_type}) by ${userId}`);
  
  if (!userId || !['buy', 'sell'].includes(type) || !symbol || !amount || !['funding', 'demo'].includes(account_type)) {
    socket.emit('trade_error', { error: 'Invalid trade parameters' });
    return;
  }
  
  if (amount <= 0) {
    socket.emit('trade_error', { error: 'Amount must be positive' });
    return;
  }
  
  // Start transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Get current market price
    db.get(`SELECT price FROM market_data WHERE symbol = ?`, [symbol], (err, marketData) => {
      if (err || !marketData) {
        db.run('ROLLBACK');
        socket.emit('trade_error', { error: 'Market data not available' });
        return;
      }
      
      const price = marketData.price;
      
      if (type === 'buy') {
        handleBuyTrade(userId, symbol, amount, price, account_type, socket);
      } else if (type === 'sell') {
        handleSellTrade(userId, symbol, amount, price, account_type, socket);
      }
    });
  });
}

function handleBuyTrade(userId, symbol, amount, price, account_type, socket) {
  const coinAmount = amount / price;
  const fee = amount * 0.001; // 0.1% fee
  const totalCost = amount + fee;
  
  // Check user balance
  db.get(`SELECT ${account_type}_balance as balance FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) {
      db.run('ROLLBACK');
      socket.emit('trade_error', { error: 'User not found' });
      return;
    }
    
    if (user.balance < totalCost) {
      db.run('ROLLBACK');
      socket.emit('trade_error', { 
        error: `Insufficient balance. Required: $${totalCost.toFixed(2)}, Available: $${user.balance.toFixed(2)}` 
      });
      return;
    }
    
    // Update user balance
    const newBalance = user.balance - totalCost;
    db.run(`UPDATE users SET ${account_type}_balance = ? WHERE id = ?`, 
      [newBalance, userId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          socket.emit('trade_error', { error: 'Failed to update balance' });
          return;
        }
        
        // Update portfolio
        const portfolioId = uuidv4();
        db.get(`SELECT amount, purchase_price FROM portfolio 
                WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
          [userId, symbol, account_type], (err, existing) => {
            if (err) {
              db.run('ROLLBACK');
              socket.emit('trade_error', { error: 'Failed to check portfolio' });
              return;
            }
            
            if (existing) {
              // Update existing portfolio entry
              const totalAmount = existing.amount + coinAmount;
              const avgPrice = ((existing.amount * existing.purchase_price) + (coinAmount * price)) / totalAmount;
              
              db.run(`UPDATE portfolio SET amount = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP
                      WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
                [totalAmount, avgPrice, userId, symbol, account_type], (err) => {
                  if (err) {
                    console.error('Portfolio update error:', err);
                    db.run('ROLLBACK');
                    socket.emit('trade_error', { error: 'Failed to update portfolio' });
                    return;
                  }
                  recordTransaction();
                });
            } else {
              // Create new portfolio entry
              db.run(`INSERT INTO portfolio (id, user_id, coin_symbol, amount, purchase_price, account_type)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                [portfolioId, userId, symbol, coinAmount, price, account_type], (err) => {
                  if (err) {
                    console.error('Portfolio insert error:', err);
                    db.run('ROLLBACK');
                    socket.emit('trade_error', { error: 'Failed to create portfolio entry' });
                    return;
                  }
                  recordTransaction();
                });
            }
            
            function recordTransaction() {
              // Record transaction
              const txId = uuidv4();
              db.run(`INSERT INTO transactions (id, user_id, type, account_type, amount, coin_symbol, coin_amount, price, status)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [txId, userId, 'buy', account_type, amount, symbol, coinAmount, price, 'completed'], (err) => {
                  if (err) {
                    console.error('Transaction record error:', err);
                    db.run('ROLLBACK');
                    socket.emit('trade_error', { error: 'Failed to record transaction' });
                    return;
                  }
                  
                  // Commit transaction
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      console.error('Commit error:', commitErr);
                      db.run('ROLLBACK');
                      socket.emit('trade_error', { error: 'Transaction failed to commit' });
                      return;
                    }
                    
                    // Success
                    const tradeResult = {
                      success: true,
                      type: 'buy',
                      symbol,
                      amount,
                      coinAmount: parseFloat(coinAmount.toFixed(8)),
                      price,
                      fee: parseFloat(fee.toFixed(2)),
                      newBalance: parseFloat(newBalance.toFixed(2)),
                      transactionId: txId,
                      timestamp: new Date().toISOString()
                    };
                    
                    socket.emit('trade_completed', tradeResult);
                    
                    // Send balance update
                    socket.emit('balance_update', {
                      [`${account_type}_balance`]: newBalance
                    });
                    
                    // Send updated portfolio
                    db.all(`SELECT coin_symbol, amount, purchase_price, account_type 
                            FROM portfolio WHERE user_id = ?`,
                      [userId], (err, portfolio) => {
                        if (!err) {
                          socket.emit('portfolio_update', portfolio);
                        }
                      });
                    
                    // Send transaction update
                    db.all(`SELECT id, type, account_type, amount, coin_symbol, coin_amount, price, status, created_at
                            FROM transactions 
                            WHERE user_id = ? 
                            ORDER BY created_at DESC 
                            LIMIT 5`, [userId], (err, transactions) => {
                            if (!err) {
                              socket.emit('transactions_update', transactions);
                            }
                          });
                    
                    console.log(`✅ Buy trade completed: ${symbol} $${amount} for user ${userId}`);
                  });
                });
            }
          });
      });
  });
}

function handleSellTrade(userId, symbol, amount, price, account_type, socket) {
  const coinAmount = amount / price;
  
  // Check if user has enough coins
  db.get(`SELECT amount FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
    [userId, symbol, account_type], (err, portfolio) => {
      if (err || !portfolio || portfolio.amount < coinAmount) {
        db.run('ROLLBACK');
        socket.emit('trade_error', { 
          error: `Insufficient coins. Required: ${coinAmount.toFixed(8)} ${symbol}, Available: ${portfolio?.amount?.toFixed(8) || 0} ${symbol}` 
        });
        return;
      }
      
      const saleValue = coinAmount * price;
      const fee = saleValue * 0.001;
      const netProceeds = saleValue - fee;
      
      // Update portfolio
      const newCoinAmount = portfolio.amount - coinAmount;
      
      if (newCoinAmount <= 0.00000001) { // Near zero threshold
        db.run(`DELETE FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
          [userId, symbol, account_type], (err) => {
            if (err) {
              db.run('ROLLBACK');
              socket.emit('trade_error', { error: 'Failed to update portfolio' });
              return;
            }
            updateUserBalance();
          });
      } else {
        db.run(`UPDATE portfolio SET amount = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
          [newCoinAmount, userId, symbol, account_type], (err) => {
            if (err) {
              db.run('ROLLBACK');
              socket.emit('trade_error', { error: 'Failed to update portfolio' });
              return;
            }
            updateUserBalance();
          });
      }
      
      function updateUserBalance() {
        // Update user balance
        db.get(`SELECT ${account_type}_balance as balance FROM users WHERE id = ?`, [userId], (err, user) => {
          if (err) {
            db.run('ROLLBACK');
            socket.emit('trade_error', { error: 'User not found' });
            return;
          }
          
          const newBalance = user.balance + netProceeds;
          db.run(`UPDATE users SET ${account_type}_balance = ? WHERE id = ?`,
            [newBalance, userId], (err) => {
              if (err) {
                db.run('ROLLBACK');
                socket.emit('trade_error', { error: 'Failed to update balance' });
                return;
              }
              
              // Record transaction
              const txId = uuidv4();
              db.run(`INSERT INTO transactions (id, user_id, type, account_type, amount, coin_symbol, coin_amount, price, status)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [txId, userId, 'sell', account_type, saleValue, symbol, coinAmount, price, 'completed'], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    socket.emit('trade_error', { error: 'Failed to record transaction' });
                    return;
                  }
                  
                  // Commit transaction
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      db.run('ROLLBACK');
                      socket.emit('trade_error', { error: 'Transaction failed to commit' });
                      return;
                    }
                    
                    // Success
                    const tradeResult = {
                      success: true,
                      type: 'sell',
                      symbol,
                      amount: saleValue,
                      coinAmount: parseFloat(coinAmount.toFixed(8)),
                      price,
                      fee: parseFloat(fee.toFixed(2)),
                      newBalance: parseFloat(newBalance.toFixed(2)),
                      transactionId: txId,
                      timestamp: new Date().toISOString()
                    };
                    
                    socket.emit('trade_completed', tradeResult);
                    
                    // Send balance update
                    socket.emit('balance_update', {
                      [`${account_type}_balance`]: newBalance
                    });
                    
                    // Send updated portfolio
                    db.all(`SELECT coin_symbol, amount, purchase_price, account_type 
                            FROM portfolio WHERE user_id = ?`,
                      [userId], (err, portfolio) => {
                        if (!err) {
                          socket.emit('portfolio_update', portfolio);
                        }
                      });
                    
                    // Send transaction update
                    db.all(`SELECT id, type, account_type, amount, coin_symbol, coin_amount, price, status, created_at
                            FROM transactions 
                            WHERE user_id = ? 
                            ORDER BY created_at DESC 
                            LIMIT 5`, [userId], (err, transactions) => {
                            if (!err) {
                              socket.emit('transactions_update', transactions);
                            }
                          });
                    
                    console.log(`✅ Sell trade completed: ${symbol} $${saleValue.toFixed(2)} for user ${userId}`);
                  });
                });
            });
        });
      }
    });
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'QuantumCoin API',
    version: '1.0.0'
  });
});

// User registration with funding_balance = 0 [FIXED]
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  console.log(`📝 Registration attempt: ${username} (${email})`);
  
  if (!username || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'All fields (username, email, password) are required' 
    });
  }
  
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username must be between 3 and 30 characters' 
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password must be at least 6 characters' 
    });
  }
  
  if (!validateEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    db.run(`INSERT INTO users (id, username, email, password_hash, funding_balance, demo_balance)
            VALUES (?, ?, ?, ?, 0.00, 100000.00)`,
      [userId, username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            console.log(`❌ Registration failed - duplicate: ${username}/${email}`);
            return res.status(400).json({ 
              success: false, 
              error: 'Username or email already exists' 
            });
          }
          console.error('Database error during registration:', err);
          return res.status(500).json({ 
            success: false, 
            error: 'Registration failed due to server error' 
          });
        }
        
        const token = jwt.sign(
          { id: userId, username, email },
          process.env.JWT_SECRET || 'quantumcoin-secret-key-2024',
          { expiresIn: '7d' }
        );
        
        console.log(`✅ Registration successful: ${username} (${userId})`);
        
        res.json({
          success: true,
          message: 'Registration successful',
          user: { 
            id: userId, 
            username, 
            email, 
            funding_balance: 0.00, 
            demo_balance: 100000.00 
          },
          token
        });
      });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed' 
    });
  }
});

// User login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log(`🔐 Login attempt: ${email}`);
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and password required' 
    });
  }
  
  db.get(`SELECT id, username, email, password_hash, funding_balance, demo_balance 
          FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      console.log(`❌ Login failed - user not found: ${email}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.log(`❌ Login failed - invalid password: ${email}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'quantumcoin-secret-key-2024',
      { expiresIn: '7d' }
    );
    
    console.log(`✅ Login successful: ${user.username} (${user.id})`);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        funding_balance: user.funding_balance,
        demo_balance: user.demo_balance
      },
      token
    });
  });
});

// Get user data
app.get('/api/user', authenticateToken, (req, res) => {
  db.get(`SELECT id, username, email, funding_balance, demo_balance 
          FROM users WHERE id = ?`, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    res.json({
      success: true,
      user
    });
  });
});

// Get market data
app.get('/api/market-data', (req, res) => {
  db.all(`SELECT symbol, name, price, change, volume, color FROM market_data`, [], (err, data) => {
    if (err) {
      console.error('Error fetching market data:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch market data' 
      });
    }
    
    const marketData = {};
    data.forEach(item => {
      marketData[item.symbol] = item;
    });
    
    res.json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString()
    });
  });
});

// Get portfolio
app.get('/api/portfolio', authenticateToken, (req, res) => {
  db.all(`SELECT coin_symbol, amount, purchase_price, account_type 
          FROM portfolio WHERE user_id = ? 
          ORDER BY updated_at DESC`, [req.user.id], (err, portfolio) => {
    if (err) {
      console.error('Error fetching portfolio:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch portfolio' 
      });
    }
    res.json({
      success: true,
      portfolio
    });
  });
});

// Get transaction history [FIXED: History works properly]
app.get('/api/transactions', authenticateToken, (req, res) => {
  console.log(`📊 Fetching transactions for user: ${req.user.id}`);
  
  db.all(`SELECT id, type, account_type, amount, coin_symbol, coin_amount, price, status, created_at
          FROM transactions 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 100`, [req.user.id], (err, transactions) => {
    if (err) {
      console.error('Error fetching transactions:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch transactions' 
      });
    }
    
    console.log(`📊 Found ${transactions.length} transactions for user ${req.user.id}`);
    
    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  });
});

// Place trade via API [FIXED: Trading works like actual app]
app.post('/api/trade', authenticateToken, async (req, res) => {
  const { type, symbol, amount, account_type } = req.body;
  const userId = req.user.id;
  
  console.log(`💰 API Trade requested: ${type} ${symbol} $${amount} (${account_type}) by ${userId}`);
  
  // Validate input
  if (!['buy', 'sell'].includes(type) || !symbol || !amount || !['funding', 'demo'].includes(account_type)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid trade parameters' 
    });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Amount must be positive' 
    });
  }
  
  if (amount < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Minimum trade amount is $10' 
    });
  }
  
  // Start transaction 
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Get market price
    db.get(`SELECT price FROM market_data WHERE symbol = ?`, [symbol], (err, marketData) => {
      if (err || !marketData) {
        db.run('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid symbol or market data not available' 
        });
      }
      
      const price = marketData.price;
      
      if (type === 'buy') {
        handleBuyTradeAPI(userId, symbol, amount, price, account_type, res);
      } else if (type === 'sell') {
        handleSellTradeAPI(userId, symbol, amount, price, account_type, res);
      }
    });
  });
});

function handleBuyTradeAPI(userId, symbol, amount, price, account_type, res) {
  const coinAmount = amount / price;
  const fee = amount * 0.001;
  const totalCost = amount + fee;
  
  // Check balance
  db.get(`SELECT ${account_type}_balance as balance FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) {
      db.run('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    if (user.balance < totalCost) {
      db.run('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient balance. Required: $${totalCost.toFixed(2)}, Available: $${user.balance.toFixed(2)}` 
      });
    }
    
    // Update balance
    const newBalance = user.balance - totalCost;
    db.run(`UPDATE users SET ${account_type}_balance = ? WHERE id = ?`, 
      [newBalance, userId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to update balance' 
          });
        }
        
        // Update portfolio
        const portfolioId = uuidv4();
        db.get(`SELECT amount, purchase_price FROM portfolio 
                WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
          [userId, symbol, account_type], (err, existing) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ 
                success: false, 
                error: 'Failed to check portfolio' 
              });
            }
            
            if (existing) {
              // Update existing portfolio entry
              const totalAmount = existing.amount + coinAmount;
              const avgPrice = ((existing.amount * existing.purchase_price) + (coinAmount * price)) / totalAmount;
              
              db.run(`UPDATE portfolio SET amount = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP
                      WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
                [totalAmount, avgPrice, userId, symbol, account_type], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ 
                      success: false, 
                      error: 'Failed to update portfolio' 
                    });
                  }
                  recordTransaction();
                });
            } else {
              // Create new portfolio entry
              db.run(`INSERT INTO portfolio (id, user_id, coin_symbol, amount, purchase_price, account_type)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                [portfolioId, userId, symbol, coinAmount, price, account_type], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ 
                      success: false, 
                      error: 'Failed to create portfolio entry' 
                    });
                  }
                  recordTransaction();
                });
            }
            
            function recordTransaction() {
              // Record transaction
              const txId = uuidv4();
              db.run(`INSERT INTO transactions (id, user_id, type, account_type, amount, coin_symbol, coin_amount, price, status)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [txId, userId, 'buy', account_type, amount, symbol, coinAmount, price, 'completed'], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ 
                      success: false, 
                      error: 'Failed to record transaction' 
                    });
                  }
                  
                  // Commit
                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ 
                        success: false, 
                        error: 'Transaction failed' 
                      });
                    }
                    
                    // Update market data volume
                    db.run(`UPDATE market_data SET volume = volume + ? WHERE symbol = ?`,
                      [amount, symbol]);
                    
                    res.json({
                      success: true,
                      message: 'Trade executed successfully',
                      trade: { 
                        type: 'buy', 
                        symbol, 
                        amount, 
                        coinAmount: parseFloat(coinAmount.toFixed(8)), 
                        price, 
                        fee: parseFloat(fee.toFixed(2)) 
                      },
                      newBalance: parseFloat(newBalance.toFixed(2)),
                      transactionId: txId,
                      timestamp: new Date().toISOString()
                    });
                    
                    // Notify via WebSocket if user is online
                    const userSocket = findUserSocket(userId);
                    if (userSocket) {
                      userSocket.emit('balance_update', {
                        [`${account_type}_balance`]: newBalance
                      });
                      userSocket.emit('trade_completed', {
                        success: true,
                        type: 'buy',
                        symbol,
                        amount,
                        coinAmount,
                        price,
                        fee,
                        newBalance,
                        transactionId: txId
                      });
                    }
                    
                    console.log(`✅ API Buy trade completed: ${symbol} $${amount} for user ${userId}`);
                  });
                });
            }
          });
      });
  });
}

function handleSellTradeAPI(userId, symbol, amount, price, account_type, res) {
  const coinAmount = amount / price;
  
  // Check portfolio
  db.get(`SELECT amount FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
    [userId, symbol, account_type], (err, portfolio) => {
      if (err || !portfolio || portfolio.amount < coinAmount) {
        db.run('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient coins. Required: ${coinAmount.toFixed(8)} ${symbol}, Available: ${portfolio?.amount?.toFixed(8) || 0} ${symbol}` 
        });
      }
      
      const saleValue = coinAmount * price;
      const fee = saleValue * 0.001;
      const netProceeds = saleValue - fee;
      
      // Update portfolio
      const newCoinAmount = portfolio.amount - coinAmount;
      if (newCoinAmount <= 0.00000001) {
        db.run(`DELETE FROM portfolio WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
          [userId, symbol, account_type], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ 
                success: false, 
                error: 'Failed to update portfolio' 
              });
            }
            updateBalance();
          });
      } else {
        db.run(`UPDATE portfolio SET amount = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND coin_symbol = ? AND account_type = ?`,
          [newCoinAmount, userId, symbol, account_type], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ 
                success: false, 
                error: 'Failed to update portfolio' 
              });
            }
            updateBalance();
          });
      }
      
      function updateBalance() {
        // Update balance
        db.get(`SELECT ${account_type}_balance as balance FROM users WHERE id = ?`, [userId], (err, user) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(400).json({ 
              success: false, 
              error: 'User not found' 
            });
          }
          
          const newBalance = user.balance + netProceeds;
          db.run(`UPDATE users SET ${account_type}_balance = ? WHERE id = ?`,
            [newBalance, userId], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ 
                  success: false, 
                  error: 'Failed to update balance' 
                });
              }
              
              // Record transaction
              const txId = uuidv4();
              db.run(`INSERT INTO transactions (id, user_id, type, account_type, amount, coin_symbol, coin_amount, price, status)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [txId, userId, 'sell', account_type, saleValue, symbol, coinAmount, price, 'completed'], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ 
                      success: false, 
                      error: 'Failed to record transaction' 
                    });
                  }
                  
                  // Commit
                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ 
                        success: false, 
                        error: 'Transaction failed' 
                      });
                    }
                    
                    // Update market data volume
                    db.run(`UPDATE market_data SET volume = volume + ? WHERE symbol = ?`,
                      [saleValue, symbol]);
                    
                    res.json({
                      success: true,
                      message: 'Trade executed successfully',
                      trade: { 
                        type: 'sell', 
                        symbol, 
                        amount: saleValue, 
                        coinAmount: parseFloat(coinAmount.toFixed(8)), 
                        price, 
                        fee: parseFloat(fee.toFixed(2)) 
                      },
                      newBalance: parseFloat(newBalance.toFixed(2)),
                      transactionId: txId,
                      timestamp: new Date().toISOString()
                    });
                    
                    // Notify via WebSocket if user is online
                    const userSocket = findUserSocket(userId);
                    if (userSocket) {
                      userSocket.emit('balance_update', {
                        [`${account_type}_balance`]: newBalance
                      });
                      userSocket.emit('trade_completed', {
                        success: true,
                        type: 'sell',
                        symbol,
                        amount: saleValue,
                        coinAmount,
                        price,
                        fee,
                        newBalance,
                        transactionId: txId
                      });
                    }
                    
                    console.log(`✅ API Sell trade completed: ${symbol} $${saleValue.toFixed(2)} for user ${userId}`);
                  });
                });
            });
        });
      }
    });
}

// Deposit endpoint
app.post('/api/deposit', authenticateToken, (req, res) => {
  const { amount, account_type } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Amount must be positive' 
    });
  }
  
  if (!['funding', 'demo'].includes(account_type)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid account type' 
    });
  }
  
  if (amount > 1000000) {
    return res.status(400).json({ 
      success: false, 
      error: 'Maximum deposit amount is $1,000,000' 
    });
  }
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    db.get(`SELECT ${account_type}_balance as balance FROM users WHERE id = ?`, [req.user.id], (err, user) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to process deposit' 
        });
      }
      
      const newBalance = user.balance + amount;
      db.run(`UPDATE users SET ${account_type}_balance = ? WHERE id = ?`, 
        [newBalance, req.user.id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ 
              success: false, 
              error: 'Failed to update balance' 
            });
          }
          
          // Record transaction
          const txId = uuidv4();
          db.run(`INSERT INTO transactions (id, user_id, type, account_type, amount, status)
                  VALUES (?, ?, 'deposit', ?, ?, 'completed')`,
            [txId, req.user.id, account_type, amount], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ 
                  success: false, 
                  error: 'Failed to record transaction' 
                });
              }
              
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ 
                    success: false, 
                    error: 'Transaction failed' 
                  });
                }
                
                res.json({
                  success: true,
                  message: 'Deposit successful',
                  newBalance: parseFloat(newBalance.toFixed(2)),
                  transactionId: txId
                });
                
                // Notify via WebSocket if user is online
                const userSocket = findUserSocket(req.user.id);
                if (userSocket) {
                  userSocket.emit('balance_update', {
                    [`${account_type}_balance`]: newBalance
                  });
                }
                
                console.log(`💰 Deposit: $${amount} to ${account_type} account for user ${req.user.id}`);
              });
            });
        });
    });
  });
});

// Withdrawal endpoint
app.post('/api/withdraw', authenticateToken, (req, res) => {
  const { amount, account_type } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Amount must be positive' 
    });
  }
  
  if (!['funding', 'demo'].includes(account_type)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid account type' 
    });
  }
  
  if (amount < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Minimum withdrawal amount is $10' 
    });
  }
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    db.get(`SELECT ${account_type}_balance as balance FROM users WHERE id = ?`, [req.user.id], (err, user) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to process withdrawal' 
        });
      }
      
      if (user.balance < amount) {
        db.run('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient balance. Available: $${user.balance.toFixed(2)}` 
        });
      }
      
      const newBalance = user.balance - amount;
      db.run(`UPDATE users SET ${account_type}_balance = ? WHERE id = ?`, 
        [newBalance, req.user.id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ 
              success: false, 
              error: 'Failed to update balance' 
            });
          }
          
          // Record transaction (pending status for withdrawals)
          const txId = uuidv4();
          db.run(`INSERT INTO transactions (id, user_id, type, account_type, amount, status, notes)
                  VALUES (?, ?, 'withdrawal', ?, ?, 'pending', 'Pending admin approval')`,
            [txId, req.user.id, account_type, amount], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ 
                  success: false, 
                  error: 'Failed to record transaction' 
                });
              }
              
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ 
                    success: false, 
                    error: 'Transaction failed' 
                  });
                }
                
                res.json({
                  success: true,
                  message: 'Withdrawal request submitted successfully',
                  newBalance: parseFloat(newBalance.toFixed(2)),
                  transactionId: txId,
                  note: 'Withdrawal pending admin approval'
                });
                
                // Notify via WebSocket if user is online
                const userSocket = findUserSocket(req.user.id);
                if (userSocket) {
                  userSocket.emit('balance_update', {
                    [`${account_type}_balance`]: newBalance
                  });
                  userSocket.emit('transaction_pending', {
                    type: 'withdrawal',
                    amount,
                    transactionId: txId
                  });
                }
                
                console.log(`💸 Withdrawal request: $${amount} from ${account_type} account for user ${req.user.id}`);
              });
            });
        });
    });
  });
});

// Get chart data
app.get('/api/chart-data/:symbol/:timeframe', (req, res) => {
  const { symbol, timeframe } = req.params;
  
  if (!['1h', '1d', '1w', '1m', '1y'].includes(timeframe)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid timeframe' 
    });
  }
  
  // Generate chart data
  const now = Date.now();
  const dataPoints = 100;
  const interval = getInterval(timeframe);
  
  // Get current price for the symbol
  db.get(`SELECT price FROM market_data WHERE symbol = ?`, [symbol], (err, marketData) => {
    let basePrice = 50000;
    if (marketData) {
      basePrice = marketData.price;
    }
    
    const chartData = [];
    let currentPrice = basePrice;
    let volatility = 0.02; // 2% volatility
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now - (i * interval));
      
      // Simulate realistic price movement with trends
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);
      
      // Ensure price doesn't go too low
      currentPrice = Math.max(currentPrice, basePrice * 0.5);
      
      const open = currentPrice;
      const close = currentPrice * (0.995 + Math.random() * 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * 0.015);
      const low = Math.min(open, close) * (0.985 - Math.random() * 0.015);
      
      chartData.push({
        time: time.toISOString(),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.random() * 1000000
      });
    }
    
    res.json({
      success: true,
      symbol,
      timeframe,
      data: chartData
    });
  });
});

function getInterval(timeframe) {
  switch(timeframe) {
    case '1h': return 60 * 60 * 1000 / 100;
    case '1d': return 24 * 60 * 60 * 1000 / 100;
    case '1w': return 7 * 24 * 60 * 60 * 1000 / 100;
    case '1m': return 30 * 24 * 60 * 60 * 1000 / 100;
    case '1y': return 365 * 24 * 60 * 60 * 1000 / 100;
    default: return 60 * 60 * 1000 / 100;
  }
}

// Get online users count
app.get('/api/online-count', (req, res) => {
  db.get(`SELECT COUNT(DISTINCT user_id) as count FROM online_users 
          WHERE last_seen > datetime('now', '-1 minute')`,
    [], (err, result) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to get online count' 
        });
      }
      
      const realCount = result.count || 0;
      const displayCount = Math.max(15, realCount + Math.floor(Math.random() * 7) - 3);
      
      res.json({
        success: true,
        realCount,
        displayCount,
        timestamp: new Date().toISOString()
      });
    });
});

// Update market prices periodically [FIXED: Real-time updates]
setInterval(() => {
  db.all(`SELECT symbol, price, change FROM market_data`, [], (err, symbols) => {
    if (err) {
      console.error('Error fetching market data for update:', err);
      return;
    }
    
    symbols.forEach(symbolData => {
      // Simulate realistic price changes with trends
      const volatility = 0.005; // 0.5% volatility
      const change = (Math.random() - 0.5) * volatility * 2;
      const newPrice = symbolData.price * (1 + change);
      
      // Calculate new change percentage
      const basePrice = symbolData.price / (1 + symbolData.change / 100);
      const newChange = ((newPrice - basePrice) / basePrice) * 100;
      
      // Update volume with random fluctuation
      const volumeChange = (Math.random() - 0.3) * 0.4; // -30% to +10%
      const newVolume = Math.max(1000000, symbolData.price * (1000000 + Math.random() * 5000000) * (1 + volumeChange));
      
      db.run(`UPDATE market_data SET price = ?, change = ?, volume = ?, updated_at = CURRENT_TIMESTAMP
              WHERE symbol = ?`,
        [newPrice.toFixed(2), newChange.toFixed(2), newVolume.toFixed(2), symbolData.symbol],
        (err) => {
          if (err) console.error('Error updating market data:', err);
        });
      
      // Broadcast price updates to all connected clients
      io.emit('price_update', {
        symbol: symbolData.symbol,
        price: parseFloat(newPrice.toFixed(2)),
        change: parseFloat(newChange.toFixed(2)),
        volume: parseFloat(newVolume.toFixed(2)),
        timestamp: new Date().toISOString()
      });
    });
    
    // Update online count
    updateOnlineCount();
    
    // Clean up old online users (more than 2 minutes)
    db.run(`DELETE FROM online_users WHERE last_seen < datetime('now', '-2 minutes')`);
    
    // Update last_seen for active users
    const activeSocketIds = Array.from(userSockets.keys());
    if (activeSocketIds.length > 0) {
      const placeholders = activeSocketIds.map(() => '?').join(',');
      db.run(`UPDATE online_users SET last_seen = CURRENT_TIMESTAMP 
              WHERE socket_id IN (${placeholders})`, activeSocketIds);
    }
  });
}, 3000); // Update every 3 seconds

// Helper function to find user socket
function findUserSocket(userId) {
  for (const [socketId, socketUserId] of userSockets.entries()) {
    if (socketUserId === userId) {
      return io.sockets.sockets.get(socketId);
    }
  }
  return null;
}

// Email validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Close database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
  });
  
  // Close server
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 QuantumCoin API server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time connections`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔗 WebSocket URL: ws://localhost:${PORT}`);
  console.log(`📊 Database: quantumcoin.db`);
  console.log(`👥 Ready for connections...`);
});
