#!/usr/bin/env node

import process from "process";

/**
 * Quick WebSocket Test Script
 * Tests the messaging system with real-time communication
 *
 * Usage:
 *   node scripts/testMessaging.js <trainer-token> <client-token> <conversation-id>
 *
 * Example:
 *   node scripts/testMessaging.js "eyJ..." "eyJ..." "conv-uuid"
 */

import io from "socket.io-client";

const [, , trainerToken, clientToken, conversationId] = process.argv;

if (!trainerToken || !clientToken || !conversationId) {
  console.error(
    "Usage: node scripts/testMessaging.js <trainer-token> <client-token> <conversation-id>",
  );
  process.exit(1);
}

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
let testsPassed = 0;
let testsFailed = 0;

console.log("\n🚀 Starting WebSocket Messaging Tests\n");
console.log(`Server: ${SERVER_URL}`);
console.log(`Conversation: ${conversationId}\n`);

// ===== SETUP =====
const trainerSocket = io(SERVER_URL, {
  auth: { token: trainerToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

const clientSocket = io(SERVER_URL, {
  auth: { token: clientToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

let timeout;
let testState = {
  trainerConnected: false,
  clientConnected: false,
  trainerJoined: false,
  clientJoined: false,
  messageSent: false,
  messageReceived: false,
  messageRead: false,
};

// ===== TEST 1: Connection =====
trainerSocket.on("connect", () => {
  testState.trainerConnected = true;
  console.log("✅ Test 1A: Trainer connected to WebSocket");
  testsPassed++;

  // Start test 2 after both connect
  if (testState.clientConnected) {
    startJoinTest();
  }
});

clientSocket.on("connect", () => {
  testState.clientConnected = true;
  console.log("✅ Test 1B: Client connected to WebSocket");
  testsPassed++;

  // Start test 2 after both connect
  if (testState.trainerConnected) {
    startJoinTest();
  }
});

// ===== TEST 2: Join Conversation =====
function startJoinTest() {
  console.log("\n📝 Test 2: Joining Conversation\n");

  trainerSocket.emit("JOIN_CONVERSATION", { conversationId });
  clientSocket.emit("JOIN_CONVERSATION", { conversationId });

  timeout = setTimeout(() => {
    if (!testState.trainerJoined) {
      console.error("❌ Test 2A FAILED: Trainer failed to join");
      testsFailed++;
      cleanup();
    }
    if (!testState.clientJoined) {
      console.error("❌ Test 2B FAILED: Client failed to join");
      testsFailed++;
      cleanup();
    }
  }, 5000);
}

trainerSocket.on("JOINED_CONVERSATION", (data) => {
  if (data.success) {
    testState.trainerJoined = true;
    console.log("✅ Test 2A: Trainer joined conversation");
    testsPassed++;

    // Start test 3 after both join
    if (testState.clientJoined) {
      startSendMessageTest();
    }
  }
});

clientSocket.on("JOINED_CONVERSATION", (data) => {
  if (data.success) {
    testState.clientJoined = true;
    console.log("✅ Test 2B: Client joined conversation");
    testsPassed++;

    // Start test 3 after both join
    if (testState.trainerJoined) {
      startSendMessageTest();
    }
  }
});

// Listen for user joined notifications
trainerSocket.on("USER_JOINED", (data) => {
  console.log(`   👤 Client user joined (${data.userId.substring(0, 8)}...)`);
});

clientSocket.on("USER_JOINED", (data) => {
  console.log(`   👤 Trainer user joined (${data.userId.substring(0, 8)}...)`);
});

// ===== TEST 3: Send Message =====
function startSendMessageTest() {
  clearTimeout(timeout);
  console.log("\n💬 Test 3: Sending Message\n");

  const testMessage = `WebSocket test message - ${new Date().toISOString()}`;

  trainerSocket.emit("SEND_MESSAGE", {
    conversationId,
    body: testMessage,
  });

  timeout = setTimeout(() => {
    if (!testState.messageSent) {
      console.error("❌ Test 3A FAILED: Message not sent");
      testsFailed++;
    }
    if (!testState.messageReceived) {
      console.error("❌ Test 3B FAILED: Message not received by client");
      testsFailed++;
      cleanup();
    }
  }, 5000);
}

trainerSocket.on("MESSAGE_SENT", (data) => {
  if (data.success) {
    testState.messageSent = true;
    console.log(
      `✅ Test 3A: Message sent (ID: ${data.messageId.substring(0, 8)}...)`,
    );
    testsPassed++;

    // Wait for client to receive
    if (testState.messageReceived) {
      startMarkReadTest(testState.messageId);
    }
  }
});

// eslint-disable-next-line no-unused-vars
let messageReceiverData = null;

clientSocket.on("MESSAGE_RECEIVED", (message) => {
  testState.messageReceived = true;
  messageReceiverData = message;
  console.log(`✅ Test 3B: Message received by client`);
  console.log(`   Message: "${message.body.substring(0, 50)}..."`);
  console.log(`   Sender: ${message.sender.name}`);
  console.log(`   Read status: ${message.isRead}`);
  testsPassed++;

  // Start test 4
  if (testState.messageSent) {
    startMarkReadTest(message.id);
  }
});

// ===== TEST 4: Mark as Read =====
function startMarkReadTest(messageId) {
  clearTimeout(timeout);
  console.log("\n📖 Test 4: Marking Message as Read\n");

  clientSocket.emit("MARK_AS_READ", {
    conversationId,
    messageId,
  });

  timeout = setTimeout(() => {
    if (!testState.messageRead) {
      console.error("❌ Test 4 FAILED: Message was not marked as read");
      testsFailed++;
    }
    cleanup();
  }, 5000);
}

trainerSocket.on("MESSAGE_READ", (data) => {
  testState.messageRead = true;
  console.log(`✅ Test 4: Message marked as read by client`);
  console.log(`   Message ID: ${data.messageId.substring(0, 8)}...`);
  testsPassed++;
});

// ===== TEST 5: Typing Indicator =====
setTimeout(() => {
  if (testState.messageRead) {
    console.log("\n⌨️  Test 5: Typing Indicator\n");

    clientSocket.emit("TYPING", {
      conversationId,
      isTyping: true,
    });
  }
}, 2000);

trainerSocket.on("USER_TYPING", (data) => {
  if (data.isTyping) {
    console.log(`✅ Test 5: Received typing indicator`);
    console.log(`   User: ${data.userId.substring(0, 8)}...`);
    testsPassed++;

    // Stop typing
    setTimeout(() => {
      clientSocket.emit("TYPING", {
        conversationId,
        isTyping: false,
      });
    }, 2000);
  }
});

// ===== ERROR HANDLING =====
trainerSocket.on("ERROR", (error) => {
  console.error(`❌ Trainer Socket Error:`, error);
  testsFailed++;
});

clientSocket.on("ERROR", (error) => {
  console.error(`❌ Client Socket Error:`, error);
  testsFailed++;
});

trainerSocket.on("error", (error) => {
  console.error(`❌ Trainer Connection Error:`, error);
  testsFailed++;
});

clientSocket.on("error", (error) => {
  console.error(`❌ Client Connection Error:`, error);
  testsFailed++;
});

// ===== TEST SUMMARY =====
function cleanup() {
  clearTimeout(timeout);

  setTimeout(() => {
    console.log("\n" + "=".repeat(50));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(
      `📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`,
    );
    console.log("=".repeat(50) + "\n");

    if (testsFailed === 0) {
      console.log("🎉 All tests passed!\n");
      process.exit(0);
    } else {
      console.log("⚠️  Some tests failed!\n");
      process.exit(1);
    }

    trainerSocket.close();
    clientSocket.close();
  }, 1000);
}

// Cleanup on timeout
setTimeout(() => {
  if (!testState.messageRead) {
    cleanup();
  }
}, 30000);
