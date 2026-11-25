// 管理画面の生徒個別ページへのパス。
// 静的書き出し（output: "export"）では /admin/students/[id] のような
// 実行時に決まる動的ルートを使えないため、生徒 ID はクエリ文字列で渡す。

/** 生徒の詳細（編集）ページ */
export function adminStudentPath(studentId: number): string {
  return `/admin/students/detail/?id=${studentId}`;
}

/** 生徒の分析ページ */
export function adminStudentAnalyticsPath(studentId: number): string {
  return `/admin/analytics/students/detail/?id=${studentId}`;
}
