# Gun.js Relay Server Setup

This guide explains how to set up your own Gun.js relay server for the DONG app's multiplayer features.

## Why Do You Need This?

Gun.js requires relay servers to sync data between devices. Public Gun relays are often down or unreliable. Running your own ensures:
- ✅ Reliable connectivity
- ✅ Better performance  
- ✅ Data privacy
- ✅ No rate limiting

## Option 1: Local Testing (Quickest)

For testing on your local network:

```bash
# Install dependencies
npm install express cors gun

# Start the relay server
node gun-relay-server.js
```

The server will run on `http://localhost:8765/gun`

**Update `utils/gunConfig.ts`:**
```typescript
const peers = [
  'http://YOUR_LOCAL_IP:8765/gun',  // Replace with your computer's IP
];
```

**Find your local IP:**
- **Mac/Linux**: `ifconfig | grep inet`
- **Windows**: `ipconfig`

Then test the app on two devices connected to the same WiFi.

## Option 2: Deploy to Render.com (Free)

1. Create account at [render.com](https://render.com)

2. Create new **Web Service**

3. Connect your GitHub repository

4. Configure:
   - **Build Command**: `cd .. && npm install`
   - **Start Command**: `node gun-relay-server.js`
   - **Environment**: Node

5. Deploy!

6. Copy your Render URL (e.g., `https://dong-gun-relay.onrender.com`)

7. Update `utils/gunConfig.ts`:
```typescript
const peers = [
  'https://dong-gun-relay.onrender.com/gun',
];
```

## Option 3: Deploy to Railway.app (Free)

1. Create account at [railway.app](https://railway.app)

2. Create new project → Deploy from GitHub

3. Railway auto-detects Node.js

4. Add environment variable:
   - `PORT` = `8765`

5. Deploy!

6. Copy your Railway URL

7. Update `utils/gunConfig.ts` with your URL

## Option 4: Deploy to DigitalOcean/AWS/etc.

Use the `gun-relay-server.js` file with any Node.js hosting service.

## Testing Your Relay Server

Once deployed, test the server:

```bash
curl https://your-server-url.com/
```

Should return:
```json
{
  "status": "online",
  "service": "Gun.js Relay Server",
  "endpoint": "/gun"
}
```

## Troubleshooting

**Server not connecting?**
- Check firewall rules
- Ensure port 8765 is open (or use environment PORT variable)
- Check server logs for errors

**Still using HTTPS?**
- Make sure to use `https://` not `http://` for production servers
- Gun will automatically upgrade to WebSocket (wss://)

**Need help?**
- Gun.js docs: https://gun.eco
- Gun chat: http://chat.gun.eco
