import { describe, expect, it } from "vitest";
import { matchColumns, readHeaders, readMoney, splitName } from "@/lib/domain/import-columns";
import { readBalances, readCredits, readStudents } from "@/lib/domain/imports";

// M6h: docs/M6_MIGRATION_PILOT.md. Reading other systems' exports.

describe("matching columns", () => {
  it("reads other systems' column names", () => {
    const headers = [
      "Student Name",
      "Birthday",
      "Primary Guardian Name",
      "Primary Email",
      "Primary Phone Number",
      "Enrolled Class",
    ];
    const { columns, missing } = matchColumns("students", headers);
    expect(missing).toEqual([]);
    expect(columns).toMatchObject({
      full_name: 0,
      date_of_birth: 1,
      parent_name: 2,
      parent_email: 3,
      parent_phone: 4,
      class: 5,
    });
  });

  it("says what's missing, and uses the owner's choice", () => {
    const headers = ["Kid", "Born", "Email"];
    expect(matchColumns("students", headers).missing).toEqual([
      "first_name",
      "last_name",
      "date_of_birth",
    ]);
    const chosen = matchColumns("students", headers, { full_name: "Kid", date_of_birth: "Born" });
    expect(chosen.missing).toEqual([]);
    expect(chosen.columns).toMatchObject({ full_name: 0, date_of_birth: 1, parent_email: 2 });
  });

  it("doesn't read a column the owner chose as something else too", () => {
    const { columns } = matchColumns("students", ["Name", "Email", "Phone"], {
      parent_name: "Name",
    });
    expect(columns.parent_name).toBe(0);
    expect(columns.full_name).toBeNull();
  });

  it("can be told a detail isn't in the file", () => {
    const { columns } = matchColumns("students", ["First name", "Last name", "DOB", "Phone"], {
      parent_phone: "",
    });
    expect(columns.parent_phone).toBeNull();
  });

  it("prefers the first matching column", () => {
    const { columns } = matchColumns("balances", [
      "Guardian 1 Email",
      "Guardian 2 Email",
      "Balance",
    ]);
    expect(columns.parent_email).toBe(0);
  });

  it("reads the header row even from part of a big file", () => {
    expect(readHeaders('"First, name",DOB\r\nAva,1/1/2019\r\nBo')).toEqual(["First, name", "DOB"]);
  });
});

describe("names and money", () => {
  it("splits a full name", () => {
    expect(splitName("Jane Smith")).toEqual({ first: "Jane", last: "Smith" });
    expect(splitName("Smith, Jane")).toEqual({ first: "Jane", last: "Smith" });
    expect(splitName("  Jane  van  Dyke ")).toEqual({ first: "Jane", last: "van Dyke" });
    expect(splitName("Jane")).toEqual({ first: "Jane", last: "" });
  });

  it("reads money as people write it", () => {
    expect(readMoney("$1,234.50")).toBe(123450);
    expect(readMoney("45")).toBe(4500);
    expect(readMoney("-45.00")).toBe(-4500);
    expect(readMoney("(45.00)")).toBe(-4500);
    expect(readMoney("45.00 CR")).toBe(-4500);
    expect(readMoney("45.00 DR")).toBe(4500);
    expect(readMoney("AUD 12.5")).toBe(1250);
    expect(readMoney("-$9.99")).toBe(-999);
    expect(readMoney("")).toBe(0);
    expect(readMoney("twelve")).toBeNull();
    expect(readMoney("1.234")).toBeNull();
  });
});

describe("the students file", () => {
  it("reads one name column", () => {
    const { rows, problems } = readStudents(
      "Student Name,Birthday,Primary Email\nSmith, Jane,1/2/2019,a@b.test\n" +
        '"Smith, Jo",2/2/2020,a@b.test\n',
    );
    // An unquoted comma shifts the row: the date is read as the name's end.
    expect(problems).toHaveLength(1);
    expect(rows).toEqual([
      expect.objectContaining({
        first_name: "Jo",
        last_name: "Smith",
        date_of_birth: "2020-02-02",
      }),
    ]);
  });
});

describe("the balances file", () => {
  const csv =
    "Primary Email,Account Balance,Due Date\n" +
    "a@b.test,$120.00,14/10/2026\n" +
    "c@d.test,(30.00),\n" +
    "e@f.test,0,\n" +
    "g@h.test,lots,\n";

  it("reads owing and in credit, skips zero, names bad rows", () => {
    const { rows, problems } = readBalances(csv);
    expect(rows).toEqual([
      {
        row: 2,
        parent_email: "a@b.test",
        parent_phone: null,
        balance_cents: 12000,
        due_on: "2026-10-14",
      },
      { row: 3, parent_email: "c@d.test", parent_phone: null, balance_cents: -3000, due_on: null },
    ]);
    expect(problems).toEqual([
      { file: "balances", row: 5, message: '"lots" isn\'t an amount of money, like 120.50.' },
    ]);
  });

  it("reads owing the other way round when told", () => {
    const { rows } = readBalances(csv, undefined, true);
    expect(rows.map((r) => r.balance_cents)).toEqual([-12000, 3000]);
  });

  it("takes a credit column away from the balance", () => {
    const { rows } = readBalances("Email,Balance,Credit\na@b.test,100,40\nc@d.test,,25\n");
    expect(rows.map((r) => r.balance_cents)).toEqual([6000, -2500]);
  });

  it("needs a way to find the family", () => {
    expect(readBalances("Balance\n10\n").problems[0]!.message).toBe(
      "The balances file needs a column for: Parent email or Parent phone.",
    );
  });
});

describe("the make-up credits file", () => {
  it("reads each child's credits and expiry", () => {
    const { rows, problems } = readCredits(
      "Student Name,DOB,Makeups Available,Expiry Date\n" +
        "Jane Smith,1/2/2019,2,31/12/2026\n" +
        "Jo Smith,,0,\n" +
        "Al Smith,,many,\n",
    );
    expect(rows).toEqual([
      {
        row: 2,
        parent_email: null,
        parent_phone: null,
        first_name: "Jane",
        last_name: "Smith",
        date_of_birth: "2019-02-01",
        credits: 2,
        expires_on: "2026-12-31",
      },
    ]);
    expect(problems).toEqual([
      { file: "credits", row: 4, message: '"many" isn\'t a number of credits from 0 to 50.' },
    ]);
  });
});
