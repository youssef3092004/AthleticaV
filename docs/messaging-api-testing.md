# Messaging API Testing Guide

This guide covers testing the WebSocket messaging system and REST API endpoints.

## Prerequisites

- Server running: `npm run dev`
- Valid JWT token (get from login endpoint)
- Two user accounts (trainer + client) with established relationship

## 1. REST API Testing (cURL / Postman)

### Setup: Get Valid Tokens

```bash
# Login as trainer (Ahmed)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trainer@gmail.com",
    "password": "ASDFasdf123"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "user": { "id": "trainer-uuid", "name": "Ahmed", ... }
# }

# Save token
TRAINER_TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Login as client (Sara)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sara@example.com",
    "password": "password123"
  }'

CLIENT_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### 1.1 Create/Get Conversation

```bash
# Trainer creates conversation with client
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -d '{
    "otherUserId": "069ba12f-b3bf-480c-bc82-cf98e356dada"
  }'

# Response:
{
  "id": "conv-uuid",
  "trainerId": "ahmed-uuid",
  "clientId": "sara-uuid",
  "createdAt": "2026-04-06T10:00:00Z",
  "messageCount": 0
}

# Save conversation ID
CONV_ID="conv-uuid"
```

### 1.2 Send Message via REST

```bash
# Trainer sends message to client
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -d '{
    "conversationId": "e7ac05f6-d2f7-4ad2-82ad-5c7f3e94c6cf",
    "body": "Great job on your workout today, Sara!"
  }'

# Response:
{
  "id": "msg-uuid-1",
  "conversationId": "conv-uuid",
  "senderId": "ahmed-uuid",
  "body": "Great job on your workout today, Sara!",
  "type": "TEXT",
  "isRead": false,
  "createdAt": "2026-04-06T10:05:00Z",
  "sender": {
    "id": "ahmed-uuid",
    "name": "Ahmed",
    "profileImage": null
  }
}

