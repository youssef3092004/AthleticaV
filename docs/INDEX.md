# Documentation Index

Quick navigation guide to all AthleticaV documentation. Start here to find what you need.

## 🚀 New to the Project?

**Start with these in order:**

1. **[README.md](../README.md)** - Project overview, architecture, feature list
2. **[GETTING-STARTED.md](GETTING-STARTED.md)** - Setup guide, first API call, common tasks
3. **[MODULES-REFERENCE.md](MODULES-REFERENCE.md)** - Pick a module you're interested in

---

## 📚 Documentation Maps

### By Role

#### I'm a Backend Developer Adding Features

1. [GETTING-STARTED.md](GETTING-STARTED.md) → "Add a New Endpoint"
2. [MODULES-REFERENCE.md](MODULES-REFERENCE.md) → Find related modules
3. [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) → Deep dive if needed
4. [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) → Understand data relationships

#### I'm Fixing a Bug

1. Read [README.md](../README.md) → Architecture section
2. Use [MODULES-REFERENCE.md](MODULES-REFERENCE.md) to find the controller
3. Check [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) if bug is in complex area
4. Test using [TESTING-QUICK-START.md](TESTING-QUICK-START.md)

#### I'm Onboarding a Team Member

1. Send [GETTING-STARTED.md](GETTING-STARTED.md) for local setup
2. Explain [README.md](../README.md) architecture over [MODULES-REFERENCE.md](MODULES-REFERENCE.md)
3. Point to [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) for system details

#### I'm Reviewing Code

