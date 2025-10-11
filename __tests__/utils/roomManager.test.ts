/**
 * Room Manager Tests
 * 
 * Tests for room creation, joining, and management utilities
 */

import {
  generateRoomCode,
  generateRoomId,
  createRoom,
  joinRoom,
  leaveRoom,
} from '../../utils/roomManager';

describe('Room Manager', () => {
  describe('generateRoomCode', () => {
    it('should generate a 6-character code', () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
    });

    it('should only contain valid characters', () => {
      const code = generateRoomCode();
      const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
      expect(code).toMatch(validChars);
    });

    it('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRoomCode());
      }
      // Should have high likelihood of unique codes
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('generateRoomId', () => {
    it('should generate a room ID', () => {
      const id = generateRoomId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should start with "room_"', () => {
      const id = generateRoomId();
      expect(id).toMatch(/^room_/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateRoomId();
      const id2 = generateRoomId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createRoom', () => {
    it('should create a room with valid data', async () => {
      const hostId = 'test-host-123';
      const hostName = 'Test Host';
      const maxPlayers = 10;

      const room = await createRoom(hostId, hostName, maxPlayers);

      expect(room).toBeDefined();
      expect(room.hostId).toBe(hostId);
      expect(room.hostName).toBe(hostName);
      expect(room.maxPlayers).toBe(maxPlayers);
      expect(room.code).toHaveLength(6);
      expect(room.players).toHaveLength(1);
      expect(room.players[0].id).toBe(hostId);
      expect(room.players[0].isHost).toBe(true);
    });

    it('should use default max players if not provided', async () => {
      const room = await createRoom('host-456', 'Host Two');
      expect(room.maxPlayers).toBe(10);
    });
  });

  describe('joinRoom', () => {
    it('should handle non-existent room', async () => {
      const result = await joinRoom('XXXXXX', 'player-1', 'Test Player');
      expect(result).toBeNull();
    }, 5000); // Fast timeout in test mode (1s)

    it('should timeout quickly in test mode', async () => {
      const startTime = Date.now();
      const result = await joinRoom('XXXXXX', 'player-1', 'Test Player');
      const endTime = Date.now();

      expect(result).toBeNull();
      // In test mode, timeout is 1 second
      expect(endTime - startTime).toBeGreaterThanOrEqual(900); // Allow some margin
      expect(endTime - startTime).toBeLessThan(2000);
    }, 5000);
  });

  describe('leaveRoom', () => {
    it('should not throw when leaving a room', () => {
      expect(() => {
        leaveRoom('TEST12', 'player-123');
      }).not.toThrow();
    });
  });
});
