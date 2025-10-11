/**
 * Gun.js Configuration for React Native
 * 
 * Initializes Gun with a public relay peer for real-time P2P data synchronization.
 * Handles React Native specific requirements and polyfills.
 */

import Gun from 'gun';
import 'text-encoding-polyfill';

// Configure Gun with public relay peers
const peers = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://gun-us.herokuapp.com/gun',
];

// Detect if we're in a test environment
const isTestEnv = typeof jest !== 'undefined' || process.env.NODE_ENV === 'test';

// Initialize Gun instance
const gun = Gun({
  peers,
  radisk: !isTestEnv, // Disable radisk in test environment
  localStorage: false, // Disable browser localStorage (not available in RN)
  retry: 5000, // Retry connection every 5 seconds
});

/**
 * Test Gun connectivity and basic read/write operations
 */
export const testGunConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const testKey = `test_${Date.now()}`;
    const testData = {
      message: 'Gun.js is working!',
      timestamp: Date.now(),
    };

    // Write test data
    gun.get(testKey).put(testData, (ack: any) => {
      if (ack.err) {
        console.error('Gun write error:', ack.err);
        resolve(false);
        return;
      }

      // Read test data back
      gun.get(testKey).once((data: any) => {
        if (data && data.message === testData.message) {
          console.log('✅ Gun.js connection successful!');
          resolve(true);
        } else {
          console.error('Gun read failed or data mismatch');
          resolve(false);
        }
      });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.warn('Gun connection test timed out');
      resolve(false);
    }, 10000);
  });
};

/**
 * Get the Gun instance
 */
export const getGun = () => gun;

export default gun;
