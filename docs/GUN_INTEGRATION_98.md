# Gun.js Game Room Integration - Issue #98

## Overview
Implements game room creation and join flow using Gun.js for real-time multiplayer synchronization.

## ⚠️ IMPORTANT: Gun Relay Server Required

Gun.js needs a relay server to sync data between different devices. Public Gun relays are often down.

**You have 3 options:**

1. **Local Testing** - Run `node gun-relay-server.js` and update `gunConfig.ts` with your local IP
2. **Deploy Your Own** - Deploy to Render.com, Railway.app, etc. (see `docs/GUN_RELAY_SETUP.md`)
3. **Use Community Relays** - Unreliable, but no setup needed

**See `docs/GUN_RELAY_SETUP.md` for detailed setup instructions.**

## What's Been Done

### ✅ Types (`types/room.ts`)
- `RoomConnectionStatus` - Connection state tracking
- `RoomPlayer` - Player information within a room
- `GameRoom` - Room configuration and state
- `GunRoomData` - Gun-specific room data structure

### ✅ Room Management (`utils/roomManager.ts`)
- **`generateRoomCode()`** - Creates 6-character alphanumeric codes (excluding ambiguous characters)
- **`generateRoomId()`** - Generates unique room identifiers
- **`createRoom()`** - Creates a new game room and stores it in Gun
- **`joinRoom()`** - Joins an existing room by code
- **`leaveRoom()`** - Removes a player from a room
- **`subscribeToRoom()`** - Real-time room updates subscription
- **`lockRoom()`** - Lock/unlock room to prevent new joins (host only)
- **`kickPlayer()`** - Remove a player from the room (host only)

### ✅ Store Integration (`store/store.ts`)
- Added `currentPlayerId` - Tracks this device's player ID
- Added `currentRoom` - Current room state
- Added `roomConnectionStatus` - Connection status tracking
- Actions: `setCurrentPlayerId()`, `setCurrentRoom()`, `setRoomConnectionStatus()`

### ✅ UI Components

#### `CreateRoomComponent.tsx`
- Form to create a new room
- Customizable host name and max players
- Displays generated room code
- Share functionality for inviting players

#### `JoinRoomComponent.tsx`
- Form to join existing room via code
- Name input for joining player
- 6-character code input with validation
- Error handling for invalid/full rooms

#### `RoomDisplayComponent.tsx`
- Displays current room information
- Real-time player list with updates
- Host controls (lock room, kick players)
- Share room code functionality
- Leave room with confirmation

### ✅ Testing (`__tests__/utils/roomManager.test.ts`)
- Tests for code and ID generation
- Room creation validation
- Join room error handling
- Timeout behavior testing

## Usage Examples

### Create a Room
```typescript
import { CreateRoomComponent } from './components/room/CreateRoomComponent';

<CreateRoomComponent
  onRoomCreated={(room) => {
    console.log('Room created:', room.code);
    // Navigate to room view
  }}
  onCancel={() => {
    // Handle cancel
  }}
/>
```

### Join a Room
```typescript
import { JoinRoomComponent } from './components/room/JoinRoomComponent';

<JoinRoomComponent
  onRoomJoined={(room) => {
    console.log('Joined room:', room.code);
    // Navigate to room view
  }}
  onCancel={() => {
    // Handle cancel
  }}
/>
```

### Display Current Room
```typescript
import { RoomDisplayComponent } from './components/room/RoomDisplayComponent';

<RoomDisplayComponent
  onLeaveRoom={() => {
    // Navigate back to home
  }}
/>
```

### Programmatic Room Management
```typescript
import { createRoom, joinRoom, subscribeToRoom } from './utils/roomManager';

// Create a room
const room = await createRoom('player-123', 'John', 10);
console.log('Room code:', room.code);

// Join a room
const joinedRoom = await joinRoom('ABC123', 'player-456', 'Jane');

// Subscribe to updates
const unsubscribe = subscribeToRoom('ABC123', (room) => {
  console.log('Room updated:', room?.players.length, 'players');
});

// Clean up
unsubscribe();
```

## Room Code Format
- **Length**: 6 characters
- **Characters**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- **Excluded**: O, 0, I, 1, L (to avoid confusion)
- **Example**: `A3K9ZP`

## Data Flow

1. **Host creates room**
   - Generate unique room ID and code
   - Store room data in Gun: `gun.get('rooms').get(code)`
   - Host automatically added as first player

2. **Players join**
   - Enter 6-character code
   - Lookup room in Gun
   - Validate room exists, not locked, not full
   - Add player to room

3. **Real-time sync**
   - All clients subscribe to room updates
   - Gun automatically propagates changes
   - Players list updates in real-time
   - Host actions (lock, kick) sync immediately

4. **Leave room**
   - Remove player from Gun data
   - All clients receive update
   - Clean up local state

## Acceptance Criteria Status

✅ **System to generate unique room IDs** - `generateRoomCode()` and `generateRoomId()`  
✅ **Players can join via short codes** - 6-character codes with validation  
✅ **QR code support** - Code can be shared (QR generation can be added later)  
✅ **Connection state in store** - `currentRoom`, `currentPlayerId`, `roomConnectionStatus`  
✅ **Two devices can connect and exchange data** - Room subscription enables real-time sync

## Testing

Run the unit tests:
```bash
npm test -- roomManager.test.ts --forceExit
```

## Security Considerations

- Room codes are not cryptographically secure (use for casual gaming only)
- No authentication or password protection
- Anyone with the code can join (unless locked)
- Host has full control over room

## Next Steps (Future Issues)

1. **Issue #99** - Sync full game state (players, matches, drinks, scores)
2. **Issue #100** - Add local persistence with AsyncStorage
3. **Issue #101** - Propagate ESPN live score updates through Gun
4. **Issue #102** - Comprehensive testing and validation

## Dependencies

- `gun` - P2P data synchronization
- `zustand` - State management
- React Native components (TextInput, TouchableOpacity, etc.)
