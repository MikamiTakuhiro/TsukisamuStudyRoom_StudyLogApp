/** 小学1年=1 … 小学6年=6、中学1年=7 … */
export function isElementaryGrade(grade: number): boolean {
  return grade >= 1 && grade <= 6;
}

export function shouldShowFurigana(grade: number): boolean {
  return isElementaryGrade(grade);
}
