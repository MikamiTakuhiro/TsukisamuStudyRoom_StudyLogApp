import { isElementaryGrade } from "@/lib/reading";

const JUNIOR_SUBJECTS = ["数学", "英語", "国語", "理科", "社会", "その他"] as const;
const ELEMENTARY_SUBJECTS = ["算数", "英語", "国語", "理科", "社会", "その他"] as const;

const JUNIOR_EXAM_SUBJECTS = ["国語", "数学", "英語", "理科", "社会"] as const;
const ELEMENTARY_EXAM_SUBJECTS = ["国語", "算数", "英語", "理科", "社会"] as const;

const JUNIOR_STUDY_OPTIONS: Record<string, string[]> = {
  数学: ["方程式", "関数", "図形", "確率", "その他"],
  英語: ["文法", "長文", "単語", "リスニング", "その他"],
  国語: ["現代文", "古文", "漢文", "作文", "その他"],
  理科: ["物理", "化学", "生物", "地学", "その他"],
  社会: ["地理", "歴史", "公民", "その他"],
  その他: ["自主学習", "予習", "復習"],
};

const ELEMENTARY_STUDY_OPTIONS: Record<string, string[]> = {
  算数: ["計算", "図形", "文章題", "単位", "その他"],
  英語: ["単語", "文法", "読み", "リスニング", "その他"],
  国語: ["漢字", "読み物", "作文", "文法", "その他"],
  理科: ["植物", "動物", "実験", "天体", "その他"],
  社会: ["地理", "歴史", "公民", "その他"],
  その他: ["自主学習", "予習", "復習"],
};

export function getSubjects(grade: number): readonly string[] {
  return isElementaryGrade(grade) ? ELEMENTARY_SUBJECTS : JUNIOR_SUBJECTS;
}

export function getExamSubjects(grade: number): readonly string[] {
  return isElementaryGrade(grade) ? ELEMENTARY_EXAM_SUBJECTS : JUNIOR_EXAM_SUBJECTS;
}

export function getStudyOptions(grade: number): Record<string, string[]> {
  return isElementaryGrade(grade) ? ELEMENTARY_STUDY_OPTIONS : JUNIOR_STUDY_OPTIONS;
}

/** 表示用: DB上の「数学」を小学生向けに「算数」へ */
export function displaySubject(subject: string, grade: number): string {
  if (isElementaryGrade(grade) && subject === "数学") return "算数";
  return subject;
}

/** 保存用: 小学生が選んだ「算数」をそのまま保存 */
export function storageSubject(subject: string, grade: number): string {
  if (isElementaryGrade(grade) && subject === "算数") return "算数";
  return subject;
}
