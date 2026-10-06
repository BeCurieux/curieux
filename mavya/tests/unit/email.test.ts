import { describe, expect, it } from "vitest";
import * as messages from "@/lib/email/messages";

// Subjects and previews show on lock screens and in shared inboxes: never a
// child, a skill or a place (docs/SECURITY.md).
const outside = (e: messages.Email) => `${e.subject} ${e.preview}`;

describe("email wording", () => {
  it("a spot offered says where, not who or which class", () => {
    const e = messages.spotOffered({
      school: "Aqua House",
      heldUntil: "6:30pm Thu 8 Oct",
      claimUrl: "https://app.ovyko.com.au/family/claim/abc",
    });
    expect(e.subject).toBe("A spot has opened at Aqua House");
    expect(e.text).toContain("https://app.ovyko.com.au/family/claim/abc");
    expect(e.html).toContain('href="https://app.ovyko.com.au/family/claim/abc"');
  });

  it("a place offered says where and until when, never who", () => {
    const e = messages.placeOffered({
      school: "Aqua House",
      klass: "Tuesdays at 4:30pm, Level 2, Riverside",
      heldUntil: "6:30pm Thu 8 Oct",
      url: "https://app.ovyko.com.au/family",
    });
    expect(outside(e)).toBe("A place has come up at Aqua House It's held for you for 48 hours.");
    expect(e.text).toContain("Tuesdays at 4:30pm, Level 2, Riverside");
    expect(e.text).toContain("held for you until 6:30pm Thu 8 Oct");
  });

  it("a reminder names the activity and time only", () => {
    const one = messages.lessonReminder({
      school: "Aqua House",
      lessons: [{ activity: "Swimming", time: "4:30pm" }],
      url: "u",
      settingsUrl: "s",
    });
    expect(one.subject).toBe("Swimming today at 4:30pm");
    expect(one.text).toContain("Turn it off in Account: s");
    const two = messages.lessonReminder({
      school: "Aqua House",
      lessons: [
        { activity: "Swimming", time: "4:30pm" },
        { activity: "Swimming", time: "5:00pm" },
      ],
      url: "u",
      settingsUrl: "s",
    });
    expect(two.subject).toBe("2 lessons today, from 4:30pm");
  });

  it("cancellations and progress stay neutral", () => {
    expect(
      outside(messages.lessonCancelled({ school: "Aqua House", day: "Thursday 8 Oct", url: "u" })),
    ).toBe("A lesson at Aqua House has been cancelled Sign in to Ovyko to see the details.");
    expect(messages.skillAchieved({ school: "Aqua House", url: "u" }).subject).toBe(
      "New progress update from Aqua House",
    );
  });

  it("an invite names the school and the family, and escapes what it's given", () => {
    const e = messages.invite({
      school: "Aqua <House>",
      family: "Thompson Family",
      joinUrl: "https://x/join/1",
    });
    expect(e.subject).toBe("Aqua <House> invited you to Ovyko");
    expect(e.text).toContain("join the Thompson family");
    expect(e.html).toContain("Aqua &lt;House&gt;");
    expect(e.html).not.toContain("<House>");
  });

  it("falls back when the school has no name", () => {
    expect(messages.spotOffered({ school: " ", heldUntil: "", claimUrl: "" }).subject).toBe(
      "A spot has opened at your activity provider",
    );
  });
});
