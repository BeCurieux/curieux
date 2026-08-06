// Mock email provider — the default, so nothing is ever sent by accident.
//
// Keeps what it was asked to send in memory, which is what the tests read and
// what makes demo mode honest: you can walk the whole flow and see exactly
// what would have gone out.

import type { EmailProvider, OutboundEmail, SendResult } from "./provider";

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  static sent: OutboundEmail[] = [];

  async send(message: OutboundEmail): Promise<SendResult> {
    MockEmailProvider.sent.push(message);
    if (process.env.EMAIL_DEBUG === "1") {
      console.log(`\n── email → ${message.to.email}\n${message.subject}\n${message.text}\n`);
    }
    return { id: `mock-${MockEmailProvider.sent.length}`, provider: this.name };
  }

  static reset() {
    MockEmailProvider.sent = [];
  }
}
