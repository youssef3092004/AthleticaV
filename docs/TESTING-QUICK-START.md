# 🚀 Quick Start - Testing the WebSocket Messaging System

## 3 Ways to Test

---

## 1️⃣ **Browser Test Tool** (Easiest - Visual Testing)

### Setup & Run:

```bash
# Server running in terminal 1:
npm run dev

# In browser, open:
open docs/messaging-test.html
# or manually: http://localhost:3000/docs/messaging-test.html
```

### How to Use:

1. **Get Tokens:**
   - Login as trainer → copy JWT token
   - Login as client → copy JWT token
   - Get conversation ID from earlier creation

2. **In the HTML Dashboard:**
   - Paste trainer token in "JWT Token (Trainer)"
   - Paste client token in "JWT Token (Client)"
   - Paste conversation ID
   - Click "🔗 Connect Both"
   - Click "📝 Join Conversation"

3. **Send Messages:**
   - Type in the chat box at bottom right
   - Press Enter or click Send
   - Messages appear in real-time
   - See event logs on the left

4. **Test Features:**
   - **Mark Read:** Click "Mark Read (All)"
   - **Typing:** Click "Start Typing" to see indicator
   - **Real-time:** Open 2 windows (one as trainer, one as client)

---

## 2️⃣ **Command Line Test Script** (Automated Testing)

### Run Automated Tests:

```bash
# First, get your tokens (login endpoint)
export TRAINER_TOKEN="eyJhbGc..."
export CLIENT_TOKEN="eyJhbGc..."
export CONVERSATION_ID="550e8400-e29b-41d4-a716-446655440000"

# Run tests
node scripts/testMessaging.js $TRAINER_TOKEN $CLIENT_TOKEN $CONVERSATION_ID
```

### Expected Output:

```
🚀 Starting WebSocket Messaging Tests

Server: http://localhost:3000
Conversation: conv-uuid

✅ Test 1A: Trainer connected to WebSocket
✅ Test 1B: Client connected to WebSocket

📝 Test 2: Joining Conversation

✅ Test 2A: Trainer joined conversation
✅ Test 2B: Client joined conversation

💬 Test 3: Sending Message

✅ Test 3A: Message sent (ID: msg-uuid...)
✅ Test 3B: Message received by client
   Message: "WebSocket test message - 2026-04-..."
   Sender: Ahmed
   Read status: false

📖 Test 4: Marking Message as Read

✅ Test 4: Message marked as read by client
   Message ID: msg-uuid...

⌨️  Test 5: Typing Indicator

✅ Test 5: Received typing indicator
   User: sara-uuid...

==================================================
📊 TEST SUMMARY
==================================================
✅ Passed: 9
❌ Failed: 0
📈 Success Rate: 100%
==================================================

🎉 All tests passed!
```

---

## 3️⃣ **cURL / REST Testing** (Manual API Testing)

### Get Tokens:

```bash
# Login as trainer (Ahmed)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ahmed@example.com", "password": "password123"}'

# Save token
export TRAINER_TOKEN="eyJhbGc..."

# Login as client (Sara)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sara@example.com", "password": "password123"}'

export CLIENT_TOKEN="eyJhbGc..."
```

### Test REST Endpoints:

**1. Create Conversation:**

```bash
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"otherUserId": "sara-uuid"}'

# Save the ID: conv-uuid
export CONV_ID="conv-uuid"
```

**2. Send Message:**

```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer $TRAINER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "'$CONV_ID'",
    "body": "Great work today!"
  }'

# Save message ID: msg-uuid
export MSG_ID="msg-uuid"
```

**3. Get Messages:**

```bash
curl http://localhost:3000/api/v1/messages/$CONV_ID \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

**4. Mark as Read:**

```bash
curl -X PATCH http://localhost:3000/api/v1/messages/$MSG_ID/read \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

**5. Get Conversations:**

```bash
curl http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer $TRAINER_TOKEN"
```

---

## 📋 Complete Test Workflow

### Step-by-Step Setup:

```bash
# Terminal 1: Start server
npm run dev
# Output: Server running on port 3000

# Terminal 2: Get trainer token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ahmed@example.com", "password": "password"}'
# Copy "token" value

# Terminal 2: Get client token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sara@example.com", "password": "password"}'
# Copy "token" value

# Terminal 2: Create conversation (use trainer token)
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer <TRAINER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"otherUserId": "<SARA_USER_ID>"}'
# Copy conversation ID

# Terminal 2: Send message
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer <TRAINER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "<CONV_ID>",
    "body": "Hello Sara!"
  }'

# Terminal 2: Get messages (client retrieves)
curl http://localhost:3000/api/v1/messages/<CONV_ID> \
  -H "Authorization: Bearer <CLIENT_TOKEN>"
```

---

## 🧪 Test Checklist

- [ ] **Connection:** Both trainer and client sockets connect
- [ ] **Join:** Both users can join a conversation room
- [ ] **Send:** Messages sent via WebSocket/REST appear in DB
- [ ] **Receive:** Real-time delivery to other user via WebSocket
- [ ] **Persist:** Messages visible after page reload (REST API)
- [ ] **Read Status:** Mark as read updates correctly
- [ ] **Pagination:** Get messages with `?page=1&limit=50`
- [ ] **Latest:** Get latest message endpoint works
- [ ] **Typing:** Typing indicator broadcasts to room
- [ ] **Error:** Invalid inputs return proper 400/403/404 errors
- [ ] **Delete:** Own messages deleted within 5 min window
- [ ] **Performance:** Queries complete in <100ms

---

## 🐛 Troubleshooting

### WebSocket Not Connecting

```
Error: "Authentication error: No token provided"
→ Check token is passed correctly in Socket.IO auth
```

### Messages Not Appearing

```
Error: "Conversation not found"
→ Verify conversation exists and user is participant
→ Check conversation ID is correct
```

### "Cannot mark your own message as read"

```
→ This is correct behavior - only recipient can mark sender's messages as read
```

### Message Deleted Error

```
Error: "Messages can only be deleted within 5 minutes"
→ Only messages sent in last 5 minutes can be deleted
→ Only sender can delete their own messages
```

---

## 📚 Full Documentation

For complete API docs, see: [docs/messaging-api-testing.md](./messaging-api-testing.md)

---

## 🎯 MVP Demo Scenario

Test the MVP flow:

1. **coach (Ahmed) sends message to client (Sara)**

```bash
# Ahmed sends: "Great squat yesterday, 60kg!"
node scripts/testMessaging.js $TRAINER_TOKEN $CLIENT_TOKEN $CONV_ID
```

2. **Sara sees latest message on dashboard**

```bash
curl http://localhost:3000/api/v1/conversations/$CONV_ID/latest \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

3. **Sara marks as read**

```bash
curl -X PATCH http://localhost:3000/api/v1/messages/conversation/$CONV_ID/read-all \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

✅ **Perfect for demo!**
