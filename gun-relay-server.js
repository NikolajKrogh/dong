node gun-relay-server.js/**
 * Simple Gun.js Relay Server
 * 
 * This is a basic Gun relay server that can be deployed to:
 * - Heroku
 * - Railway.app
 * - Render.com
 * - DigitalOcean
 * - Any Node.js hosting service
 * 
 * To run locally for testing:
 *   node gun-relay-server.js
 * 
 * Then update gunConfig.ts to use: http://localhost:8765/gun
 */

const Gun = require('gun');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8765;

// Enable CORS for all origins (adjust for production)
app.use(cors());

// Serve static files (optional)
app.use(express.static('public'));

// Create Gun server
const server = app.listen(port, () => {
  console.log(`🔫 Gun relay server running on port ${port}`);
  console.log(`📡 Relay endpoint: http://localhost:${port}/gun`);
});

// Attach Gun to the server
const gun = Gun({ web: server, file: 'gun-data' });

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Gun.js Relay Server',
    endpoint: '/gun',
    timestamp: Date.now()
  });
});

// Gun endpoint
app.use('/gun', Gun.serve);

console.log('✅ Gun relay server ready!');
console.log('💡 Update your app to use: http://YOUR_SERVER_URL/gun');
