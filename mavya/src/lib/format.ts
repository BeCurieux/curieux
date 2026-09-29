// Plain-language dates and times, always in the location's timezone.

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ISO weekday: 1 = Monday … 7 = Sunday.
export function dayName(weekday: number): string {
  return DAY_NAMES[weekday - 1] ?? "";
}

export function shortDay(weekday: number): string {
  return dayName(weekday).slice(0, 3);
}

// "16:30" or "16:30:00" → "4:30pm".
export function formatTime(time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

// "Wed 30 Sep", in the given timezone.
export function formatLessonDate(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Built from parts so it reads "Tue 29 Sep" whatever the ICU version's
  // punctuation or month abbreviation ("Sept").
  return `${part("weekday").slice(0, 3)} ${part("day")} ${part("month").slice(0, 3)}`;
}

export function formatDateTime(iso: string, timeZone = "Australia/Sydney"): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function ageOn(dateOfBirth: string, today = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