# Save message ID
MSG_ID="msg-uuid-1"
```

### 1.3 Get Messages (Paginated)

```bash
# Client retrieves message history
curl -X GET "http://localhost:3000/api/v1/messages/$CONV_ID?page=1&limit=50" \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Response:
{
  "data": [
    {
      "id": "msg-uuid-1",
      "conversationId": "conv-uuid",
      "senderId": "ahmed-uuid",
      "body": "Great job on your workout today, Sara!",
      "type": "TEXT",
      "isRead": false,
      "createdAt": "2026-04-06T10:05:00Z",
      "sender": {
        "id": "ahmed-uuid",
        "name": "Ahmed",
        "profileImage": null
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
}
```

### 1.4 Mark Message as Read

```bash
# Client marks trainer's message as read
curl -X PATCH http://localhost:3000/api/v1/messages/$MSG_ID/read \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Response:
{
  "id": "msg-uuid-1",
  "conversationId": "conv-uuid",
  "senderId": "ahmed-uuid",
  "isRead": true,
  "createdAt": "2026-04-06T10:05:00Z"
}
```

### 1.5 Mark Entire Conversation as Read

```bash
# Client marks all unread messages in conversation as read
curl -X PATCH http://localhost:3000/api/v1/messages/conversation/$CONV_ID/read-all \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Response:
{
  "updated": 5,
  "conversationId": "conv-uuid"
}
```

### 1.6 Get List of All Conversations

```bash
# Trainer retrieves all conversations
curl -X GET "http://localhost:3000/api/v1/conversations?page=1&limit=20" \
  -H "Authorization: Bearer $TRAINER_TOKEN"

# Response:
{
  "data": [
    {
      "id": "conv-uuid",
      "trainerId": "ahmed-uuid",
      "clientId": "sara-uuid",
      "createdAt": "2026-04-06T10:00:00Z",
      "trainer": { "id": "ahmed-uuid", "name": "Ahmed", "profileImage": null },
      "client": { "id": "sara-uuid", "name": "Sara", "profileImage": null },
      "lastMessage": {
        "id": "msg-uuid-1",
        "body": "Great job on your workout today, Sara!",
        "senderId": "ahmed-uuid",
        "createdAt": "2026-04-06T10:05:00Z"
      },
      "unreadCount": 0
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### 1.7 Get Conversation Details

```bash
# Client gets details of specific conversation
curl -X GET http://localhost:3000/api/v1/conversations/$CONV_ID \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Response:
{
  "id": "conv-uuid",
  "trainerId": "ahmed-uuid",
  "clientId": "sara-uuid",
  "createdAt": "2026-04-06T10:00:00Z",
  "trainer": { "id": "ahmed-uuid", "name": "Ahmed", "profileImage": null },
  "client": { "id": "sara-uuid", "name": "Sara", "profileImage": null },
  "lastMessage": { ... },
  "unreadCount": 0
}
```

### 1.8 Get Latest Message in Conversation

```bash
# Get latest message (for dashboard/feed)
curl -X GET http://localhost:3000/api/v1/conversations/$CONV_ID/latest \
  -H "Authorization: Bearer $TRAINER_TOKEN"

# Response:
{
  "id": "msg-uuid-1",
  "conversationId": "conv-uuid",
  "senderId": "ahmed-uuid",
  "body": "Great job on your workout today, Sara!",
  "type": "TEXT",
  "isRead": true,
  "createdAt": "2026-04-06T10:05:00Z",
  "sender": {
    "id": "ahmed-uuid",
    "name": "Ahmed",
    "avatar": null
  }
}
```

### 1.9 Delete Message

```bash
# Trainer deletes own message (within 5 minutes)
curl -X DELETE http://localhost:3000/api/v1/messages/$MSG_ID \
  -H "Authorization: Bearer $TRAINER_TOKEN"

# Response:
{
  "success": true,
  "messageId": "msg-uuid-1",
  "conversationId": "conv-uuid"
}

# Note: Only works within 5 minutes of creation
# After 5 minutes: Error 400 "Messages can only be deleted within 5 minutes of creation"
```

---

## 2. WebSocket Testing (JavaScript)

### 2.1 Basic WebSocket Setup

```javascript
// File: test-websocket.js
import io from "socket.io-client";

// Connect with JWT token
const socket = io("http://localhost:3000", {
  auth: {
    token: "eyJhbGciOiJIUzI1NiIs...", // Your JWT token
  },
});

socket.on("connect", () => {
  console.log("✅ Connected to WebSocket");
  console.log("Socket ID:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from WebSocket");
});

socket.on("error", (error) => {
  console.error("WebSocket Error:", error);
});
```

### 2.2 Join Conversation

```javascript
const CONVERSATION_ID = "conv-uuid";

// User joins a conversation room
socket.emit("JOIN_CONVERSATION", {
  conversationId: CONVERSATION_ID,
});

// Listen for confirmation
socket.on("JOINED_CONVERSATION", (data) => {
  console.log("✅ Successfully joined conversation:", data);
  // Output: { conversationId: "conv-uuid", success: true }
});

// Listen for other users joining
socket.on("USER_JOINED", (data) => {
  console.log("👤 Another user joined:", data);
  // Output: { conversationId: "conv-uuid", userId: "sara-uuid", timestamp: "..." }
});
```

### 2.3 Send Message via WebSocket

```javascript
// Send a message in real-time
socket.emit("SEND_MESSAGE", {
  conversationId: CONVERSATION_ID,
  body: "This is a real-time message!",
});

// Listen for sent confirmation
socket.on("MESSAGE_SENT", (data) => {
  console.log("✅ Message sent:", data);
  // Output: { messageId: "msg-uuid-2", conversationId: "conv-uuid", success: true }
});

// Listen for received messages (from other users in the room)
socket.on("MESSAGE_RECEIVED", (message) => {
  console.log("📨 New message received:", message);
  // Output: {
  //   id: "msg-uuid-2",
  //   conversationId: "conv-uuid",
  //   senderId: "ahmed-uuid",
  //   body: "This is a real-time message!",
  //   type: "TEXT",
  //   isRead: false,
  //   createdAt: "2026-04-06T10:10:00Z",
  //   sender: { id: "ahmed-uuid", name: "Ahmed", avatar: null }
  // }
});
```

### 2.4 Mark Message as Read (WebSocket)

```javascript
// Mark a specific message as read
socket.emit("MARK_AS_READ", {
  conversationId: CONVERSATION_ID,
  messageId: "msg-uuid-2",
});

// Listen for read notification
socket.on("MESSAGE_READ", (data) => {
  console.log("✅ Message marked as read:", data);
  // Output: { messageId: "msg-uuid-2", conversationId: "conv-uuid" }
});
```

### 2.5 Mark Entire Conversation as Read

```javascript
// Mark all unread messages in conversation as read
socket.emit("MARK_AS_READ", {
  conversationId: CONVERSATION_ID,
  // No messageId = mark all as read
});

// Listen for conversation read notification
socket.on("CONVERSATION_READ", (data) => {
  console.log("✅ Conversation marked as read:", data);
  // Output: { conversationId: "conv-uuid", updatedCount: 3 }
});
```

### 2.6 Typing Indicator

```javascript
// User is typing
socket.emit("TYPING", {
  conversationId: CONVERSATION_ID,
  isTyping: true,
});

// After user stops typing
socket.emit("TYPING", {
  conversationId: CONVERSATION_ID,
  isTyping: false,
});

// Listen for typing indicators from other users
socket.on("USER_TYPING", (data) => {
  console.log("✏️ Someone is typing:", data);
  // Output: { conversationId: "conv-uuid", userId: "sara-uuid", isTyping: true, timestamp: "..." }
});
```

### 2.7 Leave Conversation

```javascript
// User leaves the conversation room
socket.emit("LEAVE_CONVERSATION", {
  conversationId: CONVERSATION_ID,
});

// Listen for user left notification
socket.on("USER_LEFT", (data) => {
  console.log("👤 User left conversation:", data);
  // Output: { conversationId: "conv-uuid", userId: "ahmed-uuid", timestamp: "..." }
});
```

### 2.8 Error Handling

```javascript
// Listen for errors
socket.on("ERROR", (error) => {
  console.error("❌ WebSocket Error:", error);
  // Output: { event: "SEND_MESSAGE", message: "Message body is required..." }
});
```

---

## 3. Complete WebSocket Test Scenario

```javascript
// Complete example: Coach sends message to client in real-time

import io from "socket.io-client";

const TRAINER_TOKEN = "eyJhbGciOiJIUzI1NiIs..."; // Ahmed's token
const CLIENT_TOKEN = "eyJhbGciOiJIUzI1NiIs..."; // Sara's token
const CONVERSATION_ID = "conv-uuid";

// ===== TRAINER (COACH) SIDE =====
const trainerSocket = io("http://localhost:3000", {
  auth: { token: TRAINER_TOKEN },
});

trainerSocket.on("connect", () => {
  console.log("🟢 Trainer connected");

  // Step 1: Trainer joins conversation
  trainerSocket.emit("JOIN_CONVERSATION", {
    conversationId: CONVERSATION_ID,
  });
});

trainerSocket.on("JOINED_CONVERSATION", () => {
  console.log("✅ Trainer joined conversation");

  // Step 2: Trainer sends message
  trainerSocket.emit("SEND_MESSAGE", {
    conversationId: CONVERSATION_ID,
    body: "Great form on that squat, Sara! 60kg looks solid.",
  });
});

trainerSocket.on("MESSAGE_SENT", (data) => {
  console.log("✅ Trainer's message sent:", data.messageId);
});

// ===== CLIENT (ATHLETE) SIDE =====
const clientSocket = io("http://localhost:3000", {
  auth: { token: CLIENT_TOKEN },
});

clientSocket.on("connect", () => {
  console.log("🟢 Client connected");

  // Step 3: Client joins same conversation
  clientSocket.emit("JOIN_CONVERSATION", {
    conversationId: CONVERSATION_ID,
  });
});

clientSocket.on("JOINED_CONVERSATION", () => {
  console.log("✅ Client joined conversation");

  // Step 4: Wait for trainer's message
});

clientSocket.on("MESSAGE_RECEIVED", (message) => {
  console.log("📨 Client received message:", message.body);

  // Step 5: Client marks message as read
  setTimeout(() => {
    clientSocket.emit("MARK_AS_READ", {
      conversationId: CONVERSATION_ID,
      messageId: message.id,
    });
  }, 1000);
});

clientSocket.on("MESSAGE_READ", (data) => {
  console.log("✅ Trainer's message marked as read by client");
});

// ===== EXPECTED CONSOLE OUTPUT =====
// 🟢 Trainer connected
// ✅ Trainer joined conversation
// ✅ Trainer's message sent: msg-uuid-2
// 🟢 Client connected
// ✅ Client joined conversation
// 📨 Client received message: Great form on that squat, Sara! 60kg looks solid.
// ✅ Trainer's message marked as read by client
```

---

## 4. Test in Postman

### Setup Collection

1. **Create Postman Collection** → Name: "Athletica Messaging"

2. **Add Variables:**
   - `base_url`: `http://localhost:3000`
   - `trainer_token`: (value from login)
   - `client_token`: (value from login)
   - `conversation_id`: (value from create conversation)
   - `message_id`: (value from send message)

3. **Create Requests:**

```
POST {{base_url}}/api/v1/messages
Headers:
  Authorization: Bearer {{trainer_token}}
  Content-Type: application/json
Body:
{
  "conversationId": "{{conversation_id}}",
  "body": "Test message from Postman"
}
```

### Test Workflow in Postman

1. Login (get trainer_token)
2. Create Conversation (get conversation_id)
3. Send Message (get message_id)
4. Get Messages
5. Mark as Read
6. Get Conversation Details

---

## 5. Error Testing

### Test Invalid Inputs

```bash
# Missing JWT token
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "'$CONV_ID'",
    "body": "Test"
  }'
# Response: 401 Unauthorized

# Empty message body
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "'$CONV_ID'",
    "body": ""
  }'
# Response: 400 "Message body cannot be empty"

# Message too long (>5000 chars)
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "'$CONV_ID'",
    "body": "'$(printf 'x%.0s' {1..5001})'"
  }'
# Response: 400 "Message body cannot exceed 5000 characters"

# Non-existent conversation
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "fake-uuid",
    "body": "Test"
  }'
# Response: 404 "Conversation not found"

# No access to conversation (different user pair)
# Response: 403 "You don't have access to this conversation"
```

---

## 6. Performance Testing

### Load Test Messages

```javascript
// Send 100 messages quickly
for (let i = 0; i < 100; i++) {
  socket.emit("SEND_MESSAGE", {
    conversationId: CONVERSATION_ID,
    body: `Message ${i + 1}`,
  });
}

// Measure DB query time
console.time("Get 1000 messages");
await fetch(`/api/v1/messages/${CONVERSATION_ID}?limit=1000`);
console.timeEnd("Get 1000 messages");
```

---

## Summary of All Events

### WebSocket Events

| Event                 | Direction       | Payload                                  | Purpose            |
| --------------------- | --------------- | ---------------------------------------- | ------------------ |
| `JOIN_CONVERSATION`   | Client → Server | `{ conversationId }`                     | Subscribe to room  |
| `JOINED_CONVERSATION` | Server → Client | `{ conversationId, success }`            | Confirm joined     |
| `USER_JOINED`         | Server → Client | `{ conversationId, userId, timestamp }`  | Notify others      |
| `SEND_MESSAGE`        | Client → Server | `{ conversationId, body }`               | Send message       |
| `MESSAGE_SENT`        | Server → Client | `{ messageId, conversationId, success }` | Confirm sent       |
| `MESSAGE_RECEIVED`    | Server → Client | `{ id, body, senderId, ... }`            | Broadcast to room  |
| `MARK_AS_READ`        | Client → Server | `{ conversationId, messageId? }`         | Mark read          |
| `MESSAGE_READ`        | Server → Client | `{ messageId, conversationId }`          | Notify read        |
| `CONVERSATION_READ`   | Server → Client | `{ conversationId, updatedCount }`       | Notify batch read  |
| `TYPING`              | Client → Server | `{ conversationId, isTyping }`           | Send typing status |
| `USER_TYPING`         | Server → Client | `{ conversationId, userId, isTyping }`   | Broadcast typing   |
| `LEAVE_CONVERSATION`  | Client → Server | `{ conversationId }`                     | Leave room         |
| `USER_LEFT`           | Server → Client | `{ conversationId, userId }`             | Notify left        |
| `ERROR`               | Server → Client | `{ event, message }`                     | Error response     |
