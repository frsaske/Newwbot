const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateCodeZipBuffer } = require('./backupZip');
const { sections } = require('../commands/registry');
const settings = require('../settings');
const { generateAliveCard } = require('../commands/alive');
const { generateSpeedCard } = require('../commands/ping');

let firebaseConfig = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load firebase-applet-config.json:', e);
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds = seconds % (24 * 60 * 60);
  const hours = Math.floor(seconds / (60 * 60));
  seconds = seconds % (60 * 60);
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);

  // API: Download Codebase ZIP directly
  if (url.pathname === '/api/backup-zip') {
    generateCodeZipBuffer()
      .then(buffer => {
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `SasukeX-Bot-Backup-${timestamp}.zip`;
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buffer);
      })
      .catch(err => {
        console.error('Error generating backup zip:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to generate backup archive' }));
      });
    return;
  }

  // API: Get Firebase client config
  if (url.pathname === '/api/firebase-config') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(firebaseConfig || {}));
    return;
  }

  // API: System telemetry
  if (url.pathname === '/api/telemetry') {
    const usedBytes = process.memoryUsage().rss;
    const totalBytes = os.totalmem();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      uptime: formatUptime(process.uptime()),
      ramUsedMB: Math.round(usedBytes / (1024 * 1024)),
      ramTotalMB: Math.round(totalBytes / (1024 * 1024)),
      ramPercent: Math.round((usedBytes / totalBytes) * 100),
      nodeVersion: process.version,
      platform: `${os.platform()} (${os.arch()})`,
      commandCount: Object.values(sections).reduce((acc, s) => acc + s.commands.length, 0),
      activeSessions: global.activeSockets ? global.activeSockets.size : 1
    }));
    return;
  }

  // Dashboard Page
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderDashboardHtml());
}

