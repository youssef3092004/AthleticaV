import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

const MAX_PAIRS = 5;
const MESSAGES_PER_CONVERSATION = 8;

const MESSAGE_TEMPLATES = [
  "Great work today. How did the session feel?",
  "Felt strong, especially on lower body movements.",
  "Nice. Keep your rest periods around 60-90 seconds.",
  "Got it. Should I increase weight next session?",
  "Yes, add 2.5kg on your main lift if form stays clean.",
  "Perfect, I will log it after training.",
  "Also hydrate well and prioritize sleep tonight.",
  "Will do, thanks coach.",
  "Any pain or discomfort after last workout?",
  "No pain, only normal soreness.",
];

const pickMessageBody = (index) => {
  return MESSAGE_TEMPLATES[index % MESSAGE_TEMPLATES.length];
};

const getMessageTimestamp = (conversationOffset, messageOffset) => {
  const now = Date.now();
  const daysAgoMs = conversationOffset * 24 * 60 * 60 * 1000;
  const minutesBetweenMessages =
    (MESSAGES_PER_CONVERSATION - messageOffset) * 12;
  const messageOffsetMs = minutesBetweenMessages * 60 * 1000;

  return new Date(now - daysAgoMs - messageOffsetMs);
};

const seedConversationMessages = async (
  conversation,
  trainerId,
  clientId,
  pairIndex,
) => {
  const existingCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  });

  if (existingCount >= MESSAGES_PER_CONVERSATION) {
    return {
      created: 0,
      skipped: true,
    };
  }

  const remaining = MESSAGES_PER_CONVERSATION - existingCount;
  const messages = [];

  for (let i = 0; i < remaining; i += 1) {
    const absoluteIndex = existingCount + i;
    const senderId = absoluteIndex % 2 === 0 ? trainerId : clientId;

    // Mark older messages as read and keep newest two potentially unread.
    const isRead = absoluteIndex < MESSAGES_PER_CONVERSATION - 2;

    messages.push({
      conversationId: conversation.id,
      senderId,
      body: pickMessageBody(absoluteIndex),
      type: "TEXT",
      isRead,
      createdAt: getMessageTimestamp(pairIndex, absoluteIndex),
    });
  }

  await prisma.message.createMany({
    data: messages,
  });

  return {
    created: messages.length,
    skipped: false,
  };
};

const main = async () => {
  const trainerClients = await prisma.trainerClient.findMany({
    where: { status: "ACTIVE" },
    select: {
      trainerId: true,
      clientId: true,
    },
    orderBy: { startedAt: "asc" },
    take: MAX_PAIRS,
  });

  if (trainerClients.length === 0) {
    console.log(
      "No ACTIVE trainer-client pairs found. Create trainer-client relationships first.",
    );
    return;
  }

  let conversationsCreated = 0;
  let messagesCreated = 0;

  for (let i = 0; i < trainerClients.length; i += 1) {
    const pair = trainerClients[i];

    const existedBefore = await prisma.conversation.findUnique({
      where: {
        trainerId_clientId: {
          trainerId: pair.trainerId,
          clientId: pair.clientId,
        },
      },
      select: { id: true },
    });

    const conversation = await prisma.conversation.upsert({
      where: {
        trainerId_clientId: {
          trainerId: pair.trainerId,
          clientId: pair.clientId,
        },
      },
      update: {},
      create: {
        trainerId: pair.trainerId,
        clientId: pair.clientId,
      },
      select: { id: true },
    });

    if (!existedBefore) {
      conversationsCreated += 1;
    }

    const messageResult = await seedConversationMessages(
      conversation,
      pair.trainerId,
      pair.clientId,
      i,
    );

    messagesCreated += messageResult.created;

    if (messageResult.skipped) {
      console.log(
        `Conversation ${conversation.id} already has ${MESSAGES_PER_CONVERSATION}+ messages, skipped.`,
      );
    } else {
      console.log(
        `Seeded ${messageResult.created} messages for conversation ${conversation.id}.`,
      );
    }
  }

  console.log("Conversation/message seed completed successfully");
  console.log(`Conversations touched: ${trainerClients.length}`);
  console.log(`Conversations newly created: ${conversationsCreated}`);
  console.log(`Messages created: ${messagesCreated}`);
};

main()
  .catch((error) => {
    console.error("Conversation/message seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
