// Notice → Ask → Remember.
//
// This is the loop the product is actually for: the archive notices a
// pattern, asks the one question only this family could be asked, and keeps
// the answer where the noticing can find it again. The first two steps have
// been built for a while. The third was not closed — an answer lived on the
// question row, was read once by the book generator, and was invisible to
// everything else.
//
// These are structural tests over the source rather than behavioural ones,
// because the failure is an *absence*: nothing throws when an answer fails
// to become a memory. It just quietly is not there next year.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const actions = read("src/app/actions.ts");
const answerFn = actions.slice(
  actions.indexOf("export async function answerQuestion"),
  actions.indexOf("// ------------------------------------------------------------------ book")
);

describe("an answer becomes a memory", () => {
  it("is written into the archive, not only onto the question", () => {
    // Written through keepMemory(), which is now the only thing that inserts
    // a memory — every capture path shares it so that none of them can
    // forget the archive it belongs to.
    expect(answerFn).toMatch(/keepMemory\(/);
  });

  it("keeps the question with it", () => {
    // "Bun Bun" is not a memory. "Does the rabbit have a name?" / "Bun Bun,
    // he came from Nana and he goes everywhere" is.
    expect(answerFn).toContain("from_question_id");
    expect(answerFn).toMatch(/question: question\?\.question/);
  });

  it("goes through the same moderation rule as anything else added", () => {
    // A grandparent answering a question is contributing, and contributions
    // wait for the parent. The answer path must not be a way around that.
    expect(answerFn).toContain("statusForNewMemory(membership.role)");
  });

  it("gets analysed, so the next round of noticing can see it", () => {
    expect(answerFn).toContain('"analyse_memories"');
  });

  it("does not create a second memory when an answer is edited", () => {
    expect(answerFn).toContain("answer_memory_id");
    expect(answerFn).toMatch(/if \(question\?\.answer_memory_id\)/);
  });
});

describe("the book does not print it twice", () => {
  it("excludes answer-derived memories from the memory list it drafts from", () => {
    // They reach the book separately, as `answers`. Without the filter the
    // same sentence is handed to the drafting twice and can appear on two
    // pages as though it were said on two occasions.
    const handlers = read("src/lib/jobs/handlers.ts");
    const generate = handlers.slice(handlers.indexOf("async function generateBook"));
    expect(generate).toMatch(/from_question_id/);
    expect(generate).toContain("answers: answers ?? []");
  });
});

describe("the export really is everything", () => {
  it("includes the questions and the answers they wrote", () => {
    // The export promises "everything your family kept". These are the
    // sentences a parent sat and composed because we asked.
    const exportSrc = read("src/lib/privacy/export.ts");
    expect(exportSrc).toContain("questions-we-asked.txt");
    expect(exportSrc).toContain('from("follow_up_questions")');
  });
});
