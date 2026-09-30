import { describe, expect, it } from "vitest";
import {
  parseCsv,
  readClasses,
  readDate,
  readStudents,
  readTime,
  readWeekday,
} from "@/lib/domain/imports";

describe("reading CSV", () => {
  it("handles quotes, commas in quotes, CRLF, a byte order mark and blank lines", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", "2"],
    ]);
  });
});

describe("reading values the way schools write them", () => {
  it("reads days", () => {
    expect(readWeekday("Wednesday")).toBe(3);
    expect(readWeekday("sat")).toBe(6);
    expect(readWeekday("7")).toBe(7);
    expect(readWeekday("Funday")).toBeNull();
  });

  it("reads times", () => {
    expect(readTime("4:30pm")).toBe("16:30");
    expect(readTime("4.30 PM")).toBe("16:30");
    expect(readTime("16:30")).toBe("16:30");
    expect(readTime("9am")).toBe("09:00");
    expect(readTime("12:15am")).toBe("00:15");
    expect(readTime("0930")).toBe("09:30");
    expect(readTime("16:30:00")).toBe("16:30");
    expect(readTime("25:00")).toBeNull();
    expect(readTime("13pm")).toBeNull();
  });

  it("reads Australian dates and refuses impossible ones", () => {
    expect(readDate("14/03/2019")).toBe("2019-03-14");
    expect(readDate("1-2-2020")).toBe("2020-02-01");
    expect(readDate("2019-03-14")).toBe("2019-03-14");
    expect(readDate("14/03/19")).toBe("2019-03-14");
    expect(readDate("31/02/2019")).toBeNull();
    expect(readDate("03/14/2019")).toBeNull();
    expect(readDate("soon")).toBeNull();
  });
});

describe("the classes file", () => {
  it("reads forgiving column names, and an end time instead of a duration", () => {
    const { rows, problems } = readClasses(
      "Class Name,Level,Venue,Day,Start,End,Places,Teacher Email\n" +
        "Dolphin 3,Dolphin 3,Mona Vale,Wed,4:30pm,5:00pm,4,MIA@School.test\n",
    );
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      {
        row: 2,
        name: "Dolphin 3",
        level: "Dolphin 3",
        program: null,
        location: "Mona Vale",
        weekday: 3,
        start_time: "16:30",
        duration_minutes: 30,
        capacity: 4,
        instructor_email: "mia@school.test",
      },
    ]);
  });

  it("names each row it can't read, and keeps the rest", () => {
    const { rows, problems } = readClasses(
      "Class,Level,Location,Day,Start time,Duration,Capacity\n" +
        "A,L,P,Mon,4pm,30,4\n" +
        "B,L,P,Funday,4pm,30,4\n" +
        "C,L,P,Mon,later,30,4\n" +
        "D,L,P,Mon,4pm,30,0\n",
    );
    expect(rows.map((r) => r.name)).toEqual(["A"]);
    expect(problems.map((p) => p.row)).toEqual([3, 4, 5]);
    expect(problems[0]!.message).toBe('"Funday" isn\'t a day of the week.');
  });

  it("says which columns are missing", () => {
    expect(readClasses("Class,Day\nA,Mon\n").problems[0]!.message).toBe(
      "The classes file needs these columns: Level, Location, Start time, Duration (or End time), Capacity.",
    );
  });
});

describe("the students file", () => {
  it("reads a child with their parent and class", () => {
    const { rows, problems } = readStudents(
      "First name,Surname,DOB,Parent,Email,Mobile,Class,Class day,Class time\n" +
        "Ava,Burrows,14/03/2019,Sarah Burrows,Sarah@Example.com,0412 345 678,Dolphin 3,Wednesday,4:30pm\n",
    );
    expect(problems).toEqual([]);
    expect(rows[0]).toEqual({
      row: 2,
      first_name: "Ava",
      last_name: "Burrows",
      date_of_birth: "2019-03-14",
      parent_name: "Sarah Burrows",
      parent_email: "sarah@example.com",
      parent_phone: "0412 345 678",
      class: "Dolphin 3",
      class_weekday: 3,
      class_time: "16:30",
    });
  });

  it("refuses bad dates and emails with the row number", () => {
    const { rows, problems } = readStudents(
      "First name,Last name,Date of birth,Email\n" +
        "Ava,B,31/02/2019,a@b.co\n" +
        "Leo,B,01/02/2019,not-an-email\n" +
        "Mia,B,01/02/2019,\n",
    );
    expect(rows.map((r) => r.first_name)).toEqual(["Mia"]);
    expect(problems).toEqual([
      {
        file: "students",
        row: 2,
        message: '"31/02/2019" isn\'t a date of birth, like 31/12/2019.',
      },
      { file: "students", row: 3, message: '"not-an-email" isn\'t an email address.' },
    ]);
  });
});