function renderDashboardHtml() {
  const botOwner = settings.botOwner || 'ꜰʀsᴀsᴋᴇ';
  const botName = settings.botName || 'ꜱᴀꜱᴜᴋᴇ-𝐗';
  const botVersion = settings.version || '0.1';
  const ownerNumber = settings.ownerNumber || '917052500819';
  const channelLink = settings.channelLink || 'https://whatsapp.com/channel/0029VbDsHPCId7nRSI0Fce2W';

  const usedBytes = process.memoryUsage().rss;
  const totalBytes = os.totalmem();
  const ramUsedMB = Math.round(usedBytes / (1024 * 1024));
  const ramTotalMB = Math.round(totalBytes / (1024 * 1024));
  const ramPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));
  const totalCmdCount = Object.values(sections).reduce((acc, s) => acc + s.commands.length, 0);
  const cfgJson = JSON.stringify(firebaseConfig || {});
  const sectionsJson = JSON.stringify(sections);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴜʟᴛɪ-ᴅᴇᴠɪᴄᴇ — Elite Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: #0d121d;
      --card-border: #1e2638;
      --card-hover: #141c2c;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --cyan: #38bdf8;
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.2);
      --amber: #f59e0b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
      --wa-chat-bg: #0b141a;
      --wa-user-bubble: #005c4b;
      --wa-bot-bubble: #1f2c34;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 10%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(56, 189, 248, 0.06) 0%, transparent 40%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Navigation */
    header {
      background: rgba(13, 18, 29, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--card-border);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .nav-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
    }
    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 4px 16px var(--accent-glow);
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .brand-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .nav-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.12);
      color: var(--emerald);
      font-size: 12px;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.3);
      box-shadow: 0 0 12px var(--emerald-glow);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--emerald);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--emerald);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }

    /* Main Container */
    main {
      flex: 1;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 24px 60px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    /* Grid Layout */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
    }
    @media (min-width: 1024px) {
      .dashboard-grid {
        grid-template-columns: 1.15fr 0.85fr;
      }
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    }
    .card-title-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Telemetry Metrics */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 22px;
    }
    .metric-box {
      background: #090d15;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 16px 14px;
      transition: border-color 0.2s;
    }
    .metric-box:hover {
      border-color: rgba(99, 102, 241, 0.3);
    }
    .metric-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-sub);
      margin-bottom: 6px;
    }
    .metric-value {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
    }
    .metric-desc {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* Progress bar */
    .progress-track {
      background: #182234;
      height: 6px;
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      background: linear-gradient(90deg, #4f46e5, #38bdf8);
      height: 100%;
      border-radius: 9999px;
      transition: width 0.4s ease;
    }

    /* Feature tags list */
    .features-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .feature-item {
      background: #090d15;
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .feature-icon {
      font-size: 18px;
    }
    .feature-title {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .feature-status {
      font-size: 11px;
      color: var(--emerald);
      margin-left: auto;
      font-weight: 600;
    }

    /* Google Drive Cloud Hub Card */
    .drive-hub-card {
      background: linear-gradient(180deg, #0e1628 0%, #0a0f1c 100%);
      border: 1px solid rgba(59, 130, 246, 0.35);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .drive-banner {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
    }
    .drive-svg-icon {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      filter: drop-shadow(0 4px 12px rgba(66, 133, 244, 0.3));
    }
    .drive-header-title {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
    }
    .drive-header-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .auth-section {
      background: #090d15;
      border: 1px dashed rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 20px;
      text-align: center;
    }
    .btn-google {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #fff;
      color: #1e293b;
      font-weight: 600;
      font-size: 14px;
      padding: 10px 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(255, 255, 255, 0.15);
    }
    .btn-google:hover {
      background: #f1f5f9;
      transform: translateY(-1px);
    }

    .user-profile-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #090d15;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid var(--accent);
    }
    .user-info-text {
      flex: 1;
      min-width: 0;
    }
    .user-display-name {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-email-addr {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-signout {
      background: transparent;
      border: 1px solid #334155;
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-signout:hover {
      background: #1e293b;
      color: #fff;
    }

    .drive-action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn-upload-drive {
      flex: 1;
      min-width: 200px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      border: none;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
      transition: all 0.2s;
    }
    .btn-upload-drive:hover {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      transform: translateY(-1px);
    }
    .btn-download-zip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #182234;
      color: #e2e8f0;
      padding: 12px 18px;
      border-radius: 10px;
      border: 1px solid #334155;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-download-zip:hover {
      background: #1e293b;
      color: #fff;
    }

    .status-alert {
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 13px;
      margin-top: 14px;
      display: none;
      line-height: 1.5;
    }
    .status-alert.info {
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
    }
    .status-alert.success {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }
    .status-alert.error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    /* WhatsApp Simulator */
    .simulator-card {
      background: #0f1622;
      border: 1px solid #1e293b;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
    }
    .wa-top-bar {
      background: #1f2c34;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .wa-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .wa-user-details {
      flex: 1;
    }
    .wa-name {
      font-size: 15px;
      font-weight: 700;
      color: #e9edef;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .wa-online-status {
      font-size: 11px;
      color: #00a884;
      font-weight: 500;
    }

    .simulator-tabs {
      display: flex;
      gap: 6px;
      padding: 10px 14px;
      background: #111a24;
      overflow-x: auto;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .tab-pill {
      background: #1c2733;
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-pill:hover {
      background: #253342;
      color: #fff;
    }
    .tab-pill.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
      box-shadow: 0 2px 10px var(--accent-glow);
    }

    .chat-viewport {
      background-color: var(--wa-chat-bg);
      background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 24px 24px;
      padding: 20px 18px;
      min-height: 440px;
      max-height: 600px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .bubble-user {
      align-self: flex-end;
      background: var(--wa-user-bubble);
      color: #e9edef;
      padding: 8px 14px;
      border-radius: 12px 12px 2px 12px;
      font-size: 13.5px;
      max-width: 80%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      font-family: 'JetBrains Mono', monospace;
    }
    .bubble-bot {
      align-self: flex-start;
      background: var(--wa-bot-bubble);
      color: #e9edef;
      padding: 14px 16px;
      border-radius: 12px 12px 12px 2px;
      font-size: 13px;
      max-width: 95%;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      font-family: 'JetBrains Mono', monospace;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }
    .chat-meta {
      align-self: flex-end;
      font-size: 11px;
      color: #8696a0;
      margin-top: 4px;
    }

    /* Command Explorer */
    .search-input {
      width: 100%;
      background: #090d15;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 16px;
      color: #fff;
      font-size: 13px;
      margin-bottom: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .category-filter-bar {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      margin-bottom: 14px;
      padding-bottom: 4px;
    }
    .category-pill {
      background: #111726;
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .category-pill.active {
      background: #1e293b;
      color: var(--cyan);
      border-color: var(--cyan);
    }

    .cmd-chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .cmd-chip {
      background: #090d15;
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #cbd5e1;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
    }
    .cmd-chip:hover {
      background: #141c2c;
      border-color: var(--accent);
      color: #fff;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 18px;
      padding: 28px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .modal h3 {
      font-size: 18px;
      color: #fff;
      margin-bottom: 12px;
    }
    .modal p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn-modal-cancel {
      background: transparent;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 10px 18px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-modal-confirm {
      background: var(--accent);
      border: none;
      color: #fff;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 4px 14px var(--accent-glow);
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--card-border);
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: var(--text-sub);
    }
    footer a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>

  <!-- Top Header Navigation -->
  <header>
    <div class="nav-inner">
      <a href="/" class="brand">
        <div class="brand-icon">⚡</div>
        <div>
          <div class="brand-title">ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴜʟᴛɪ-ᴅᴇᴠɪᴄᴇ</div>
          <div class="brand-subtitle">Automated WhatsApp High-Performance Node.js Engine</div>
        </div>
      </a>
      <div class="nav-right">
        <div class="status-badge">
          <div class="status-dot"></div>
          <span>OPERATIONAL 🟢</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main>
    <div class="dashboard-grid">

      <!-- Left Column: Live Telemetry & Cloud Backup Hub -->
      <div style="display: flex; flex-direction: column; gap: 28px;">

        <!-- Telemetry Card -->
        <div class="card">
          <div class="card-title-group">
            <div class="card-title">
              <span>📊</span>
              <span>System Telemetry & Engine Core</span>
            </div>
            <span style="font-size:12px;color:var(--text-sub);font-family:'JetBrains Mono'">v${botVersion}</span>
          </div>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-label">Uptime</div>
              <div class="metric-value" id="uptimeVal">Active</div>
              <div class="metric-desc">Continuous execution</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Memory RSS</div>
              <div class="metric-value" id="ramVal">${ramUsedMB} MB</div>
              <div class="progress-track">
                <div class="progress-fill" id="ramFill" style="width: ${ramPercent}%"></div>
              </div>
              <div class="metric-desc">${ramPercent}% of ${ramTotalMB} MB total</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Features</div>
              <div class="metric-value">${totalCmdCount}</div>
              <div class="metric-desc">Commands active</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Engine</div>
              <div class="metric-value">Baileys</div>
              <div class="metric-desc">Multi-Device WebSockets</div>
            </div>
          </div>

          <div class="features-list">
            <div class="feature-item">
              <div class="feature-icon">👑</div>
              <div>
                <div class="feature-title">Bot Master</div>
                <div style="font-size:11px;color:var(--text-muted)">${botOwner}</div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🛡️</div>
              <div>
                <div class="feature-title">View-Once Guard</div>
                <div style="font-size:11px;color:var(--text-muted)">.vv / .wow enabled</div>
              </div>
              <div class="feature-status">READY</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⚡</div>
              <div>
                <div class="feature-title">Auto Presence</div>
                <div style="font-size:11px;color:var(--text-muted)">Typing & Read sync</div>
              </div>
              <div class="feature-status">ACTIVE</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">☁️</div>
              <div>
                <div class="feature-title">Cloud Backup Hub</div>
                <div style="font-size:11px;color:var(--text-muted)">Google Drive sync</div>
              </div>
              <div class="feature-status">STANDBY</div>
            </div>
          </div>
        </div>

        <!-- Google Drive Cloud Hub Card -->
        <div class="drive-hub-card">
          <div class="drive-banner">
            <svg class="drive-svg-icon" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
            <div>
              <div class="drive-header-title">Google Drive Code Backup Hub</div>
              <div class="drive-header-desc">Connect with your Google account to back up your full SasukeX WhatsApp Bot repository directly to your personal Google Drive account in 1-click.</div>
            </div>
          </div>

          <!-- Auth Box -->
          <div id="authSection" class="auth-section">
            <button id="googleSignInBtn" class="btn-google">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              <span>Sign in with Google</span>
            </button>
            <div style="font-size:12px;color:var(--text-sub);margin-top:10px">Grants read/write scope to save your bot backup archives.</div>
          </div>

          <!-- Actions Box (Visible when authenticated) -->
          <div id="driveActionsSection" style="display:none">
            <div class="user-profile-bar">
              <img id="userAvatar" class="user-avatar" src="" alt="Google User">
              <div class="user-info-text">
                <div id="userName" class="user-display-name"></div>
                <div id="userEmail" class="user-email-addr"></div>
              </div>
              <button id="signOutBtn" class="btn-signout">Sign Out</button>
            </div>

            <div class="drive-action-buttons">
              <button id="uploadToDriveBtn" class="btn-upload-drive">
                <span>☁️</span>
                <span>Upload Codebase to Google Drive</span>
              </button>
              <a href="/api/backup-zip" class="btn-download-zip" download>
                <span>📦</span>
                <span>Direct ZIP Download</span>
              </a>
            </div>
          </div>

          <div id="statusAlert" class="status-alert"></div>
        </div>

      </div>

      <!-- Right Column: Interactive WhatsApp Simulator & Command Explorer -->
      <div style="display: flex; flex-direction: column; gap: 28px;">

        <!-- Simulator -->
        <div class="simulator-card">
          <!-- WhatsApp Top Bar -->
          <div class="wa-top-bar">
            <div class="wa-avatar">⚡</div>
            <div class="wa-user-details">
              <div class="wa-name">
                <span>${botName}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <div class="wa-online-status">● online</div>
            </div>
            <div style="font-size:11px;color:var(--text-sub);font-family:'JetBrains Mono'">Multi-Device</div>
          </div>

          <!-- Command view tabs -->
          <div class="simulator-tabs">
            <button class="tab-pill active" onclick="switchSimulatorTab('menu')">⚡ .menu</button>
            <button class="tab-pill" onclick="switchSimulatorTab('alive')">🟢 .alive</button>
            <button class="tab-pill" onclick="switchSimulatorTab('speed')">🚀 .ping</button>
            <button class="tab-pill" onclick="switchSimulatorTab('settings')">⚙️ .settings</button>
            <button class="tab-pill" onclick="switchSimulatorTab('owner')">👑 .owner</button>
            <button class="tab-pill" onclick="switchSimulatorTab('backup')">☁️ .backup</button>
            <button class="tab-pill" onclick="switchSimulatorTab('vv')">🔓 .vv</button>
          </div>

          <!-- Chat viewport -->
          <div class="chat-viewport">
            <div class="bubble-user" id="simUserBubble">.menu</div>
            <div class="bubble-bot" id="simBotBubble">Loading preview...</div>
            <div class="chat-meta">13:00 • Read ✓✓</div>
          </div>
        </div>

        <!-- Quick Command Search & Explorer -->
        <div class="card">
          <div class="card-title-group">
            <div class="card-title">
              <span>🔍</span>
              <span>Command Directory & Quick Copier</span>
            </div>
            <span id="cmdCountBadge" style="font-size:12px;color:var(--cyan);font-family:'JetBrains Mono'">${totalCmdCount} features</span>
          </div>

          <input type="text" id="cmdSearchInput" class="search-input" placeholder="Search 80+ commands (e.g. admin, sticker, ban, ping, alive)...">

          <div class="category-filter-bar" id="categoryFilterBar">
            <div class="category-pill active" onclick="filterByCategory('all')">All</div>
            <div class="category-pill" onclick="filterByCategory('General')">General</div>
            <div class="category-pill" onclick="filterByCategory('Admin')">Admin</div>
            <div class="category-pill" onclick="filterByCategory('Owner')">Owner</div>
            <div class="category-pill" onclick="filterByCategory('Media')">Media</div>
            <div class="category-pill" onclick="filterByCategory('Downloader')">Downloader</div>
            <div class="category-pill" onclick="filterByCategory('Games')">Games</div>
            <div class="category-pill" onclick="filterByCategory('Anime')">Anime</div>
            <div class="category-pill" onclick="filterByCategory('Misc')">Misc</div>
          </div>

          <div id="cmdChipsContainer" class="cmd-chips-container">
            <!-- Chips rendered dynamically -->
          </div>
        </div>

      </div>

    </div>
  </main>

  <!-- Confirmation Modal for Google Drive Upload -->
  <div id="confirmModal" class="modal-overlay">
    <div class="modal">
      <h3>☁️ Upload Code to Google Drive?</h3>
      <p>This will generate a clean ZIP archive of the <strong>ꜱᴀꜱᴜᴋᴇX WhatsApp Bot</strong> source code (excluding credentials and temporary caches) and upload it directly into your personal Google Drive account.</p>
      <div class="modal-actions">
        <button id="cancelModalBtn" class="btn-modal-cancel">Cancel</button>
        <button id="confirmUploadBtn" class="btn-modal-confirm">Yes, Upload to Drive</button>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer>
    <div>⚡ <strong>ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴜʟᴛɪ-ᴅᴇᴠɪᴄᴇ</strong> • Developed by <a href="${channelLink}" target="_blank" rel="noopener noreferrer">${botOwner}</a></div>
  </footer>

  <!-- Scripts -->
  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
    import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

    const firebaseConfig = ${cfgJson};
    const sections = ${sectionsJson};

    let app, auth, provider;
    let cachedAccessToken = null;

    const authSection = document.getElementById('authSection');
    const driveActionsSection = document.getElementById('driveActionsSection');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const statusAlert = document.getElementById('statusAlert');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const uploadToDriveBtn = document.getElementById('uploadToDriveBtn');
    const confirmModal = document.getElementById('confirmModal');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');

    function showAlert(text, type = 'info', isHtml = false) {
      statusAlert.className = 'status-alert ' + type;
      if (isHtml) {
        statusAlert.innerHTML = text;
      } else {
        statusAlert.textContent = text;
      }
      statusAlert.style.display = 'block';
    }

    if (firebaseConfig && firebaseConfig.apiKey) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');

      onAuthStateChanged(auth, (user) => {
        if (user && cachedAccessToken) {
          authSection.style.display = 'none';
          driveActionsSection.style.display = 'block';
          userAvatar.src = user.photoURL || 'https://lh3.googleusercontent.com/a/default-user';
          userName.textContent = user.displayName || 'Authorized User';
          userEmail.textContent = user.email || '';
        } else {
          authSection.style.display = 'block';
          driveActionsSection.style.display = 'none';
          cachedAccessToken = null;
        }
      });

      googleSignInBtn.addEventListener('click', async () => {
        googleSignInBtn.disabled = true;
        showAlert('Signing in with Google...', 'info');
        try {
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (!credential?.accessToken) {
            throw new Error('Could not acquire Google Drive OAuth access token');
          }
          cachedAccessToken = credential.accessToken;
          authSection.style.display = 'none';
          driveActionsSection.style.display = 'block';
          userAvatar.src = result.user.photoURL || 'https://lh3.googleusercontent.com/a/default-user';
          userName.textContent = result.user.displayName || 'Authorized User';
          userEmail.textContent = result.user.email || '';
          showAlert('Connected to Google Drive! Click below to upload your codebase.', 'success');
        } catch (err) {
          console.error(err);
          showAlert('Sign-in failed: ' + (err.message || err), 'error');
        } finally {
          googleSignInBtn.disabled = false;
        }
      });

      signOutBtn.addEventListener('click', async () => {
        await signOut(auth);
        cachedAccessToken = null;
        authSection.style.display = 'block';
        driveActionsSection.style.display = 'none';
        showAlert('Signed out from Google Drive.', 'info');
      });
    }

    // Modal Confirmation Flow
    uploadToDriveBtn.addEventListener('click', () => {
      confirmModal.classList.add('active');
    });

    cancelModalBtn.addEventListener('click', () => {
      confirmModal.classList.remove('active');
    });

    confirmUploadBtn.addEventListener('click', async () => {
      confirmModal.classList.remove('active');
      if (!cachedAccessToken) {
        showAlert('Please sign in with Google first.', 'error');
        return;
      }

      uploadToDriveBtn.disabled = true;
      showAlert('⏳ 1/2 Generating code backup archive...', 'info');

      try {
        const res = await fetch('/api/backup-zip');
        if (!res.ok) throw new Error('Failed to generate backup zip file');
        const zipBlob = await res.blob();

        showAlert('☁️ 2/2 Uploading archive to your Google Drive...', 'info');

        const timestamp = new Date().toISOString().slice(0, 10);
        const fileName = 'SasukeX-WhatsApp-Bot-Backup-' + timestamp + '.zip';

        const metadata = {
          name: fileName,
          mimeType: 'application/zip',
          description: 'Backup of SasukeX Multi-Device WhatsApp Bot codebase created via AI Studio'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', zipBlob);

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + cachedAccessToken
          },
          body: form
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Google Drive upload failed (' + uploadRes.status + ')');
        }

        const driveData = await uploadRes.json();
        const driveLink = driveData.webViewLink || ('https://drive.google.com/file/d/' + driveData.id + '/view');

        showAlert(
          '🎉 <strong>Code successfully uploaded to Google Drive!</strong><br>' +
          'File: <em>' + driveData.name + '</em><br><br>' +
          '<a href="' + driveLink + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#10b981;color:#fff;padding:8px 16px;border-radius:6px;font-weight:600;text-decoration:none">📂 Open in Google Drive</a>',
          'success',
          true
        );
      } catch (err) {
        console.error('Upload error:', err);
        showAlert('Upload failed: ' + (err.message || err), 'error');
      } finally {
        uploadToDriveBtn.disabled = false;
      }
    });

    // Command Browser
    const cmdChipsContainer = document.getElementById('cmdChipsContainer');
    const cmdSearchInput = document.getElementById('cmdSearchInput');
    const cmdCountBadge = document.getElementById('cmdCountBadge');

    const allCmds = [];
    Object.entries(sections).forEach(([secName, sec]) => {
      sec.commands.forEach(cmd => {
        allCmds.push({ name: cmd, section: secName });
      });
    });

    let currentCategoryFilter = 'all';

    window.filterByCategory = function(cat) {
      currentCategoryFilter = cat;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      const activePill = Array.from(document.querySelectorAll('.category-pill')).find(p => p.textContent.toLowerCase() === cat.toLowerCase());
      if (activePill) activePill.classList.add('active');
      renderChips(cmdSearchInput.value);
    };

    function renderChips(filter = '') {
      cmdChipsContainer.innerHTML = '';
      const f = filter.toLowerCase().trim();
      const filtered = allCmds.filter(c => {
        const matchesCategory = currentCategoryFilter === 'all' || c.section.toLowerCase() === currentCategoryFilter.toLowerCase();
        const matchesText = !f || c.name.toLowerCase().includes(f) || c.section.toLowerCase().includes(f);
        return matchesCategory && matchesText;
      });

      cmdCountBadge.textContent = filtered.length + ' commands';

      filtered.forEach(c => {
        const chip = document.createElement('div');
        chip.className = 'cmd-chip';
        chip.textContent = c.name;
        chip.title = 'Category: ' + c.section + ' • Click to copy';
        chip.onclick = () => {
          const commandOnly = c.name.split(' ')[0];
          navigator.clipboard.writeText(commandOnly);
          chip.style.borderColor = '#10b981';
          chip.style.color = '#10b981';
          setTimeout(() => {
            chip.style.borderColor = '';
            chip.style.color = '';
          }, 800);
        };
        cmdChipsContainer.appendChild(chip);
      });
    }

    cmdSearchInput.addEventListener('input', (e) => {
      renderChips(e.target.value);
    });

    renderChips();

    // Simulator Tab Logic
    const simTemplates = {
      menu: {
        user: '.menu',
        bot: \`╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴜʟᴛɪ-ᴅᴇᴠɪᴄᴇ ⚡ 〕━━━╮
┃
┃ 👋 *Good Day,* ━━〔 ${botOwner} 〕━━!
┃ Welcome to *${botName}* Interactive Menu.
┃
┣━━〔 📊 ʙᴏᴛ ᴅᴀꜱʜʙᴏᴀʀᴅ 〕━━┫
┃ 👑 *Master*     : ${botOwner}
┃ 🤖 *Bot Name*   : ${botName}
┃ ⚙️ *Prefix*     : [ . ]
┃ 🌐 *Mode*       : [ PUBLIC ]
┃ ⏱️ *Uptime*     : 2h 15m
┃ 💾 *RAM Usage*  : ${ramUsedMB} MB / ${ramTotalMB} MB
┃ 📁 *Commands*   : ${totalCmdCount} Active Features
┃ 🔖 *Version*    : v${botVersion}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭───「 ◈ *GENERAL* (15) 」───╮
│ ✦ .menu [category]
│ ✦ .showall
│ ✦ .ping
│ ✦ .alive
│ ✦ .owner
│ ✦ .settings
│ ✦ .weather <city>
╰──────────────────────────────┈⊷

╭───「 ♛ *OWNER* (19) 」───╮
│ ✦ .mode <public/private>
│ ✦ .autoreact <on/off>
│ ✦ .anticall <on/off>
│ ✦ .autotyping <on/off>
│ ✦ .cleartmp
│ ✦ .backup / .gdrive
│ ✦ .vv [reply viewonce]
╰──────────────────────────────┈⊷

╭───「 💡 *COMMAND QUICK ACCESS* 」───╮
│ 🔍 *Category Sub-Menus:*
│    • .menu admin    ➔ Group moderation
│    • .menu media    ➔ Stickers & images
│    • .menu download ➔ Audio & video download
│    • .menu games    ➔ Interactive games
│    • .menu owner    ➔ Bot owner privileges
│
│ ⚡ *Server Speed:* .ping
│ 🟢 *Online Check:* .alive
│ ⚙️ *Bot Settings:* .settings
╰──────────────────────────────┈⊷\`
      },
      alive: {
        user: '.alive',
        bot: \`╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ɪꜱ ᴀʟɪᴠᴇ ⚡ 〕━━━╮
┃
┃ 🤖 *Status*    : Operational & Online 🟢
┃ 👑 *Master*    : ${botOwner}
┃ ⏱️ *Uptime*    : 2h 15m 30s
┃ 💾 *RAM Usage* : ${ramUsedMB} MB / ${ramTotalMB} MB
┃ 🌐 *Mode*      : PUBLIC
┃ 📁 *Features*  : ${totalCmdCount} Active Commands
┃ 🔖 *Version*   : v${botVersion}
┃
┣━━〔 ⚔️ ꜱʏꜱᴛᴇᴍ ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ ✦ _"I have long since closed my eyes..._
┃   _My only goal is in the darkness."_
┃
┃ ✦ All sub-systems running at peak performance.
┃ ✦ Type *.menu* to view command directory.
┃ ✦ Type *.ping* to test live server latency.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\`
      },
      speed: {
        user: '.ping',
        bot: \`╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ 〕━━━╮
┃
┃ ⚡ *Response Time* : 14 ms
┃ 🚀 *Performance*   : [ ■■■■■■■■■■ ]
┃ 🏆 *Tier Status*   : Ultra Fast ⚡ [Tier S]
┃
┣━━〔 🖥️ ꜱᴇʀᴠᴇʀ ᴛᴇʟᴇᴍᴇᴛʀʏ 〕━━┫
┃ ⏱️ *Uptime*        : 2h 15m 30s
┃ 💾 *RAM Usage*     : ${ramUsedMB} MB / ${ramTotalMB} MB (${ramPercent}%)
┃ 🧠 *CPU Info*      : 2 Cores @ 2.8GHz
┃ ⚙️ *OS Platform*   : Linux (x64)
┃ 📦 *Runtime*       : Node.js \${window.navigator ? 'v22.23.2' : ''}
┃ 🌐 *Access Mode*   : PUBLIC
┃ 🔖 *Bot Release*   : v${botVersion}
┃
┣━━〔 📡 ɴᴇᴛᴡᴏʀᴋ ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ 📶 *Socket Status* : Stable & Connected 🟢
┃ 🛡️ *Core Engine*   : Baileys Multi-Device
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\`
      },
      settings: {
        user: '.settings',
        bot: \`╭━━━〔 ⚙️ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱᴇᴛᴛɪɴɢꜱ 〕━━━╮
┃
┃ 🌐 *Access Mode*   : [ PUBLIC 🟢 ]
┃ 👁️ *Auto Status*   : [ OFF 🔴 ]
┃ 📖 *Auto Read*     : [ OFF 🔴 ]
┃ ✍️ *Auto Typing*   : [ OFF 🔴 ]
┃ 🛡️ *PM Blocker*    : [ OFF 🔴 ]
┃ 📵 *Anti Call*     : [ OFF 🔴 ]
┃ ✨ *Auto Reaction* : [ OFF 🔴 ]
┃
┣━━〔 💡 ᴛᴏɢɢʟᴇ ᴄᴏᴍᴍᴀɴᴅꜱ 〕━━┫
┃ ✦ .mode <public/private>
┃ ✦ .autostatus <on/off>
┃ ✦ .autoread <on/off>
┃ ✦ .autotyping <on/off>
┃ ✦ .pmblocker <on/off>
┃ ✦ .anticall <on/off>
┃ ✦ .autoreact <on/off>
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\`
      },
      owner: {
        user: '.owner',
        bot: \`╭━━━〔 👑 ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴀꜱᴛᴇʀ 〕━━━╮
┃
┃ 👤 *Developer* : ${botOwner}
┃ 📞 *Contact*   : +${ownerNumber}
┃ 🤖 *Bot Core*  : ${botName}
┃ 🔖 *Release*   : v${botVersion} Premium
┃ 📢 *Channel*   : ${channelLink}
┃
┣━━〔 💬 ꜱᴜᴘᴘᴏʀᴛ & ɪɴꜰᴏ 〕━━┫
┃ ✦ Official multi-device WhatsApp automation
┃   crafted for performance, media & security.
┃ ✦ Reach out for deployment & custom commands.
┃ ✦ Direct vCard contact attached below!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\`
      },
      backup: {
        user: '.backup',
        bot: \`╭━━━〔 ☁️ ɢᴏᴏɢʟᴇ ᴅʀɪᴠᴇ & ʙᴀᴄᴋᴜᴘ 〕━━━╮
┃
┃ 📦 *SasukeX Codebase Backup*
┃
┃ You can upload your complete bot code
┃ directly to *Google Drive* or download
┃ the ZIP archive via your dashboard:
┃
┃ 🌐 *Web Dashboard & Drive Uploader:*
┃ https://ais-dev-jwcxdlabyfzetgy2n36zgf-245889155456.asia-east1.run.app
┃
┃ 💡 *Instructions:*
┃ 1. Open the dashboard link above.
┃ 2. Click *Sign in with Google*.
┃ 3. Click *Upload Codebase to Google Drive*.
┃
┃ 📂 The code archive will be safely saved
┃ to your Google Drive account!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\`
      },
      vv: {
        user: '.vv (reply to view-once)',
        bot: \`╭━━━〔 🔓 ᴠɪᴇᴡ-ᴏɴᴄᴇ ʀᴇᴠᴇᴀʟᴇᴅ 〕━━━╮
┃
┃ 📸 *Media Type* : Image / Video
┃ 👤 *Sender*     : +919876543210
┃ 🔒 *Protected*  : Yes (View Once)
┃ 🚀 *Delivery*   : Sent to Owner DM!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

[Media forwarded to your DM privately]\`
      }
    };

    window.switchSimulatorTab = function(tabKey) {
      document.querySelectorAll('.tab-pill').forEach(btn => btn.classList.remove('active'));
      const activeBtn = Array.from(document.querySelectorAll('.tab-pill')).find(b => 
        (tabKey === 'menu' && b.textContent.includes('.menu')) ||
        (tabKey === 'alive' && b.textContent.includes('.alive')) ||
        (tabKey === 'speed' && b.textContent.includes('.ping')) ||
        (tabKey === 'settings' && b.textContent.includes('.settings')) ||
        (tabKey === 'owner' && b.textContent.includes('.owner')) ||
        (tabKey === 'backup' && b.textContent.includes('.backup')) ||
        (tabKey === 'vv' && b.textContent.includes('.vv'))
      );
      if (activeBtn) activeBtn.classList.add('active');

      const template = simTemplates[tabKey];
      if (template) {
        document.getElementById('simUserBubble').textContent = template.user;
        document.getElementById('simBotBubble').textContent = template.bot;
      }
    };

    // Live Telemetry polling
    async function updateTelemetry() {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          document.getElementById('uptimeVal').textContent = data.uptime || 'Active';
          document.getElementById('ramVal').textContent = data.ramUsedMB + ' MB';
          document.getElementById('ramFill').style.width = data.ramPercent + '%';
        }
      } catch (_) {}
    }
    setInterval(updateTelemetry, 5000);
    updateTelemetry();

    switchSimulatorTab('menu');
  </script>
</body>
</html>`;
}

module.exports = { handleHttpRequest };
