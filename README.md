# TgService - Telegram messaging service

# TgService

**TgService** is a service for sending messages to Telegram with full respect to all Telegram API limits.

It supports two communication methods:

- **RabbitMQ Messaging** — with built-in **auto-retries** using **exponential backoff** up to a specified limit, and **payload validation**.
- **REST API** — for direct message submission via HTTP.

## Features

- 📬 Reliable message sending to Telegram
- 🛡️ Automatic handling of Telegram rate limits
- 🔁 RabbitMQ support with **exponential retry delay**
- 📈 Validation for all incoming data
- 🚀 REST API for sending single or bulk messages

## Communication Methods

### 1. RabbitMQ

Handled via the `tg.send` event pattern:

```typescript
@HandledEventPattern('tg.send', SendMessageDto)
async handleTgSend(@HandledPayload() data: SendMessageDto) {
    await this.telegramService.addToQueue(data);
}
```

```typescript
this.tgSenderClient
  .emit('tg.send', {
    payload: {
      botToken,
      chatId,
      text,
    },
    headers: {
      'x-original-routing-key': 'tg.send',
      'message-id': `${chatId}-${ctx.message.message_id}`,
    },
  })
  .subscribe({
    error: (err) => {
      this.logger.error('Error at tgSenderClient.emit: ', err);
    },
  });
```

Features:

- Automatic retries with exponential backoff if message sending fails.
- Maximum retry limit is configurable.
- Ensures messages are not lost due to temporary issues.

### 2. REST API

You can interact with the service through HTTP endpoints:

#### Send a Single Message

```http
POST /send-message
```

**Body (SendMessageDto):**

```json
{
  "botToken": "string",
  "chatId": "string",
  "text": "string",
  "fileUrl": "optional string",
  "fileId": "optional string",
  "replyMarkup": "optional object",
  "contentType": "optional enum (PHOTO | VIDEO | AUDIO | FILE)",
  "type": "enum (SINGLE_CHAT | BROADCAST | GROUP)"
}
```

Example:

```bash
curl -X POST http://your-service/send-message \
  -H 'Content-Type: application/json' \
  -d '{
        "botToken": "123:ABC",
        "chatId": "987654321",
        "text": "Hello from TgService!",
        "type": "SINGLE_CHAT"
      }'
```

#### Send Bulk Messages

```http
POST /send-message/bulk
```

**Body (SendMessageBulkDto):**

```json
{
  "messages": [ SendMessageDto, SendMessageDto, ... ]
}
```

- Supports **up to 100 messages** per request.
- All messages are validated individually.

Example:

```bash
curl -X POST http://your-service/send-message/bulk \
  -H 'Content-Type: application/json' \
  -d '{
        "messages": [
          {
            "botToken": "123:ABC",
            "chatId": "987654321",
            "text": "Message 1",
            "type": "SINGLE_CHAT"
          },
          {
            "botToken": "123:ABC",
            "chatId": "123456789",
            "text": "Message 2",
            "type": "SINGLE_CHAT"
          }
        ]
      }'
```

## DTOs

### SendMessageDto

| Field         | Type   | Required | Description                                  |
| :------------ | :----- | :------- | :------------------------------------------- |
| `botToken`    | string | ✅       | Bot token for authentication                 |
| `chatId`      | string | ✅       | Target chat or user ID                       |
| `text`        | string | ✅       | Text of the message                          |
| `fileUrl`     | string | Optional | URL to attach a file                         |
| `fileId`      | string | Optional | Telegram file ID to reuse                    |
| `replyMarkup` | object | Optional | Telegram markup (inline keyboard)            |
| `contentType` | enum   | Optional | Content type (PHOTO, VIDEO, AUDIO, FILE)     |
| `type`        | enum   | ✅       | Message type (SINGLE_CHAT, BROADCAST, GROUP) |

### SendMessageBulkDto

| Field      | Type             | Required | Description                               |
| :--------- | :--------------- | :------- | :---------------------------------------- |
| `messages` | SendMessageDto[] | ✅       | Array of up to 100 `SendMessageDto` items |

## Summary

TgService allows you to reliably and safely send messages to Telegram, whether you need one message or thousands, while automatically handling retries, delays, and Telegram-specific limitations.

Built using NestJS and RabbitMQ.