1. Check [README.md → Code Style Guide](../README.md#development--code-style-guide)
2. Understand the module via [MODULES-REFERENCE.md](MODULES-REFERENCE.md)
3. Verify database changes align with [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)

### By Feature Area

#### Meal Planning

- Overview: [README.md → Meal Planning](../README.md#6-meal-planning-system)
- Implementation: [ARCHITECTURE-COMPLEX-LOGIC.md → Meal Planning Architecture](ARCHITECTURE-COMPLEX-LOGIC.md#meal-plan-architecture)
- Visual Schema: [DATABASE-SCHEMA.md → Meal Planning Layer](DATABASE-SCHEMA.md#meal-planning-layer)
- Modules: [MODULES-REFERENCE.md → Meal Planning System](MODULES-REFERENCE.md#meal-planning-system)

#### Workout Programming

- Overview: [README.md → Workout Programming](../README.md#7-workout-programming)
- Implementation: [ARCHITECTURE-COMPLEX-LOGIC.md → Workout Management](ARCHITECTURE-COMPLEX-LOGIC.md#workout-programming)
- Visual Schema: [DATABASE-SCHEMA.md → Workout Programming Layer](DATABASE-SCHEMA.md#workout-programming-layer)
- Modules: [MODULES-REFERENCE.md → Workout Programming System](MODULES-REFERENCE.md#workout-programming-system)

#### Authentication & Authorization

- Overview: [README.md → Auth & Authorization](../README.md#authentication--authorization)
- RBAC Deep Dive: [ARCHITECTURE-COMPLEX-LOGIC.md → RBAC Implementation](ARCHITECTURE-COMPLEX-LOGIC.md#rbac-implementation)
- Permission Reference: [auth-permission-reference.md](auth-permission-reference.md)
- Schema: [DATABASE-SCHEMA.md → User & Authentication Layer](DATABASE-SCHEMA.md#user--authentication-layer)

#### Messaging

- Overview: [README.md → Real-Time Messaging](../README.md#8-real-time-messaging)
- Implementation: [ARCHITECTURE-COMPLEX-LOGIC.md → Real-Time Messaging](ARCHITECTURE-COMPLEX-LOGIC.md#real-time-messaging)
- Setup Guide: [MESSAGING-README.md](MESSAGING-README.md)
- Test Endpoints: [messaging-api-testing.md](messaging-api-testing.md)
- HTML Testers: [trainer-messaging-test.html](trainer-messaging-test.html), [client-messaging-test.html](client-messaging-test.html)

#### Financial/Wallet System

- Overview: [README.md → Payments & Financials](../README.md#12-transactions--payments)
- Implementation: [ARCHITECTURE-COMPLEX-LOGIC.md → Transaction Processing](ARCHITECTURE-COMPLEX-LOGIC.md#transaction-processing)
- Schema: [DATABASE-SCHEMA.md → Financial Layer](DATABASE-SCHEMA.md#financial-layer)

#### Progress Tracking

- Overview: [README.md → Progress Tracking](../README.md#9-progress-tracking)
- Implementation: [ARCHITECTURE-COMPLEX-LOGIC.md → Progress Calculation](ARCHITECTURE-COMPLEX-LOGIC.md#progress-calculation)
- Schema: [DATABASE-SCHEMA.md → Progress Tracking Layer](DATABASE-SCHEMA.md#progress-tracking-layer)

#### Trainer-Client Relationships

- Overview: [README.md → Trainer-Client Relationships](../README.md#4-trainer-client-relationships)
- Implementation: [ARCHITECTURE-COMPLEX-LOGIC.md → Trainer-Client Relationship Flow](ARCHITECTURE-COMPLEX-LOGIC.md#trainer-client-relationship-flow)
- Flow Diagram: [trainer-invite-to-trainer-client-flow.md](trainer-invite-to-trainer-client-flow.md)
- Schema: [DATABASE-SCHEMA.md → Coaching Relationship Layer](DATABASE-SCHEMA.md#coaching-relationship-layer)

### By Task Type

#### Setup & Configuration

- [GETTING-STARTED.md](GETTING-STARTED.md) → Database Setup
- [prisma-migration-workflow.md](prisma-migration-workflow.md) → Database migrations
- [README.md → Development](../README.md#development)

#### API Development

- [GETTING-STARTED.md](GETTING-STARTED.md) → Add New Endpoint
- [MODULES-REFERENCE.md](MODULES-REFERENCE.md) → Find similar modules
- [README.md → Architecture](../README.md#architecture)

#### Testing

- [TESTING-QUICK-START.md](TESTING-QUICK-START.md) → Run tests
- [TESTING-SUMMARY.md](TESTING-SUMMARY.md) → Test coverage overview
- [messaging-api-testing.md](messaging-api-testing.md) → Messaging tests
- [Postman Collection](Athletica-Messaging-API.postman_collection.json) → Import into Postman

#### Database Design

- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) → Visual entity relationships
- [prisma/schema.prisma](../prisma/schema.prisma) → Full schema definition
- [prisma-migration-workflow.md](prisma-migration-workflow.md) → Making changes

#### Understanding Complex Logic

- [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) → Main resource
  - [Meal Planning](ARCHITECTURE-COMPLEX-LOGIC.md#meal-plan-architecture)
  - [RBAC](ARCHITECTURE-COMPLEX-LOGIC.md#rbac-implementation)
  - [Messaging](ARCHITECTURE-COMPLEX-LOGIC.md#real-time-messaging)
  - [Transactions](ARCHITECTURE-COMPLEX-LOGIC.md#transaction-processing)

#### Debugging

- [GETTING-STARTED.md](GETTING-STARTED.md) → Troubleshooting section
- [README.md → Troubleshooting](../README.md#troubleshooting)
- Check logs: `npm run dev` terminal output

#### Recent Updates

- [updates-2026-04-07.md](updates-2026-04-07.md) → Latest changes
- [updates-2026-04-06.md](updates-2026-04-06.md) → Previous update

---

## 📋 All Documentation Files

### Core Documentation

| File                                                               | Purpose                                           | For                    |
| ------------------------------------------------------------------ | ------------------------------------------------- | ---------------------- |
| **[README.md](../README.md)**                                      | Project overview, full feature list, architecture | Everyone               |
| **[GETTING-STARTED.md](GETTING-STARTED.md)**                       | Setup, first API call, common tasks               | New developers         |
| **[MODULES-REFERENCE.md](MODULES-REFERENCE.md)**                   | Quick lookup for all 36 controllers               | Developers             |
| **[ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md)** | Deep dives into intricate systems                 | Developers, architects |
| **[DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)**                       | Visual ERD and table reference                    | DBAs, developers       |

### Feature Documentation

| File                                                                                     | Purpose                    | Covers                    |
| ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------- |
| **[MESSAGING-README.md](MESSAGING-README.md)**                                           | Messaging system setup     | WebSocket, real-time      |
| **[TESTING-QUICK-START.md](TESTING-QUICK-START.md)**                                     | Testing guide              | Test setup, running tests |
| **[TESTING-SUMMARY.md](TESTING-SUMMARY.md)**                                             | Test coverage overview     | What's tested             |
| **[auth-permission-reference.md](auth-permission-reference.md)**                         | All permissions listed     | RBAC permissions          |
| **[trainer-invite-to-trainer-client-flow.md](trainer-invite-to-trainer-client-flow.md)** | Coaching relationship flow | Invitation workflow       |
| **[prisma-migration-workflow.md](prisma-migration-workflow.md)**                         | Database migrations        | Schema changes            |

### API Testing

| File                                                                      | Purpose                        | Type        |
| ------------------------------------------------------------------------- | ------------------------------ | ----------- |
| **[messaging-api-testing.md](messaging-api-testing.md)**                  | Messaging API test guide       | Reference   |
| **[Postman Collection](Athletica-Messaging-API.postman_collection.json)** | Ready-to-import Postman tests  | Interactive |
| **[trainer-messaging-test.html](trainer-messaging-test.html)**            | Browser-based messaging tester | Interactive |
| **[client-messaging-test.html](client-messaging-test.html)**              | Browser-based messaging tester | Interactive |

### OpenAPI

| File                                         | Purpose                |
| -------------------------------------------- | ---------------------- |
| **[openapi.meals.yaml](openapi.meals.yaml)** | Meal API specification |

### Updates & Changelogs

| File                                               | Purpose         |
| -------------------------------------------------- | --------------- |
| **[updates-2026-04-07.md](updates-2026-04-07.md)** | Latest changes  |
| **[updates-2026-04-06.md](updates-2026-04-06.md)** | Previous update |

---

## 🔍 Search Across Docs

### "How do I...?"

| Question                             | Answer                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| ...setup the project locally?        | [GETTING-STARTED.md](GETTING-STARTED.md) → Section 1-3                                                   |
| ...add a new API endpoint?           | [GETTING-STARTED.md](GETTING-STARTED.md) → Section 9                                                     |
| ...understand RBAC?                  | [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md#rbac-implementation)                       |
| ...create a meal plan from template? | [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md#1-template-based-creation)                 |
| ...implement real-time messaging?    | [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md#real-time-messaging)                       |
| ...make a database migration?        | [prisma-migration-workflow.md](prisma-migration-workflow.md)                                             |
| ...test an API endpoint?             | [TESTING-QUICK-START.md](TESTING-QUICK-START.md) or [messaging-api-testing.md](messaging-api-testing.md) |
| ...debug something?                  | [GETTING-STARTED.md](GETTING-STARTED.md) → Troubleshooting                                               |
| ...find module X?                    | [MODULES-REFERENCE.md](MODULES-REFERENCE.md)                                                             |
| ...verify schema changes?            | [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)                                                                 |

### "Tell me about..."

| Topic                   | Document                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Meal planning           | [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md#meal-plan-architecture) + [README.md](../README.md#6-meal-planning-system) |
| Workout programming     | [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md#workout-programming) + [README.md](../README.md#7-workout-programming)     |
| Authentication flow     | [README.md](../README.md#authentication--authorization) + [auth-permission-reference.md](auth-permission-reference.md)                   |
| Trainer-client workflow | [trainer-invite-to-trainer-client-flow.md](trainer-invite-to-trainer-client-flow.md)                                                     |
| Messaging system        | [MESSAGING-README.md](MESSAGING-README.md) + [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md#real-time-messaging)          |
| Database schema         | [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)                                                                                                 |
| Project structure       | [README.md](../README.md#architecture)                                                                                                   |
| All API endpoints       | [MODULES-REFERENCE.md](MODULES-REFERENCE.md)                                                                                             |

---

## 🎯 Common Workflows

### Workflow 1: Adding a Feature

```
1. Start:         README.md → Architecture
2. Find similar:  MODULES-REFERENCE.md → Find existing pattern
3. Learn pattern: Read that controller in codebase
4. Plan:          DATABASE-SCHEMA.md → Plan data changes
5. Implement:     GETTING-STARTED.md → Add a New Endpoint
6. Test:          TESTING-QUICK-START.md
7. Reference:     README.md → Code Style Guide
```

### Workflow 2: Understanding Meal Planning

```
1. Overview:      README.md → Meal Planning System
2. Deep dive:     ARCHITECTURE-COMPLEX-LOGIC.md → Meal Planning Architecture
3. Visual:        DATABASE-SCHEMA.md → Meal Planning Layer
4. Code:          MODULES-REFERENCE.md → Meal Planning System (links to code)
5. Test:          Use Postman or curl examples from README
```

### Workflow 3: Implementing Trainer-Client Workflow

```
1. Flow diagram:  trainer-invite-to-trainer-client-flow.md
2. Database:      DATABASE-SCHEMA.md → Coaching Relationship Layer
3. Modules:       MODULES-REFERENCE.md → Trainer-Client Relationships
4. Code:          Follow links from MODULES-REFERENCE.md
5. Test:          TESTING-QUICK-START.md
```

### Workflow 4: Setting Up Real-Time Messaging

```
1. Overview:      README.md → Real-Time Messaging
2. Setup:         MESSAGING-README.md
3. Implementation: ARCHITECTURE-COMPLEX-LOGIC.md → Real-Time Messaging
4. Testing:       messaging-api-testing.md + HTML testers
5. Code:          MODULES-REFERENCE.md → Messaging & Communication
```

---

## 📱 Docs by Audience

### Product Managers

- [README.md](../README.md) → Features overview
- [trainer-invite-to-trainer-client-flow.md](trainer-invite-to-trainer-client-flow.md) → User flows

### Developers (Implementing Features)

1. [README.md](../README.md)
2. [GETTING-STARTED.md](GETTING-STARTED.md)
3. [MODULES-REFERENCE.md](MODULES-REFERENCE.md)
4. [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) (if needed)

### Database Administrators

- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)
- [prisma/schema.prisma](../prisma/schema.prisma)
- [prisma-migration-workflow.md](prisma-migration-workflow.md)

### QA / Testers

- [TESTING-QUICK-START.md](TESTING-QUICK-START.md)
- [TESTING-SUMMARY.md](TESTING-SUMMARY.md)
- [messaging-api-testing.md](messaging-api-testing.md)
- [Postman Collection](Athletica-Messaging-API.postman_collection.json)

### DevOps / Infrastructure

- [README.md](../README.md) → Quick Start
- [GETTING-STARTED.md](GETTING-STARTED.md) → Database Setup
- `.env` files (environment variables)

### Architects / Tech Leads

- [README.md](../README.md) → Full architecture
- [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) → System design
- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) → Data model
- [MODULES-REFERENCE.md](MODULES-REFERENCE.md) → Module dependencies

---

## 🔗 External References

### Official Docs

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Socket.IO Documentation](https://socket.io/docs/)

### Project Links

- GitHub Repo: https://github.com/youssef3092004/AthleticaV
- Issue Tracker: https://github.com/youssef3092004/AthleticaV/issues
- Discussions: https://github.com/youssef3092004/AthleticaV/discussions

---

## 💡 Tips

- **Getting stuck?** Check the relevant section in [GETTING-STARTED.md → Troubleshooting](GETTING-STARTED.md#11-troubleshooting)
- **Need examples?** The [Postman Collection](Athletica-Messaging-API.postman_collection.json) has all API calls
- **Want to contribute?** Start with [GETTING-STARTED.md → Add a New Endpoint](GETTING-STARTED.md#9-common-development-tasks)
- **Explaining to teammates?** Use [README.md](../README.md) for architecture overview
- **Deep diving?** [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) is your resource

---

## 📞 Questions?

| Question Type      | Resource                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| Setup issue?       | [GETTING-STARTED.md → Troubleshooting](GETTING-STARTED.md#11-troubleshooting) |
| API question?      | [README.md → Core Modules](../README.md#core-modules)                         |
| Database question? | [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)                                      |
| How do I X?        | Search this index                                                             |
| Bug or issue?      | [GitHub Issues](https://github.com/youssef3092004/AthleticaV/issues)          |

---

**Last Updated:** April 2026  
**Docs Version:** 1.0

👉 **Start here:** [README.md](../README.md) → [GETTING-STARTED.md](GETTING-STARTED.md)
