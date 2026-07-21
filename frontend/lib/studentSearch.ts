import type { User } from "@/lib/api";

function toHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export function normalizeStudentSearchText(text: string): string {
  return toHiragana(text.normalize("NFKC").trim().toLowerCase());
}

function studentSearchHaystack(student: User): string {
  return normalizeStudentSearchText(
    [student.name, student.user_id, String(student.student_id)].join(" "),
  );
}

export function matchesStudentSearch(student: User, query: string): boolean {
  const normalizedQuery = normalizeStudentSearchText(query);
  if (!normalizedQuery) return true;
  return studentSearchHaystack(student).includes(normalizedQuery);
}

export function filterStudentsBySearch(students: User[], query: string): User[] {
  return students.filter((student) => matchesStudentSearch(student, query));
}
