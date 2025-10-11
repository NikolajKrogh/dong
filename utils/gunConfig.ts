/**
 * Gun.js Configuration for React Native
 *
 * Initializes Gun with a public relay peer for real-time P2P data synchronization.
 * Handles React Native specific requirements and polyfills.
 */

import Gun from "gun";
import "text-encoding-polyfill";

// Detect if we're in a test environment
const isTestEnv =
  typeof jest !== "undefined" || process.env.NODE_ENV === "test";

// Configure Gun relay peers
//
// IMPORTANT: Public Gun relays are often down or unreliable!
//
// Options for P2P networking:
// 1. Run local relay server (for testing):
//    - cd to project root
//    - npm install express cors gun
//    - node gun-relay-server.js
//    - Use: ['http://YOUR_LOCAL_IP:8765/gun']
//
// 2. Deploy your own relay server:
//    - Deploy gun-relay-server.js to Render.com, Railway.app, etc.
//    - Update peers array with your server URL
//
// 3. Use WebRTC for direct P2P (no relay needed):
//    - Requires additional setup with gun-webrtc adapter
//
// Gun relay server deployed on Render.com
// Service ID: srv-d3l89dk9c44c73962l4g
const peers = isTestEnv
  ? []
  : [
      "https://dong-gun-relay.onrender.com/gun", // Update with your actual Render URL if different
    ];

// Initialize Gun instance
const gun = Gun({
  peers,
  radisk: false, // Disable file storage (not needed for React Native)
  localStorage: false, // Disable browser localStorage (not available in RN)
  axe: false, // Disable validation for faster sync
});

// Add connection monitoring
if (!isTestEnv) {
  let peerCount = 0;

  gun.on("hi", (peer: any) => {
    peerCount++;
    console.log(`✅ Gun connected to peer #${peerCount}`);
  });

  gun.on("bye", (peer: any) => {
    peerCount--;
    console.log(`❌ Gun disconnected from peer. Remaining: ${peerCount}`);
  });

  console.log("🔫 Gun initialized with peer relay servers");
  console.log("📡 Connecting to peers...");
}

/**
 * Test Gun connectivity and basic read/write operations
 */
export const testGunConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const testKey = `test_${Date.now()}`;
    const testData = {
      message: "Gun.js is working!",
      timestamp: Date.now(),
    };

    // Write test data
    gun.get(testKey).put(testData, (ack: any) => {
      if (ack.err) {
        console.error("Gun write error:", ack.err);
        resolve(false);
        return;
      }

      // Read test data back
      gun.get(testKey).once((data: any) => {
        if (data && data.message === testData.message) {
          console.log("✅ Gun.js connection successful!");
          resolve(true);
        } else {
          console.error("Gun read failed or data mismatch");
          resolve(false);
        }
      });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.warn("Gun connection test timed out");
      resolve(false);
    }, 10000);
  });
};

/**
 * Get the Gun instance
 */
export const getGun = () => gun;

export default gun;
