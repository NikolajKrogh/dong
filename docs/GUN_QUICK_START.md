# 🔫 Gun.js P2P Setup - Quick Start

## The Problem
Public Gun.js relay servers (Heroku-based) are no longer working. You need your own relay server for multiplayer to work across different devices.

## Quick Solution (5 minutes)

### Step 1: Start Local Relay Server

```bash
# In your project directory
./start-gun-relay.sh
```

This will:
- Install required packages (express, cors, gun)
- Start the Gun relay server on port 8765
- Show you your local network IP

### Step 2: Update Gun Config

Open `utils/gunConfig.ts` and update the peers array:

```typescript
const peers = isTestEnv ? [] : [
  'http://YOUR_LOCAL_IP:8765/gun',  // Replace with IP from Step 1
];
```

Example:
```typescript
const peers = isTestEnv ? [] : [
  'http://192.168.1.100:8765/gun',  // Your computer's local IP
];
```

### Step 3: Test on Two Devices

1. Make sure both devices are on the **same WiFi network**
2. **Device 1**: Create a room in the app
3. **Device 2**: Join using the room code
4. Both devices should sync in real-time! 🎉

## For Production / Internet Testing

The local server only works on the same WiFi. For internet-wide testing:

1. **Deploy to Render.com** (Free, 5 minutes):
   - Sign up at [render.com](https://render.com)
   - Deploy `gun-relay-server.js`
   - Use the Render URL in `gunConfig.ts`

2. **See full guide**: `docs/GUN_RELAY_SETUP.md`

## Troubleshooting

**"Room not found" error?**
- ✅ Make sure relay server is running
- ✅ Check both devices use the same Gun relay URL
- ✅ Verify both devices are on same WiFi (for local testing)
- ✅ Check firewall isn't blocking port 8765

**Relay server won't start?**
- Run `npm install express cors gun`
- Make sure port 8765 isn't already in use

**Need help?**
- Check server console for errors
- Make sure `gunConfig.ts` has correct IP/URL
- Try `curl http://localhost:8765/` to test server

## Files Created

- `gun-relay-server.js` - The relay server code
- `gun-relay-server-package.json` - Dependencies for relay server
- `start-gun-relay.sh` - Easy startup script
- `docs/GUN_RELAY_SETUP.md` - Detailed deployment guide

---

**TL;DR**: Run `./start-gun-relay.sh`, update `gunConfig.ts` with your local IP, test on same WiFi! 🚀
