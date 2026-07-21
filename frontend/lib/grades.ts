export const GRADE_OPTIONS = [
  { label: "小学1年", value: 1 },
  { label: "小学2年", value: 2 },
  { label: "小学3年", value: 3 },
  { label: "小学4年", value: 4 },
  { label: "小学5年", value: 5 },
  { label: "小学6年", value: 6 },
  { label: "中学1年", value: 7 },
  { label: "中学2年", value: 8 },
  { label: "中学3年", value: 9 },
  { label: "高校1年", value: 10 },
  { label: "高校2年", value: 11 },
  { label: "高校3年", value: 12 },
];

export function gradeLabel(value: number): string {
  return GRADE_OPTIONS.find((g) => g.value === value)?.label ?? `${value}年`;
}
