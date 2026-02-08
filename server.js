<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QuantumCoin Dashboard | Live Crypto Trading</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        :root {
            --primary: #00f0ff;
            --secondary: #7b2cbf;
            --accent: #ff00c8;
            --dark: #0a0a1f;
            --darker: #050510;
            --light: #e2fafc;
            --success: #00ff88;
            --danger: #ff006e;
            --warning: #ffcc00;
        }

        body {
            background-color: var(--darker);
            color: var(--light);
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(123, 44, 191, 0.15) 0%, transparent 20%),
                radial-gradient(circle at 90% 80%, rgba(0, 240, 255, 0.1) 0%, transparent 20%);
            min-height: 100vh;
        }

        .container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 0 20px;
        }

        /* Dashboard Header */
        .dashboard-header {
            padding: 20px 0;
            border-bottom: 1px solid rgba(0, 240, 255, 0.1);
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .back-button {
            color: var(--primary);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .back-button:hover {
            color: var(--accent);
        }

        .header-controls {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .support-link {
            color: var(--primary);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .support-link:hover {
            color: var(--accent);
        }

        /* Dashboard Layout */
        .dashboard {
            display: grid;
            grid-template-columns: 250px 1fr 350px;
            gap: 30px;
            margin-bottom: 50px;
        }

        /* Sidebar */
        .sidebar {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(0, 240, 255, 0.1);
            height: fit-content;
        }

        .user-profile {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(0, 240, 255, 0.1);
        }

        .avatar {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--darker);
            margin: 0 auto 15px;
        }

        .user-profile h2 {
            font-size: 1.3rem;
            margin-bottom: 5px;
            color: var(--light);
        }

        .user-profile p {
            color: rgba(226, 250, 252, 0.7);
            font-size: 0.9rem;
        }

        .account-selector {
            margin-bottom: 25px;
        }

        .account-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 15px;
            background: rgba(0, 240, 255, 0.05);
            border: 1px solid rgba(0, 240, 255, 0.1);
            border-radius: 10px;
            color: rgba(226, 250, 252, 0.7);
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 10px;
        }

        .account-btn.active {
            background: rgba(0, 240, 255, 0.2);
            border-color: var(--primary);
            color: var(--primary);
        }

        .account-btn:hover:not(.active) {
            background: rgba(0, 240, 255, 0.1);
            border-color: rgba(0, 240, 255, 0.3);
        }

        .account-badge {
            margin-left: auto;
            padding: 2px 8px;
            background: var(--primary);
            color: var(--darker);
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
        }

        .nav-menu {
            list-style: none;
        }

        .nav-menu li {
            margin-bottom: 10px;
        }

        .nav-menu a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            color: rgba(226, 250, 252, 0.7);
            text-decoration: none;
            border-radius: 10px;
            transition: all 0.3s ease;
        }

        .nav-menu a:hover,
        .nav-menu a.active {
            background: rgba(0, 240, 255, 0.1);
            color: var(--primary);
        }

        .notifications-container {
            background: rgba(10, 10, 31, 0.95);
            border: 1px solid rgba(0, 240, 255, 0.3);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
        }
        
        .notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid rgba(0, 240, 255, 0.2);
        }
        
        .notification-header h3 {
            color: var(--primary);
            font-size: 1.2rem;
        }
        
        .clear-notifications {
            background: transparent;
            border: none;
            color: rgba(226, 250, 252, 0.7);
            cursor: pointer;
            font-size: 1.2rem;
            transition: color 0.3s ease;
        }
        
        .clear-notifications:hover {
            color: var(--accent);
        }
        
        .notification-item {
            background: rgba(0, 240, 255, 0.05);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
            border-left: 4px solid var(--primary);
            transition: all 0.3s ease;
        }
        
        .notification-item:hover {
            background: rgba(0, 240, 255, 0.1);
        }
        
        .notification-item.warning {
            border-left-color: var(--warning);
        }
        
        .notification-item.success {
            border-left-color: var(--success);
        }
        
        .notification-item.danger {
            border-left-color: var(--danger);
        }
        
        .notification-content h4 {
            color: var(--light);
            margin-bottom: 5px;
            font-size: 1rem;
        }
        
        .notification-content p {
            color: rgba(226, 250, 252, 0.7);
            font-size: 0.9rem;
            margin-bottom: 10px;
        }
        
        .notification-time {
            color: rgba(226, 250, 252, 0.5);
            font-size: 0.8rem;
        }
        
        .notification-badge {
            position: absolute;
            top: 20px;
            right: 20px;
            background: var(--danger);
            color: var(--darker);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: bold;
            cursor: pointer;
        }

        /* Main Content */
        .main-content {
            display: flex;
            flex-direction: column;
            gap: 30px;
        }

        .welcome-banner {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .welcome-banner h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            color: var(--light);
        }

        .welcome-banner h1 span {
            color: var(--primary);
        }

        .welcome-banner p {
            color: rgba(226, 250, 252, 0.7);
            margin-bottom: 25px;
        }

        .account-balances {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }

        .balance-card {
            background: rgba(5, 5, 16, 0.9);
            border-radius: 15px;
            padding: 20px;
            border: 2px solid rgba(0, 240, 255, 0.1);
            transition: all 0.3s ease;
        }

        .balance-card.active {
            border-color: var(--primary);
            box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
        }

        .balance-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .balance-header h3 {
            color: var(--light);
            font-size: 1rem;
        }

        .balance-badge {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 600;
        }

        .badge-funding {
            background: rgba(0, 240, 255, 0.2);
            color: var(--primary);
        }

        .badge-demo {
            background: rgba(123, 44, 191, 0.2);
            color: var(--secondary);
        }

        .balance-amount {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 10px;
        }

        .positive {
            color: var(--success);
        }

        .negative {
            color: var(--danger);
        }

        .balance-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .balance-btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .deposit-balance-btn {
            background: rgba(0, 255, 136, 0.1);
            color: var(--success);
            border: 1px solid rgba(0, 255, 136, 0.3);
        }

        .withdraw-balance-btn {
            background: rgba(255, 0, 110, 0.1);
            color: var(--danger);
            border: 1px solid rgba(255, 0, 110, 0.3);
        }

        .balance-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }

        .pending-transactions {
            background: rgba(5, 5, 16, 0.9);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        /* Trading Section */
        .trading-section {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .section-header h2 {
            color: var(--light);
            font-size: 1.5rem;
        }

        .section-header h2 span {
            color: var(--primary);
        }

        .timeframe-selector {
            display: flex;
            gap: 8px;
            background: rgba(0, 240, 255, 0.05);
            padding: 4px;
            border-radius: 10px;
        }

        .timeframe-btn {
            padding: 6px 12px;
            border: none;
            background: transparent;
            color: rgba(226, 250, 252, 0.7);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.3s ease;
        }

        .timeframe-btn.active {
            background: rgba(0, 240, 255, 0.2);
            color: var(--primary);
        }

        .timeframe-btn:hover:not(.active) {
            background: rgba(0, 240, 255, 0.1);
        }

        .chart-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .chart-type-selector {
            display: flex;
            gap: 10px;
        }

        .chart-type-btn {
            padding: 8px 16px;
            background: rgba(0, 240, 255, 0.05);
            border: 1px solid rgba(0, 240, 255, 0.1);
            color: rgba(226, 250, 252, 0.7);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .chart-type-btn.active {
            background: rgba(0, 240, 255, 0.2);
            border-color: var(--primary);
            color: var(--primary);
        }

        .account-indicator {
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 600;
        }

        .indicator-funding {
            background: rgba(0, 240, 255, 0.2);
            color: var(--primary);
        }

        .indicator-demo {
            background: rgba(123, 44, 191, 0.2);
            color: var(--secondary);
        }

        .trading-chart {
            height: 400px;
            margin-bottom: 30px;
            background: rgba(5, 5, 16, 0.9);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .chart-container {
            width: 100%;
            height: 100%;
            position: relative;
        }

        /* Trading Pairs */
        .trading-pairs {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .pair-card {
            background: rgba(5, 5, 16, 0.9);
            border-radius: 12px;
            padding: 15px;
            border: 1px solid rgba(0, 240, 255, 0.1);
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .pair-card.active {
            border-color: var(--primary);
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
        }

        .pair-card:hover:not(.active) {
            border-color: rgba(0, 240, 255, 0.3);
            transform: translateY(-3px);
        }

        .price-flash {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            opacity: 0;
            transition: opacity 0.5s ease;
            pointer-events: none;
        }

        .flash-up {
            background: linear-gradient(to right, rgba(0, 255, 136, 0.1), transparent);
        }

        .flash-down {
            background: linear-gradient(to right, rgba(255, 0, 110, 0.1), transparent);
        }

        .pair-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .pair-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: var(--darker);
        }

        .pair-name {
            font-weight: 600;
            color: var(--light);
        }

        .pair-price {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--light);
            margin-bottom: 5px;
        }

        .pair-change {
            font-size: 0.9rem;
            font-weight: 600;
        }

        .pair-volume {
            font-size: 0.8rem;
            color: rgba(226, 250, 252, 0.6);
            margin-top: 5px;
        }

        /* Right Panel */
        .right-panel {
            display: flex;
            flex-direction: column;
            gap: 25px;
        }

        /* Trade Interface */
        .trade-interface {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .trade-tabs {
            display: flex;
            gap: 5px;
            background: rgba(0, 240, 255, 0.05);
            padding: 4px;
            border-radius: 10px;
            margin-bottom: 20px;
        }

        .trade-tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            border: none;
            background: transparent;
            color: rgba(226, 250, 252, 0.7);
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        .trade-tab.active {
            background: rgba(0, 240, 255, 0.2);
            color: var(--primary);
        }

        .trade-tab:hover:not(.active) {
            background: rgba(0, 240, 255, 0.1);
        }

        .trade-form {
            display: none;
        }

        .trade-form.active {
            display: block;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--light);
            font-weight: 500;
            font-size: 0.9rem;
        }

        .form-control {
            width: 100%;
            padding: 10px 12px;
            background: rgba(0, 240, 255, 0.05);
            border: 1px solid rgba(0, 240, 255, 0.2);
            border-radius: 8px;
            color: var(--light);
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
        }

        .amount-selector {
            display: flex;
            gap: 8px;
            margin-top: 10px;
        }

        .amount-btn {
            flex: 1;
            padding: 6px;
            background: rgba(0, 240, 255, 0.05);
            border: 1px solid rgba(0, 240, 255, 0.1);
            border-radius: 6px;
            color: rgba(226, 250, 252, 0.7);
            text-align: center;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.3s ease;
        }

        .amount-btn:hover {
            background: rgba(0, 240, 255, 0.1);
            border-color: rgba(0, 240, 255, 0.3);
        }

        .trade-summary {
            background: rgba(5, 5, 16, 0.9);
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 0.9rem;
        }

        .summary-row:last-child {
            margin-bottom: 0;
            padding-top: 10px;
            border-top: 1px solid rgba(0, 240, 255, 0.1);
            font-weight: 700;
            color: var(--primary);
        }

        .trade-btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .buy-btn {
            background: linear-gradient(135deg, var(--success), #00cc66);
            color: var(--darker);
        }

        .sell-btn {
            background: linear-gradient(135deg, var(--danger), #cc0052);
            color: var(--darker);
        }

        .trade-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        }

        /* Portfolio */
        .portfolio {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .portfolio-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .portfolio-header h2 {
            color: var(--light);
            font-size: 1.3rem;
        }

        .portfolio-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .portfolio-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: rgba(5, 5, 16, 0.9);
            border-radius: 10px;
            margin-bottom: 10px;
            border: 1px solid rgba(0, 240, 255, 0.05);
        }

        .portfolio-item:last-child {
            margin-bottom: 0;
        }

        .coin-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .coin-amount {
            font-weight: 600;
            color: var(--light);
        }

        .coin-value {
            font-size: 0.8rem;
            color: rgba(226, 250, 252, 0.6);
        }

        .coin-change {
            font-weight: 600;
            font-size: 0.9rem;
        }

        /* Live Chat */
        .live-chat {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .chat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .chat-header h2 {
            color: var(--light);
            font-size: 1.3rem;
        }

        .chat-messages {
            height: 200px;
            overflow-y: auto;
            margin-bottom: 15px;
            padding: 15px;
            background: rgba(5, 5, 16, 0.9);
            border-radius: 10px;
            border: 1px solid rgba(0, 240, 255, 0.05);
        }

        .chat-message {
            margin-bottom: 12px;
            padding: 10px;
            background: rgba(0, 240, 255, 0.05);
            border-radius: 8px;
        }

        .chat-message:last-child {
            margin-bottom: 0;
        }

        .username {
            font-weight: 600;
            color: var(--primary);
            margin-right: 8px;
        }

        .message {
            color: rgba(226, 250, 252, 0.9);
        }

        .time {
            font-size: 0.7rem;
            color: rgba(226, 250, 252, 0.5);
            text-align: right;
            margin-top: 5px;
        }

        .chat-input {
            display: flex;
            gap: 10px;
        }

        .chat-input input {
            flex: 1;
            padding: 10px 12px;
            background: rgba(0, 240, 255, 0.05);
            border: 1px solid rgba(0, 240, 255, 0.2);
            border-radius: 8px;
            color: var(--light);
        }

        .chat-input input:focus {
            outline: none;
            border-color: var(--primary);
        }

        .chat-input button {
            padding: 10px 20px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border: none;
            border-radius: 8px;
            color: var(--darker);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .chat-input button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 240, 255, 0.3);
        }

        /* Recent Activity */
        .recent-activity {
            background: rgba(10, 10, 31, 0.8);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .recent-activity h2 {
            color: var(--light);
            font-size: 1.3rem;
            margin-bottom: 15px;
        }

        .activity-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .activity-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: rgba(5, 5, 16, 0.9);
            border-radius: 10px;
            margin-bottom: 10px;
            border-left: 3px solid var(--primary);
        }

        .activity-item:last-child {
            margin-bottom: 0;
        }

        .activity-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .activity-icon {
            width: 35px;
            height: 35px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
        }

        .activity-details h4 {
            color: var(--light);
            font-size: 0.9rem;
            margin-bottom: 2px;
        }

        .activity-details p {
            color: rgba(226, 250, 252, 0.6);
            font-size: 0.7rem;
        }

        .activity-amount {
            font-weight: 600;
            font-size: 0.9rem;
        }

        .positive-amount {
            color: var(--success);
        }

        .negative-amount {
            color: var(--danger);
        }

        /* Notification Bell */
        .notification-bell {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: var(--darker);
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 5px 20px rgba(0, 240, 255, 0.4);
            transition: all 0.3s ease;
        }

        .notification-bell:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(0, 240, 255, 0.6);
        }

        .notification-count {
            position: absolute;
            top: -5px;
            right: -5px;
            background: var(--danger);
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 600;
        }

        /* Notifications */
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(10, 10, 31, 0.95);
            color: var(--light);
            padding: 15px 20px;
            border-radius: 10px;
            border: 1px solid rgba(0, 240, 255, 0.3);
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            max-width: 350px;
            animation: slideIn 0.3s ease;
            backdrop-filter: blur(10px);
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .notification.success {
            border-left: 4px solid var(--success);
        }

        .notification.warning {
            border-left: 4px solid var(--warning);
        }

        .notification.info {
            border-left: 4px solid var(--primary);
        }

        .notification-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 1.2rem;
        }

        .notification.success .notification-icon {
            background: rgba(0, 255, 136, 0.2);
            color: var(--success);
        }

        .notification.warning .notification-icon {
            background: rgba(255, 204, 0, 0.2);
            color: var(--warning);
        }

        .notification.info .notification-icon {
            background: rgba(0, 240, 255, 0.2);
            color: var(--primary);
        }

        .notification-content {
            flex: 1;
            min-width: 0;
        }

        .notification-title {
            font-weight: 700;
            margin-bottom: 5px;
            font-size: 1rem;
        }

        .notification-message {
            color: rgba(226, 250, 252, 0.8);
            font-size: 0.9rem;
            line-height: 1.4;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        /* Loading Spinner */
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(0, 240, 255, 0.2);
            border-top: 3px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 1200px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            
            .right-panel {
                grid-column: 1;
                grid-row: 3;
            }
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 15px;
            }
            
            .dashboard-header {
                flex-direction: column;
                gap: 15px;
                text-align: center;
            }
            
            .account-balances {
                grid-template-columns: 1fr;
            }
            
            .trading-pairs {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            }
            
            .section-header {
                flex-direction: column;
                gap: 15px;
                align-items: flex-start;
            }
            
            .timeframe-selector {
                width: 100%;
            }
            
            .chart-controls {
                flex-direction: column;
                gap: 15px;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <!-- Dashboard Header -->
    <div class="container">
        <div class="dashboard-header">
            <a href="/" class="back-button">
                <i class="fas fa-arrow-left"></i>
                Back to Home
            </a>
            <div class="header-controls">
                <div id="connectionStatus" style="display: flex; align-items: center; gap: 8px; color: var(--success);">
                    <i class="fas fa-circle" style="font-size: 0.7rem;"></i>
                    <span>Connected</span>
                </div>
                <a href="mailto:support@quantumcoin.com" class="support-link">
                    <i class="fas fa-envelope"></i>
                    Support
                </a>
            </div>
        </div>
    </div>

    <div class="container">
        <div class="dashboard">
            <!-- Sidebar -->
            <div class="sidebar">
                <div class="user-profile">
                    <div class="avatar" id="userAvatar">QC</div>
                    <h2 id="usernameDisplay">Loading...</h2>
                    <p id="userEmail">Premium Trader</p>
                </div>
                
                <!-- Account Selector -->
                <div class="account-selector" id="accountSelector">
                    <div class="account-btn active" data-account="funding">
                        <i class="fas fa-wallet"></i>
                        Funding Account
                        <span class="account-badge">REAL</span>
                    </div>
                    <div class="account-btn" data-account="demo">
                        <i class="fas fa-flask"></i>
                        Demo Account
                        <span class="account-badge">$100K</span>
                    </div>
                </div>
                
                <ul class="nav-menu">
                    <li><a href="#" class="active"><i class="fas fa-chart-line"></i> Dashboard</a></li>
                    <li><a href="deposit.html"><i class="fas fa-plus-circle"></i> Deposit</a></li>
                    <li><a href="withdraw.html"><i class="fas fa-external-link-alt"></i> Withdraw</a></li>
                    <li><a href="#" id="historyBtn"><i class="fas fa-history"></i> History</a></li>
                    <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
                </ul>
            </div>
            
            <!-- Notifications Container -->
            <div class="notifications-container" id="notificationsContainer" style="display: none;">
                <div class="notification-header">
                    <h3><i class="fas fa-bell"></i> Notifications</h3>
                    <button class="clear-notifications" id="clearNotifications">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="notifications-list" id="notificationsList">
                    <!-- Notifications will be loaded here -->
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="main-content">
                <!-- Welcome Banner -->
                <div class="welcome-banner">
                    <h1>Welcome Back, <span id="greetingName">Trader</span>!</h1>
                    <p>Ready to make some profitable trades? The market is looking hot today.</p>
                    
                    <!-- Account Balances -->
                    <div class="account-balances">
                        <div class="balance-card funding active" id="fundingBalanceCard">
                            <div class="balance-header">
                                <h3>Funding Account Balance</h3>
                                <span class="balance-badge badge-funding">REAL MONEY</span>
                            </div>
                            <div class="balance-amount" id="fundingBalance">$0.00</div>
                            <p style="color: rgba(226, 250, 252, 0.7); font-size: 0.9rem; margin-top: 5px;">
                                <span class="positive"><i class="fas fa-arrow-up"></i> Add funds to start trading</span>
                            </p>
                            <div class="balance-actions">
                                <button class="balance-btn deposit-balance-btn" onclick="window.location.href='deposit.html'">
                                    <i class="fas fa-plus-circle"></i> Add Funds
                                </button>
                                <button class="balance-btn withdraw-balance-btn" onclick="window.location.href='withdraw.html'">
                                    <i class="fas fa-external-link-alt"></i> Withdraw
                                </button>
                            </div>
                        </div>
                        
                        <div class="balance-card demo" id="demoBalanceCard">
                            <div class="balance-header">
                                <h3>Demo Account Balance</h3>
                                <span class="balance-badge badge-demo">PRACTICE</span>
                            </div>
                            <div class="balance-amount" id="demoBalance">$0.00</div>
                            <p style="color: rgba(226, 250, 252, 0.7); font-size: 0.9rem; margin-top: 5px;">
                                <span><i class="fas fa-flask"></i> Practice trading with virtual money</span>
                            </p>
                            <div class="balance-actions">
                                <button class="balance-btn deposit-balance-btn" style="opacity: 0.5; cursor: not-allowed;" disabled>
                                    <i class="fas fa-plus-circle"></i> Demo Only
                                </button>
                                <button class="balance-btn withdraw-balance-btn" style="opacity: 0.5; cursor: not-allowed;" disabled>
                                    <i class="fas fa-external-link-alt"></i> Demo Only
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Pending Transactions -->
                    <div class="pending-transactions">
                        <h3 style="color: var(--primary); margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <span>Recent Transactions</span>
                            <span class="badge-funding" style="font-size: 0.7rem;">Live</span>
                        </h3>
                        <div id="pendingTransactionsList">
                            <div style="text-align: center; color: rgba(226, 250, 252, 0.5); padding: 20px;">
                                Loading transactions...
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Trading View -->
                <div class="trading-section">
                    <div class="section-header">
                        <h2>Live Trading View - <span id="selectedCoinName">Bitcoin (BTC)</span></h2>
                        <div class="timeframe-selector">
                            <button class="timeframe-btn active" data-timeframe="1h">1H</button>
                            <button class="timeframe-btn" data-timeframe="1d">1D</button>
                            <button class="timeframe-btn" data-timeframe="1w">1W</button>
                            <button class="timeframe-btn" data-timeframe="1m">1M</button>
                            <button class="timeframe-btn" data-timeframe="1y">1Y</button>
                        </div>
                    </div>
                    
                    <!-- Chart Controls -->
                    <div class="chart-controls">
                        <div class="chart-type-selector">
                            <button class="chart-type-btn active" data-chart="candlestick">Candlestick</button>
                            <button class="chart-type-btn" data-chart="line">Line Chart</button>
                        </div>
                        <div style="color: rgba(226, 250, 252, 0.7); font-size: 0.9rem;">
                            Trading with: <span id="currentAccountIndicator" class="account-indicator indicator-funding">Funding Account</span>
                        </div>
                    </div>
                    
                    <div class="trading-chart" id="tradingChart">
                        <div class="chart-container">
                            <canvas id="priceChart"></canvas>
                        </div>
                    </div>
                    
                    <h3>Top Cryptocurrencies - Today's Movement</h3>
                    <div class="trading-pairs" id="tradingPairs">
                        <!-- Trading pairs will be loaded here -->
                    </div>
                </div>
            </div>

            <!-- Right Panel -->
            <div class="right-panel">
                <!-- Trading Interface -->
                <div class="trade-interface">
                    <div class="trade-tabs">
                        <div class="trade-tab active" data-tab="buy">Buy</div>
                        <div class="trade-tab" data-tab="sell">Sell</div>
                    </div>
                    
                    <!-- Account Selection for Trading -->
                    <div class="form-group">
                        <label>Trade Using Account</label>
                        <div class="account-selector" id="tradeAccountSelector" style="margin-top: 5px;">
                            <div class="account-btn active" data-account="funding">
                                <i class="fas fa-wallet"></i>
                                Funding Account
                            </div>
                            <div class="account-btn" data-account="demo">
                                <i class="fas fa-flask"></i>
                                Demo Account
                            </div>
                        </div>
                    </div>
                    
                    <!-- Buy Form -->
                    <form class="trade-form active" id="buyForm">
                        <div class="form-group">
                            <label for="buyCoin">Coin</label>
                            <select id="buyCoin" class="form-control">
                                <option value="BTC">Bitcoin (BTC)</option>
                                <option value="ETH">Ethereum (ETH)</option>
                                <option value="DOGE">Dogecoin (DOGE)</option>
                                <option value="SHIB">Shiba Inu (SHIB)</option>
                                <option value="ADA">Cardano (ADA)</option>
                                <option value="SOL">Solana (SOL)</option>
                                <option value="XRP">Ripple (XRP)</option>
                                <option value="BNB">Binance Coin (BNB)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="buyAmount">Amount (USD)</label>
                            <input type="number" id="buyAmount" class="form-control" placeholder="0.00" min="10" step="0.01" value="100">
                            <div class="amount-selector">
                                <div class="amount-btn" data-amount="50">$50</div>
                                <div class="amount-btn" data-amount="100">$100</div>
                                <div class="amount-btn" data-amount="500">$500</div>
                                <div class="amount-btn" data-amount="1000">$1K</div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="buyPrice">Current Price</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="text" id="buyPrice" class="form-control" value="$0.00" readonly style="flex: 1;">
                                <span id="buyPriceChange" style="font-size: 0.9rem; padding: 4px 8px; border-radius: 5px; font-weight: 600;">+0.00%</span>
                            </div>
                        </div>
                        
                        <!-- Prediction Selection -->
                        <div class="form-group">
                            <label>Make Prediction</label>
                            <div class="amount-selector">
                                <div class="amount-btn" data-prediction="up" style="background: rgba(0,255,136,0.1); color: var(--success);">
                                    <i class="fas fa-arrow-up"></i> Price Will Go Up
                                </div>
                                <div class="amount-btn" data-prediction="down" style="background: rgba(255,0,110,0.1); color: var(--danger);">
                                    <i class="fas fa-arrow-down"></i> Price Will Go Down
                                </div>
                            </div>
                        </div>
                        
                        <div class="trade-summary">
                            <div class="summary-row">
                                <span>Total Cost</span>
                                <span id="buyTotal">$100.00</span>
                            </div>
                            <div class="summary-row">
                                <span>Fee (0.1%)</span>
                                <span id="buyFee">$0.10</span>
                            </div>
                            <div class="summary-row">
                                <span>You Receive</span>
                                <span id="buyReceive">0.00000 BTC</span>
                            </div>
                        </div>
                        
                        <button type="submit" class="trade-btn buy-btn">
                            <i class="fas fa-shopping-cart"></i>
                            Buy Now
                        </button>
                    </form>
                    
                    <!-- Sell Form -->
                    <form class="trade-form" id="sellForm">
                        <div class="form-group">
                            <label for="sellCoin">Coin</label>
                            <select id="sellCoin" class="form-control">
                                <option value="BTC">Bitcoin (BTC)</option>
                                <option value="ETH">Ethereum (ETH)</option>
                                <option value="DOGE">Dogecoin (DOGE)</option>
                                <option value="SHIB">Shiba Inu (SHIB)</option>
                                <option value="ADA">Cardano (ADA)</option>
                                <option value="SOL">Solana (SOL)</option>
                                <option value="XRP">Ripple (XRP)</option>
                                <option value="BNB">Binance Coin (BNB)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="sellAmount">Amount (Coin)</label>
                            <input type="number" id="sellAmount" class="form-control" placeholder="0.00" min="0.0001" step="0.0001" value="0.1">
                            <div class="amount-selector">
                                <div class="amount-btn" data-percent="25">25%</div>
                                <div class="amount-btn" data-percent="50">50%</div>
                                <div class="amount-btn" data-percent="75">75%</div>
                                <div class="amount-btn" data-percent="100">100%</div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="sellPrice">Current Price</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="text" id="sellPrice" class="form-control" value="$0.00" readonly style="flex: 1;">
                                <span id="sellPriceChange" style="font-size: 0.9rem; padding: 4px 8px; border-radius: 5px; font-weight: 600;">+0.00%</span>
                            </div>
                        </div>
                        
                        <div class="trade-summary">
                            <div class="summary-row">
                                <span>Total Value</span>
                                <span id="sellTotal">$0.00</span>
                            </div>
                            <div class="summary-row">
                                <span>Fee (0.1%)</span>
                                <span id="sellFee">$0.00</span>
                            </div>
                            <div class="summary-row">
                                <span>You Receive</span>
                                <span id="sellReceive">$0.00</span>
                            </div>
                        </div>
                        
                        <button type="submit" class="trade-btn sell-btn">
                            <i class="fas fa-dollar-sign"></i>
                            Sell Now
                        </button>
                    </form>
                </div>

                <!-- Portfolio -->
                <div class="portfolio">
                    <div class="portfolio-header">
                        <h2>Live Portfolio <span id="portfolioAccountIndicator" class="account-indicator indicator-funding">Funding</span></h2>
                        <span class="positive" id="portfolioChange">+0.00%</span>
                    </div>
                    <div class="portfolio-list" id="portfolioList">
                        <div class="portfolio-item">
                            <div class="coin-info">
                                <div style="width: 30px; height: 30px; border-radius: 50%; background: rgba(0, 240, 255, 0.1); display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-wallet" style="color: rgba(226, 250, 252, 0.5);"></i>
                                </div>
                                <div>
                                    <div class="coin-amount">Loading portfolio...</div>
                                    <div class="coin-value">Please wait</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Live Chat -->
                <div class="live-chat">
                    <div class="chat-header">
                        <h2>Live Trader Chat</h2>
                        <span class="positive" style="font-size: 0.8rem;">
                            <i class="fas fa-users"></i> <span id="onlineCount">0</span> Online
                        </span>
                    </div>
                    <div class="chat-messages" id="chatMessages">
                        <!-- Chat messages will be added here -->
                    </div>
                    <div class="chat-input">
                        <input type="text" id="chatInput" placeholder="Share your trading experience...">
                        <button id="sendMessageBtn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="recent-activity">
                    <h2>Recent Activity</h2>
                    <div class="activity-list" id="activityList">
                        <!-- Activities will be loaded here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Notification Bell -->
    <div class="notification-bell" id="notificationBell">
        <i class="fas fa-bell"></i>
        <span class="notification-count" id="notificationCount">0</span>
    </div>

    <script>
        // ========== GLOBAL VARIABLES ==========
        // ✅ FIXED API_URL (without /api at the end)
        const API_URL = 'https://quantum-coin-backend.onrender.com';
        
        const SOCKET_URL = 'https://quantum-coin-backend.onrender.com';
        
        let socket = null;
        let currentUser = null;
        let token = null;
        let currentAccountType = 'funding';
        let selectedCoin = 'BTC';
        let chartType = 'candlestick';
        let timeframe = '1h';
        let priceChart = null;
        let cryptoData = {};
        let userPortfolio = [];
        let userTransactions = [];
        let chatMessages = [];
        let notifications = [];
        let onlineCount = Math.floor(Math.random() * 50) + 100;
        let currentPrediction = 'up';

        // ========== INITIALIZATION ==========
        document.addEventListener('DOMContentLoaded', function() {
            // Check if user is logged in
            token = localStorage.getItem('quantumcoin_token');
            currentUser = JSON.parse(localStorage.getItem('quantumcoin_user') || 'null');
            
            if (!token || !currentUser) {
                window.location.href = '/';
                return;
            }
            
            // Initialize WebSocket connection
            initializeWebSocket();
            
            // Load initial data
            loadUserData();
            loadMarketData();
            loadPortfolio();
            loadTransactions();
            loadTradeHistory();
            loadChatHistory();
            
            // Setup event listeners
            initializeEventListeners();
            
            // Update online count periodically
            updateOnlineCount();
            setInterval(updateOnlineCount, 30000);
            
            // Add initial chat messages gradually
            setTimeout(addInitialChatMessages, 1000);
        });

        // ========== WEB SOCKET ==========
        function initializeWebSocket() {
            socket = io(SOCKET_URL);
            
            socket.on('connect', () => {
                updateConnectionStatus(true);
                if (currentUser && currentUser.id) {
                    socket.emit('join_user', currentUser.id);
                }
                socket.emit('get_chat_history');
            });
            
            socket.on('disconnect', () => {
                updateConnectionStatus(false);
            });
            
            socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
                updateConnectionStatus(false);
            });
            
            // Market updates
            socket.on('market_update', (data) => {
                cryptoData = data;
                updateTradingPairs();
                updateFormPrices(selectedCoin);
                updatePortfolioValues();
            });
            
            // Chat messages
            socket.on('new_chat_message', (message) => {
                addChatMessage(message);
            });
            
            socket.on('chat_history', (messages) => {
                chatMessages = messages;
                updateChatDisplay();
            });
            
            // Transaction notifications
            socket.on('deposit_approved', (data) => {
                showNotification('success', 'Deposit Approved', 
                    `$${data.totalAmount.toFixed(2)} added to your account!`);
                loadUserData();
                loadTransactions();
            });
            
            socket.on('withdrawal_approved', (data) => {
                showNotification('success', 'Withdrawal Complete', 
                    `$${data.amount.toFixed(2)} sent to ${data.network}`);
                loadUserData();
                loadTransactions();
            });
            
            // ✅ FIXED: Added receive_message handler
            socket.on('receive_message', (data) => {
                displayChatMessage(data.username, data.message);
            });
            
            // Balance updates
            socket.on('balance_update', (data) => {
                if (data.funding_balance !== undefined) {
                    currentUser.funding_balance = data.funding_balance;
                    document.getElementById('fundingBalance').textContent = `$${data.funding_balance.toFixed(2)}`;
                }
                if (data.demo_balance !== undefined) {
                    currentUser.demo_balance = data.demo_balance;
                    document.getElementById('demoBalance').textContent = `$${data.demo_balance.toFixed(2)}`;
                }
                localStorage.setItem('quantumcoin_user', JSON.stringify(currentUser));
            });
        }

        function updateConnectionStatus(connected) {
            const statusElement = document.getElementById('connectionStatus');
            if (!statusElement) return;
            
            if (connected) {
                statusElement.innerHTML = '<i class="fas fa-circle" style="font-size: 0.7rem; color: var(--success);"></i> <span>Connected</span>';
            } else {
                statusElement.innerHTML = '<i class="fas fa-circle" style="font-size: 0.7rem; color: var(--danger);"></i> <span>Disconnected</span>';
            }
        }

        // ========== API CALLS ==========
        // ✅ FIXED: Updated apiRequest function with Bearer Token
// ✅ FIXED: Updated apiRequest function with proper error handling
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    // Handle unauthorized (401)
    if (response.status === 401) {
      localStorage.removeItem('quantumcoin_token');
      localStorage.removeItem('quantumcoin_user');
      window.location.href = '/';
      throw new Error('Session expired. Please login again.');
    }
    
    // Handle other error statuses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Parse response
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error(`API request failed (${endpoint}):`, error);
    
    // Only show notification for non-auth errors
    if (!error.message.includes('Session expired')) {
      showNotification('warning', 'Request Failed', error.message);
    }
    
    // Re-throw for calling code to handle
    throw error;
  }
}

        // ========== DATA LOADING ==========
        // Add this to your initialization section after DOMContentLoaded
