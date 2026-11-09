# ꜱᴀꜱᴜᴋᴇX WhatsApp Bot

Baileys-based WhatsApp bot with group administration, media commands, moderation features, owner controls, and up to five independent WhatsApp sessions.

## VPS quick setup

On a fresh Ubuntu VPS, install Node.js 18 or newer, Git, and FFmpeg:

```bash
sudo apt update
sudo apt install -y git ffmpeg
```

Clone and enter the repository:

```bash
git clone https://github.com/frsaske/sasuke-v2.git
cd sasuke-v2
```

Run the included setup script:

```bash
bash setup-vps.sh
```

Start the bot:

```bash
./start-vps.sh
```

The bot uses `npm start`, which runs `node index.js`.

## Session location

The primary session is stored at:

```text
sessions/session1/creds.json
```

The bot supports five sessions:

```text
sessions/session1/
sessions/session2/
sessions/session3/
sessions/session4/
sessions/session5/
```

`setup-vps.sh` migrates an older `session/creds.json` installation into `sessions/session1/creds.json`. A fresh installation without credentials stays idle until you manually upload a valid `creds.json`.

**Never publish real `creds.json` files in a public repository.** They contain active WhatsApp login credentials. If credentials are exposed, log out the linked device from WhatsApp immediately and generate a new session.

## Manual session upload

There is no `.connect` command. Upload each WhatsApp credential file manually to the VPS, then restart the bot:

```text
sessions/session1/creds.json
sessions/session2/creds.json
sessions/session3/creds.json
sessions/session4/creds.json
sessions/session5/creds.json
```

Example:

```bash
mkdir -p sessions/session2
# Upload creds.json into sessions/session2/ using your hosting file manager/SFTP
chmod 700 sessions/session2
chmod 600 sessions/session2/creds.json
npm start
```

Only folders containing a valid `creds.json` are started. The bot never creates a live session from a chat message.

## Owner commands

The configured owner number is `917052500819`. Owner commands include:

```text
.disconnect session2
.sessions
.makeowner <international number>
```

The normal bot command prefix remains `.`.

## Multi-session behavior

At startup, the bot loads every existing session directory from `session1` through `session5`. Each socket has independent reconnection handling. A 401/logout on one session does not stop the other sessions. New sessions are added by uploading their `creds.json` manually and restarting the bot.

## Running continuously with PM2

For a long-running VPS process, install PM2 once:

```bash
sudo npm install -g pm2
pm2 start npm --name sasukex -- start
pm2 save
pm2 startup
```

The final `pm2 startup` command prints a command that must be copied and run with `sudo`.

## Updating the bot

```bash
git pull --ff-only neworigin main
npm install --legacy-peer-deps
pm2 restart sasukex
```

If PM2 is not being used, stop the current process with `Ctrl+C` and run `./start-vps.sh` again.

## Features added in v2

- Five independent WhatsApp sessions.
- Owner-only disconnect, sessions, and make-owner commands.
- Configurable owners in `data/owners.json`.
- Centralized footer for text, image, video, and document replies.
- Updated ꜱᴀꜱᴜᴋᴇX branding and channel configuration.
- VPS setup and startup scripts.

## License and safety

This is an unofficial WhatsApp automation project using Baileys. Use it responsibly and comply with WhatsApp rules and applicable law. Do not use it for spam or bulk messaging.