async function loadInitialData() {
  try {
    // Load user data
    const userData = await apiRequest('/api/user/data');
    if (userData) {
      currentUser = { ...currentUser, ...userData };
      localStorage.setItem('quantumcoin_user', JSON.stringify(currentUser));
      updateUserDisplay();
    }
    
    // Load all data in parallel
    await Promise.all([
      loadMarketData(),
      loadPortfolio(),
      loadTransactions(),
      loadTradeHistory()
    ]);
    
    // Initialize chart
    setTimeout(() => loadChartData(), 1000);
    
  } catch (error) {
    console.error('Failed to load initial data:', error);
    showNotification('warning', 'Data Loading', 'Some data may not be available. Please refresh the page.');
  }
}

// Update the DOMContentLoaded event listener:
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  token = localStorage.getItem('quantumcoin_token');
  currentUser = JSON.parse(localStorage.getItem('quantumcoin_user') || 'null');
  
  if (!token || !currentUser) {
    window.location.href = '/';
    return;
  }
  
  // Initialize WebSocket connection
  initializeWebSocket();
  
  // Load all initial data
  loadInitialData();
  
  // Setup event listeners
  initializeEventListeners();
  
  // Other initialization code...
});
        
        async function loadUserData() {
            // User data is already in localStorage from login
            updateUserDisplay();
        }

        // ✅ FIXED: Market Data Call - NOW WORKS
        async function loadMarketData() {
            const data = await apiRequest('/api/market/data');
            if (data) {
                cryptoData = data;
                initializeTradingPairs();
                updateFormPrices(selectedCoin);
                loadChartData();
            }
        }

        // ✅ FIXED: Portfolio Call - NOW WORKS
        async function loadPortfolio() {
            const data = await apiRequest('/api/portfolio');
            if (data) {
                userPortfolio = data;
                updatePortfolioDisplay();
            }
        }

        // ✅ FIXED: Transactions Call - NOW WORKS
        async function loadTransactions() {
            const data = await apiRequest('/api/transactions');
            if (data) {
                userTransactions = data;
                updateTransactionsDisplay();
                updateActivityDisplay();
            }
        }

        // ✅ FIXED: Trade History Call - NOW WORKS
        async function loadTradeHistory() {
            const data = await apiRequest('/api/trade/history');
            if (data) {
                console.log('Trade history loaded:', data);
            }
        }

        async function loadChatHistory() {
            // Chat history loaded via WebSocket
        }

        // ========== DISPLAY UPDATES ==========
        function updateUserDisplay() {
            if (!currentUser) return;
            
            document.getElementById('usernameDisplay').textContent = currentUser.username;
            document.getElementById('greetingName').textContent = currentUser.username;
            document.getElementById('userEmail').textContent = currentUser.email || 'Premium Trader';
            document.getElementById('fundingBalance').textContent = `$${currentUser.funding_balance?.toFixed(2) || '0.00'}`;
            document.getElementById('demoBalance').textContent = `$${currentUser.demo_balance?.toFixed(2) || '0.00'}`;
            
            const avatar = document.getElementById('userAvatar');
            const initials = currentUser.username.substring(0, 2).toUpperCase();
            avatar.textContent = initials;
        }

        function initializeTradingPairs() {
            const container = document.getElementById('tradingPairs');
            if (!container || !cryptoData) return;
            
            container.innerHTML = '';
            
            Object.entries(cryptoData).forEach(([symbol, data]) => {
                const pairCard = document.createElement('div');
                pairCard.className = 'pair-card';
                pairCard.dataset.symbol = symbol;
                if (symbol === selectedCoin) pairCard.classList.add('active');
                
                const isPositive = data.change >= 0;
                const volumeText = formatVolume(data.volume);
                
                pairCard.innerHTML = `
                    <div class="price-flash ${isPositive ? 'flash-up' : 'flash-down'}"></div>
                    <div class="pair-header">
                        <div class="pair-icon" style="background: linear-gradient(135deg, ${data.color}, ${data.color}dd);">
                            ${symbol.charAt(0)}
                        </div>
                        <div>
                            <div class="pair-name">${symbol}</div>
                        </div>
                    </div>
                    <div class="pair-price" id="price-${symbol}">$${formatPrice(data.price, symbol)}</div>
                    <div class="pair-change ${isPositive ? 'positive' : 'negative'}" id="change-${symbol}">
                        <i class="fas fa-${isPositive ? 'arrow-up' : 'arrow-down'}"></i>
                        ${isPositive ? '+' : ''}${data.change.toFixed(2)}%
                    </div>
                    <div class="pair-volume">Vol: ${volumeText}</div>
                `;
                
                pairCard.addEventListener('click', () => selectTradingPair(symbol));
                container.appendChild(pairCard);
            });
        }

        function updateTradingPairs() {
            if (!cryptoData) return;
            
            Object.entries(cryptoData).forEach(([symbol, data]) => {
                const priceElement = document.getElementById(`price-${symbol}`);
                const changeElement = document.getElementById(`change-${symbol}`);
                const pairCard = document.querySelector(`.pair-card[data-symbol="${symbol}"]`);
                
                if (priceElement && changeElement && pairCard) {
                    const oldPrice = parseFloat(priceElement.textContent.replace('$', '').replace(/,/g, '')) || data.price;
                    const newPrice = data.price;
                    const isPositive = data.change >= 0;
                    
                    priceElement.textContent = `$${formatPrice(newPrice, symbol)}`;
                    changeElement.innerHTML = `<i class="fas fa-${isPositive ? 'arrow-up' : 'arrow-down'}"></i> ${isPositive ? '+' : ''}${data.change.toFixed(2)}%`;
                    changeElement.className = `pair-change ${isPositive ? 'positive' : 'negative'}`;
                    
                    // Flash animation
                    const flashDiv = pairCard.querySelector('.price-flash');
                    if (newPrice > oldPrice) {
                        flashDiv.classList.add('flash-up');
                        flashDiv.classList.remove('flash-down');
                        flashDiv.style.opacity = '0.5';
                        setTimeout(() => flashDiv.style.opacity = '0', 1000);
                    } else if (newPrice < oldPrice) {
                        flashDiv.classList.add('flash-down');
                        flashDiv.classList.remove('flash-up');
                        flashDiv.style.opacity = '0.5';
                        setTimeout(() => flashDiv.style.opacity = '0', 1000);
                    }
                }
            });
        }

        function updateFormPrices(symbol) {
            if (!cryptoData[symbol]) return;
            
            const data = cryptoData[symbol];
            const buyPrice = document.getElementById('buyPrice');
            const sellPrice = document.getElementById('sellPrice');
            const buyPriceChange = document.getElementById('buyPriceChange');
            const sellPriceChange = document.getElementById('sellPriceChange');
            
            if (buyPrice) buyPrice.value = `$${formatPrice(data.price, symbol)}`;
            if (sellPrice) sellPrice.value = `$${formatPrice(data.price, symbol)}`;
            
            const isPositive = data.change >= 0;
            const changeText = `${isPositive ? '+' : ''}${data.change.toFixed(2)}%`;
            
            if (buyPriceChange) {
                buyPriceChange.textContent = changeText;
                buyPriceChange.style.background = isPositive ? 'rgba(0,255,136,0.2)' : 'rgba(255,0,110,0.2)';
                buyPriceChange.style.color = isPositive ? 'var(--success)' : 'var(--danger)';
            }
            
            if (sellPriceChange) {
                sellPriceChange.textContent = changeText;
                sellPriceChange.style.background = isPositive ? 'rgba(0,255,136,0.2)' : 'rgba(255,0,110,0.2)';
                sellPriceChange.style.color = isPositive ? 'var(--success)' : 'var(--danger)';
            }
            
            updateBuyCalculation();
            updateSellCalculation();
        }

        function updatePortfolioDisplay() {
            const container = document.getElementById('portfolioList');
            if (!container) return;
            
            container.innerHTML = '';
            
            // Filter portfolio by current account type
            const filteredPortfolio = userPortfolio.filter(item => 
                (currentAccountType === 'funding' && (!item.account_type || item.account_type === 'funding')) ||
                (currentAccountType === 'demo' && item.account_type === 'demo')
            );
            
            if (filteredPortfolio.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'portfolio-item';
                emptyMessage.innerHTML = `
                    <div class="coin-info">
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: rgba(0, 240, 255, 0.1); display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-wallet" style="color: rgba(226, 250, 252, 0.5);"></i>
                        </div>
                        <div>
                            <div class="coin-amount">No holdings yet</div>
                            <div class="coin-value">Start trading to build your portfolio</div>
                        </div>
                    </div>
                `;
                container.appendChild(emptyMessage);
                return;
            }
            
            filteredPortfolio.forEach(item => {
                const coinData = cryptoData[item.coin_symbol];
                if (!coinData) return;
                
                const currentValue = item.amount * coinData.price;
                const profitLoss = currentValue - (item.amount * item.purchase_price);
                const profitLossPercent = (profitLoss / (item.amount * item.purchase_price)) * 100;
                const isPositive = profitLoss >= 0;
                
                const portfolioItem = document.createElement('div');
                portfolioItem.className = 'portfolio-item';
                portfolioItem.innerHTML = `
                    <div class="coin-info">
                        <div class="pair-icon" style="background: linear-gradient(135deg, ${coinData.color}, ${coinData.color}dd);">
                            ${item.coin_symbol.charAt(0)}
                        </div>
                        <div>
                            <div class="coin-amount">${formatAmount(item.amount, item.coin_symbol)} ${item.coin_symbol}</div>
                            <div class="coin-value">$${currentValue.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="coin-change ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${profitLossPercent.toFixed(2)}%
                    </div>
                `;
                container.appendChild(portfolioItem);
            });
        }

        function updatePortfolioValues() {
            // This would calculate total portfolio value
            // Implement as needed
        }

        function updateTransactionsDisplay() {
            const container = document.getElementById('pendingTransactionsList');
            if (!container) return;
            
            const pendingTransactions = userTransactions.filter(t => t.status === 'pending');
            
            if (pendingTransactions.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: rgba(226, 250, 252, 0.5); padding: 20px;">No pending transactions</div>';
                return;
            }
            
            container.innerHTML = '';
            
            pendingTransactions.slice(0, 5).forEach(transaction => {
                const isDeposit = transaction.type === 'deposit';
                const time = new Date(transaction.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                const transactionDiv = document.createElement('div');
                transactionDiv.className = 'transaction-item';
                transactionDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: rgba(0, 240, 255, 0.05);
                    border-radius: 10px;
                    margin-bottom: 10px;
                    border-left: 3px solid ${isDeposit ? 'var(--success)' : 'var(--warning)'};
                `;
                
                transactionDiv.innerHTML = `
                    <div>
                        <div style="font-weight: 600; color: ${isDeposit ? 'var(--success)' : 'var(--warning)'};">
                            ${isDeposit ? '⬇ Deposit' : '⬆ Withdrawal'}
                        </div>
                        <div style="font-size: 0.8rem; color: rgba(226, 250, 252, 0.6);">
                            ${time} | ${transaction.status}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: var(--light);">
                            $${transaction.amount.toFixed(2)}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--warning);">
                            ⏳ Pending Approval
                        </div>
                    </div>
                `;
                
                container.appendChild(transactionDiv);
            });
        }
        
        function updateActivityDisplay() {
            const container = document.getElementById('activityList');
            if (!container) return;
            
            container.innerHTML = '';
            
            userTransactions.slice(0, 10).forEach(transaction => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                
                const isPositive = transaction.type === 'deposit' || transaction.type === 'buy';
                const valuePrefix = isPositive ? '+' : '-';
                const time = new Date(transaction.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const date = new Date(transaction.created_at).toLocaleDateString();
                
                const activityIcons = {
                    'deposit': { icon: 'fa-plus-circle', color: 'var(--primary)', text: 'Deposited' },
                    'withdrawal': { icon: 'fa-external-link-alt', color: 'var(--warning)', text: 'Withdrew' },
                    'buy': { icon: 'fa-shopping-cart', color: 'var(--success)', text: 'Bought' },
                    'sell': { icon: 'fa-dollar-sign', color: 'var(--danger)', text: 'Sold' }
                };
                
                const activity = activityIcons[transaction.type] || { icon: 'fa-exchange-alt', color: 'var(--primary)', text: 'Transaction' };
                
                activityItem.innerHTML = `
                    <div class="activity-info">
                        <div class="activity-icon" style="background: ${activity.color}20; color: ${activity.color};">
                            <i class="fas ${activity.icon}"></i>
                        </div>
                        <div class="activity-details">
                            <h4>${activity.text} $${transaction.amount.toFixed(2)}</h4>
                            <p>${date} ${time}</p>
                        </div>
                    </div>
                    <div class="activity-amount ${isPositive ? 'positive-amount' : 'negative-amount'}">
                        ${valuePrefix}$${transaction.amount.toFixed(2)}
                    </div>
                `;
                container.appendChild(activityItem);
            });
        }

        // ========== CHART FUNCTIONS ==========
        async function loadChartData() {
            const data = await apiRequest(`/api/market/chart/${selectedCoin}/${timeframe}`);
            if (data && data.length > 0) {
                renderChart(data);
            }
        }

        function renderChart(chartData) {
            const ctx = document.getElementById('priceChart').getContext('2d');
            
            if (priceChart) {
                priceChart.destroy();
            }
            
            if (chartType === 'candlestick') {
                // Convert data for candlestick chart
                const candlestickData = chartData.map(point => ({
                    t: new Date(point.time),
                    o: point.open,
                    h: point.high,
                    l: point.low,
                    c: point.close
                }));
                
                priceChart = new Chart(ctx, {
                    type: 'candlestick',
                    data: {
                        datasets: [{
                            label: `${selectedCoin} Price`,
                            data: candlestickData,
                            color: {
                                up: '#00ff88',
                                down: '#ff006e',
                                unchanged: '#999999'
                            },
                            borderColor: 'rgba(0, 240, 255, 0.5)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: timeframe === '1h' ? 'minute' : 
                                          timeframe === '1d' ? 'hour' :
                                          timeframe === '1w' ? 'day' :
                                          timeframe === '1m' ? 'day' : 'month'
                                },
                                grid: { color: 'rgba(0, 240, 255, 0.1)' },
                                ticks: { color: 'rgba(226, 250, 252, 0.7)' }
                            },
                            y: {
                                position: 'right',
                                grid: { color: 'rgba(0, 240, 255, 0.1)' },
                                ticks: { 
                                    color: 'rgba(226, 250, 252, 0.7)',
                                    callback: value => '$' + value.toLocaleString()
                                }
                            }
                        }
                    }
                });
            } else {
                // Line chart
                const lineData = chartData.map(point => ({
                    x: new Date(point.time),
                    y: point.close
                }));
                
                const coinColor = cryptoData[selectedCoin]?.color || '#00f0ff';
                
                priceChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: `${selectedCoin} Price`,
                            data: lineData,
                            borderColor: coinColor,
                            backgroundColor: `${coinColor}20`,
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                grid: { color: 'rgba(0, 240, 255, 0.1)' },
                                ticks: { color: 'rgba(226, 250, 252, 0.7)' }
                            },
                            y: {
                                grid: { color: 'rgba(0, 240, 255, 0.1)' },
                                ticks: { 
                                    color: 'rgba(226, 250, 252, 0.7)',
                                    callback: value => '$' + value.toLocaleString()
                                }
                            }
                        }
                    }
                });
            }
        }

        // ========== TRADING FUNCTIONS ==========
        function updateBuyCalculation() {
            const amount = parseFloat(document.getElementById('buyAmount').value) || 0;
            const symbol = document.getElementById('buyCoin').value;
            const price = cryptoData[symbol]?.price || 0;
            
            const total = amount;
            const fee = total * 0.001;
            const receiveAmount = price > 0 ? (total - fee) / price : 0;
            
            document.getElementById('buyTotal').textContent = `$${total.toFixed(2)}`;
            document.getElementById('buyFee').textContent = `$${fee.toFixed(2)}`;
            document.getElementById('buyReceive').textContent = `${formatAmount(receiveAmount, symbol)} ${symbol}`;
        }

        function updateSellCalculation() {
            const amount = parseFloat(document.getElementById('sellAmount').value) || 0;
            const symbol = document.getElementById('sellCoin').value;
            const price = cryptoData[symbol]?.price || 0;
            
            // Find user's holdings for this coin in current account
            const holding = userPortfolio.find(p => p.coin_symbol === symbol && 
                ((currentAccountType === 'funding' && (!p.account_type || p.account_type === 'funding')) ||
                 (currentAccountType === 'demo' && p.account_type === 'demo')));
            const maxAmount = holding?.amount || 0;
            
            if (amount > maxAmount) {
                document.getElementById('sellAmount').value = maxAmount;
                return updateSellCalculation();
            }
            
            const total = amount * price;
            const fee = total * 0.001;
            const receiveAmount = total - fee;
            
            document.getElementById('sellTotal').textContent = `$${total.toFixed(2)}`;
            document.getElementById('sellFee').textContent = `$${fee.toFixed(2)}`;
            document.getElementById('sellReceive').textContent = `$${receiveAmount.toFixed(2)}`;
        }

        async function executeTrade(type) {
            const form = type === 'buy' ? document.getElementById('buyForm') : document.getElementById('sellForm');
            const symbol = form.querySelector('select').value;
            const amount = parseFloat(form.querySelector('input[type="number"]').value);
            
            if (!amount || amount <= 0) {
                showNotification('warning', 'Invalid Amount', 'Please enter a valid amount');
                return;
            }
            
            const data = {
                type: type,
                symbol: symbol,
                amount: amount,
                account_type: currentAccountType,
                prediction: type === 'buy' ? currentPrediction : null
            };
            
            const result = await apiRequest('/api/trade', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (result) {
                const message = type === 'buy' 
                    ? `Bought ${formatAmount((amount - (amount * 0.001)) / cryptoData[symbol]?.price, symbol)} ${symbol} with ${currentAccountType} account`
                    : `Sold ${amount} ${symbol} for $${((amount * cryptoData[symbol]?.price) - (amount * cryptoData[symbol]?.price * 0.001)).toFixed(2)}`;
                
                showNotification('success', 'Trade Executed', message);
                
                // Update user data
                currentUser.funding_balance = result.funding_balance || currentUser.funding_balance;
                currentUser.demo_balance = result.demo_balance || currentUser.demo_balance;
                localStorage.setItem('quantumcoin_user', JSON.stringify(currentUser));
                updateUserDisplay();
                
                // Reload portfolio and transactions
                loadPortfolio();
                loadTransactions();
                loadTradeHistory();
                
                // Reset form
                if (type === 'buy') {
                    document.getElementById('buyAmount').value = '100';
                } else {
                    document.getElementById('sellAmount').value = '0.1';
                }
                updateBuyCalculation();
                updateSellCalculation();
            }
        }

        // ========== CHAT FUNCTIONS ==========
        function addInitialChatMessages() {
            const initialMessages = [
                "Welcome to QuantumCoin! Start trading now!",
                "BTC looking bullish today!",
                "Just made 5% profit on ETH!",
                "Market seems volatile today",
                "Great platform! Very user friendly"
            ];
            
            let delay = 1000;
            
            initialMessages.forEach((message, index) => {
                setTimeout(() => {
                    const randomUsername = `Trader${Math.floor(Math.random() * 1000)}`;
                    addChatMessage({
                        userId: 0,
                        username: randomUsername,
                        message: message,
                        timestamp: new Date().toISOString()
                    });
                }, delay);
                
                delay += 60000;
            });
        }

        // ✅ FIXED: Added displayChatMessage function
        function displayChatMessage(username, message) {
            addChatMessage({
                userId: 0,
                username: username,
                message: message,
                timestamp: new Date().toISOString()
            });
        }

        function addChatMessage(message) {
            const container = document.getElementById('chatMessages');
            if (!container) return;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-message';
            
            const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            msgDiv.innerHTML = `
                <div>
                    <span class="username">${message.username}:</span>
                    <span class="message">${message.message}</span>
                </div>
                <div class="time">${time}</div>
            `;
            
            container.appendChild(msgDiv);
            container.scrollTop = container.scrollHeight;
        }

        function updateChatDisplay() {
            const container = document.getElementById('chatMessages');
            if (!container) return;
            
            container.innerHTML = '';
            
            chatMessages.forEach(message => {
                addChatMessage(message);
            });
        }

        function updateOnlineCount() {
            const onlineCountElement = document.getElementById('onlineCount');
            if (!onlineCountElement) return;
            
            const randomChange = Math.floor(Math.random() * 10) - 5;
            onlineCount = Math.max(100, onlineCount + randomChange);
            onlineCountElement.textContent = onlineCount;
        }

        function sendChatMessage() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            
            if (message && socket && currentUser) {
                socket.emit('chat_message', {
                    userId: currentUser.id,
                    username: currentUser.username,
                    message: message
                });
                input.value = '';
            }
        }

        // ========== EVENT LISTENERS ==========
        function initializeEventListeners() {
            // Account selector
            document.querySelectorAll('#accountSelector .account-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    currentAccountType = this.dataset.account;
                    
                    document.querySelectorAll('#accountSelector .account-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.account === currentAccountType);
                    });
                    
                    document.querySelectorAll('#tradeAccountSelector .account-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.account === currentAccountType);
                    });
                    
                    document.getElementById('fundingBalanceCard').classList.toggle('active', currentAccountType === 'funding');
                    document.getElementById('demoBalanceCard').classList.toggle('active', currentAccountType === 'demo');
                    
                    // Update indicators
                    const indicator = document.getElementById('currentAccountIndicator');
                    const portfolioIndicator = document.getElementById('portfolioAccountIndicator');
                    
                    if (currentAccountType === 'funding') {
                        indicator.textContent = 'Funding Account';
                        indicator.className = 'account-indicator indicator-funding';
                        portfolioIndicator.textContent = 'Funding';
                        portfolioIndicator.className = 'account-indicator indicator-funding';
                    } else {
                        indicator.textContent = 'Demo Account';
                        indicator.className = 'account-indicator indicator-demo';
                        portfolioIndicator.textContent = 'Demo';
                        portfolioIndicator.className = 'account-indicator indicator-demo';
                    }
                    
                    // Reload portfolio for selected account
                    loadPortfolio();
                });
            });
            
            // Trade account selector
            document.querySelectorAll('#tradeAccountSelector .account-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    currentAccountType = this.dataset.account;
                    
                    document.querySelectorAll('#tradeAccountSelector .account-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.account === currentAccountType);
                    });
                    
                    document.querySelectorAll('#accountSelector .account-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.account === currentAccountType);
                    });
                    
                    // Reload portfolio for selected account
                    loadPortfolio();
                });
            });
            
            // Trade tabs
            document.querySelectorAll('.trade-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    const tabName = this.dataset.tab;
                    
                    document.querySelectorAll('.trade-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    document.querySelectorAll('.trade-form').forEach(form => form.classList.remove('active'));
                    document.getElementById(`${tabName}Form`).classList.add('active');
                });
            });
            
            // Buy form
            document.getElementById('buyAmount').addEventListener('input', updateBuyCalculation);
            document.getElementById('buyCoin').addEventListener('change', function() {
                selectTradingPair(this.value);
            });
            
            // Sell form
            document.getElementById('sellAmount').addEventListener('input', updateSellCalculation);
            document.getElementById('sellCoin').addEventListener('change', function() {
                selectTradingPair(this.value);
            });
            
            // Prediction buttons
            document.querySelectorAll('[data-prediction]').forEach(btn => {
                btn.addEventListener('click', function() {
                    currentPrediction = this.dataset.prediction;
                    
                    document.querySelectorAll('[data-prediction]').forEach(b => {
                        b.style.background = b.dataset.prediction === currentPrediction 
                            ? (currentPrediction === 'up' ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,110,0.3)')
                            : 'rgba(0, 240, 255, 0.05)';
                        b.style.color = b.dataset.prediction === currentPrediction
                            ? (currentPrediction === 'up' ? 'var(--success)' : 'var(--danger)')
                            : 'rgba(226, 250, 252, 0.7)';
                    });
                });
            });
            
            // Amount buttons
            document.querySelectorAll('#buyForm .amount-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const amount = this.dataset.amount;
                    document.getElementById('buyAmount').value = amount;
                    updateBuyCalculation();
                });
            });
            
            document.querySelectorAll('#sellForm .amount-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const percent = this.dataset.percent;
                    const symbol = document.getElementById('sellCoin').value;
                    const holding = userPortfolio.find(p => p.coin_symbol === symbol && 
                        ((currentAccountType === 'funding' && (!p.account_type || p.account_type === 'funding')) ||
                         (currentAccountType === 'demo' && p.account_type === 'demo')));
                    const maxAmount = holding?.amount || 0;
                    const amount = (maxAmount * percent) / 100;
                    document.getElementById('sellAmount').value = formatAmount(amount, symbol, true);
                    updateSellCalculation();
                });
            });
            
            // Buy/Sell forms
            document.getElementById('buyForm').addEventListener('submit', function(e) {
                e.preventDefault();
                executeTrade('buy');
            });
            
            document.getElementById('sellForm').addEventListener('submit', function(e) {
                e.preventDefault();
                executeTrade('sell');
            });
            
            // Chart timeframe buttons
            document.querySelectorAll('.timeframe-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    timeframe = this.dataset.timeframe;
                    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    loadChartData();
                });
            });
            
            // Chart type buttons
            document.querySelectorAll('.chart-type-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    chartType = this.dataset.chart;
                    document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    loadChartData();
                });
            });
            
            // Chat input
            document.getElementById('sendMessageBtn').addEventListener('click', sendChatMessage);
            document.getElementById('chatInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendChatMessage();
                }
            });
            
            // History button
            document.getElementById('historyBtn').addEventListener('click', function(e) {
                e.preventDefault();
                loadTransactions();
                loadTradeHistory();
                showNotification('info', 'History Refreshed', 'Transaction and trade history have been updated');
            });
            
            // Logout
            document.getElementById('logoutBtn').addEventListener('click', function(e) {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    // Call logout API
                    apiRequest('/api/auth/logout', {
                        method: 'POST'
                    });
                    
                    localStorage.removeItem('quantumcoin_token');
                    localStorage.removeItem('quantumcoin_user');
                    window.location.href = '/';
                }
            });
            
            // Notification bell
            document.getElementById('notificationBell').addEventListener('click', function() {
                if (notifications.length > 0) {
                    let message = 'Recent Notifications:\n\n';
                    notifications.slice(0, 5).forEach(notif => {
                        message += `• ${notif.title}: ${notif.message}\n`;
                    });
                    alert(message);
                } else {
                    alert('No new notifications');
                }
            });
        }

        // ========== UTILITY FUNCTIONS ==========
        function selectTradingPair(symbol) {
            selectedCoin = symbol;
            const coinData = cryptoData[symbol];
            
            if (coinData) {
                document.querySelectorAll('.pair-card').forEach(card => {
                    card.classList.remove('active');
                });
                const selectedCard = document.querySelector(`.pair-card[data-symbol="${symbol}"]`);
                if (selectedCard) selectedCard.classList.add('active');
                
                document.getElementById('selectedCoinName').textContent = `${coinData.name} (${symbol})`;
                document.getElementById('buyCoin').value = symbol;
                document.getElementById('sellCoin').value = symbol;
                
                updateFormPrices(symbol);
                loadChartData();
            }
        }

        function showNotification(type, title, message, duration = 5000) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div class="notification-icon">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Auto remove
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, duration);
            
            // Add to notifications list
            notifications.unshift({ type, title, message, timestamp: new Date() });
            if (notifications.length > 20) notifications.pop();
            
            // Update notification count
            const unreadCount = notifications.length;
            document.getElementById('notificationCount').textContent = unreadCount > 9 ? '9+' : unreadCount;
        }

        function formatPrice(price, symbol) {
            if (price >= 1000) {
                return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (price >= 1) {
                return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            } else if (price >= 0.01) {
                return price.toFixed(4);
            } else if (price >= 0.0001) {
                return price.toFixed(6);
            } else {
                return price.toFixed(8);
            }
        }

function formatAmount(amount, symbol, forInput = false) {
    const precisionMap = {
        // High precision (8 decimals)
        BTC: 8,
        ETH: 8,
        BNB: 8,
        LTC: 8,
        SOL: 8,
        AVAX: 8,
        DOT: 8,
        MATIC: 8,

        // Medium precision (4 decimals)
        LINK: 4,
        TRX: 4,
        UNI: 4,
        ATOM: 4,
        NEAR: 4,
        ALGO: 4,

        // Low precision (2 decimals)
        DOGE: 2,
        XRP: 2,
        ADA: 2,
        TON: 2,
        FIL: 2,
        ETC: 2,

        // Whole numbers only
        SHIB: 0,
        PEPE: 0,
        FLOKI: 0
    };

    const decimals = precisionMap[symbol] ?? 4;

    if (forInput) {
        return amount.toFixed(decimals);
    }

    if (decimals === 0) {
        return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    return amount.toFixed(decimals).replace(/\.?0+$/, '');
}


        function formatVolume(volume) {
            if (volume >= 1000000000) {
                return `$${(volume / 1000000000).toFixed(2)}B`;
            } else if (volume >= 1000000) {
                return `$${(volume / 1000000).toFixed(2)}M`;
            } else if (volume >= 1000) {
                return `$${(volume / 1000).toFixed(2)}K`;
            } else {
                return `$${volume.toFixed(2)}`;
            }
        }
    </script>
</body>
</html>
