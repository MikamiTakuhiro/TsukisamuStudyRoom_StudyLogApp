# CLAUDE.md

月寒スタディルーム — 自由席の自立学習塾向け **入退塾管理・学習記録 Web アプリ**。
セットアップ手順・ロール別の使い方の詳細は [README.md](README.md) を参照。

## プロジェクト概要

- 生徒が座席の QR コードをスマホで読み取って入退室し、学習内容・志望校・模試・学習計画を記録する。
- 管理者（塾スタッフ）は生徒登録、座席/QR 管理、リアルタイム出席状況、分析ダッシュボード、来塾予約の管理を行う。
- 保護者は生徒と同じ画面を **閲覧専用** で見る。
- UI・API エラーメッセージ・ドキュメントは日本語。タイムゾーンは日本時間（Asia/Tokyo）。

### ロールと user_id

| ロール | user_id | 備考 |
|--------|---------|------|
| 生徒 | `1` + 年度下2桁 + 連番3桁（例 `126001`） | |
| 管理者 | `9` + 年度下2桁 + 連番3桁（例 `926001`） | ログイン後 `/admin` へ |
| 保護者 | `{生徒ID}-p`（例 `126001-p`） | 閲覧専用（`is_read_only`） |

採番は PostgreSQL 関数 `generate_user_id(role)`。

## 技術スタック

| レイヤ | 技術 |
|--------|------|
| フロントエンド | Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / jsQR（QR 読み取り） |
| バックエンド | FastAPI / SQLAlchemy 2 (async, asyncpg) / Pydantic v2 / APScheduler / bcrypt |
| DB | Supabase (PostgreSQL)。スキーマは `supabase/migrations/` の SQL で管理（Alembic は無い） |
| 認証 | 独自セッショントークン（`login_sessions` テーブル、`Authorization: Bearer`）。Supabase Auth 連携は任意 |

> `frontend/CLAUDE.md` / `frontend/AGENTS.md` に「この Next.js は学習データと異なる破壊的変更がある。`node_modules/next/dist/docs/` を読んでから書く」という指示がある。フロントを触る前に従うこと。

## ディレクトリ構成

```
TsukisamuStudyRoom_StudyLogApp/
├── frontend/              # Next.js アプリ（パスエイリアス @/* = frontend/ 直下）
│   ├── app/               # App Router のページ
│   ├── components/        # 共通コンポーネント（admin/ は管理画面専用、ui/ は汎用部品）
│   ├── context/           # React Context（ReadingContext = ふりがな表示切替）
│   └── lib/               # API クライアント・認証・各種ユーティリティ
├── backend/               # FastAPI
│   ├── app/
│   │   ├── main.py        # アプリ生成・CORS・ルーター登録（全て /api 配下）・スケジューラ起動
│   │   ├── config.py      # pydantic-settings による設定（.env）
│   │   ├── database.py    # async エンジン / セッション / get_db
│   │   ├── deps.py        # 認証依存関数
│   │   ├── timezone_utils.py  # JST 日時ヘルパー
│   │   ├── models/        # SQLAlchemy モデル
│   │   ├── schemas/       # Pydantic スキーマ（__init__.py に集約）
│   │   ├── routers/       # エンドポイント
│   │   └── services/      # ビジネスロジック
│   ├── requirements.txt
│   └── .env.example
└── supabase/
    ├── config.toml
    └── migrations/        # 日付順の SQL マイグレーション（スキーマ・RLS・seed・関数）
```

## バックエンド詳細

### routers（すべて `/api` プレフィックス）

| ファイル | 担当 |
|----------|------|
| `auth.py` | `/auth` ログイン / ログアウト / `me` |
| `attendance.py` | `/attendance` QR スキャン・入退室・タイムライン・学習記録・カレンダー・リアルタイム出席（live） |
| `academic.py` | 志望校（aspirations）・学習計画（study-plans）・進捗（progress）・模試（exams） |
| `reservations.py` | `/reservations` 来塾（座席）予約・空き状況 |
| `admin.py` | `/admin` 生徒/管理者登録、座席 CRUD、通知配信、アカウント出力、`seed/demo`（デモ管理者作成） |
| `notifications.py` | `/notifications` 通知一覧・既読・削除 |
| `profile.py` | `/profile` 自分のプロフィール取得・更新 |

### models（テーブル）

- `student.py`: `Student`（`students`。生徒・管理者・保護者を role で共用）、`LoginSession`
- `attendance.py`: `Seat`、`Attendance`、`DailyStudyRecord`、`SeatReservation`
- `academic.py`: `AspirationSchoolHistory`、`ExamResult`、`StudyPlan`、`ProgressTracking`、`Notification`

### services / 認証まわり

- `services/auth_service.py`: パスワード/トークン生成、`generate_user_id`、ログイン・セッション管理、`process_forgotten_checkouts`（退室忘れ処理）、`detect_study_plan_gaps`（学習計画との乖離検出）、`resolve_effective_student_id`（保護者→紐づく生徒 ID の解決）。
- `services/notification_service.py`: 通知（特に `plan_gap`）の作成・クリア。
- `services/scheduler.py`: APScheduler。**日本時間 0:00** に退室忘れ処理と乖離通知検出を自動実行（同等の処理が SQL 関数としてもマイグレーションにある）。
- `deps.py`: `get_current_user` → `require_admin`（管理者のみ）/ `require_writable`（保護者など読み取り専用ユーザーを弾く）。

## フロントエンド詳細

### app（ページ）

- 認証: `/`（→ `/login` へ redirect）、`/login`
- 生徒/保護者: `/dashboard`（ホーム・タイムライン）、`/scan`（QR 入退室）、`/reservations`、`/study-plans`、`/aspirations`、`/exams`、`/attendance`、`/live`、`/profile`、`/menu`
- 管理者（`/admin` 配下）: `/admin`（生徒登録・座席/QR・出席状況）、`/admin/reservations`（予約カレンダー）、`/admin/students/[id]`、`/admin/profile`、`/admin/analytics/*`（`page`・`students`・`students/[id]`・`attendance`・`study`・`exams`）

### lib（主要ファイル）

- `api.ts`: **全バックエンド API クライアントと型の集約先**（`authApi` / `attendanceApi` / `reservationsApi` / `academicApi` / `adminApi` / `profileApi` / `notificationsApi`）。API ベース URL は `NEXT_PUBLIC_API_BASE_URL`、未設定時は同一ホストの `:8000`。
- `auth.ts`: トークン/ユーザー/デバイス ID の保存（localStorage ＋メモリのフォールバック）。
- `useAuth.ts` / `useRequireAdmin.ts`: 認証必須フック / 管理者以外を `/dashboard` へ戻すフック。
- `adminAnalytics.ts`、`studentHistoryExport.ts`、`studentSearch.ts`、`useAdminProfiles.ts`: 管理者分析・生徒履歴エクスポート・検索。
- `reservationSlots.ts`、`reservationCalendar.ts`、`studentCalendar.ts`: 予約枠/カレンダー計算。
- `aspirations.ts`、`grades.ts`、`subjects.ts`、`reading.ts`、`furiganaDictionary.ts`、`utils.ts`: ドメイン定数・ふりがな。

### components（主要ファイル）

- シェル: `StudentShell.tsx`（生徒/保護者の画面枠・ボトムナビ・`MenuDrawer`）、`AdminShell.tsx`（管理者の画面枠・ナビ）。各ページはこれで包む。
- `AppHeader.tsx`、`MenuNavIcon.tsx`（ナビアイコン）、`FuriganaText.tsx`（`Ft`、ふりがな表示）、`NotificationRow.tsx`、`StudyCalendar.tsx`、`AttendanceRecordsSection.tsx`、`AspirationChart.tsx`
- `admin/`: `AnalyticsCharts.tsx`、`StudentAnalyticsDashboard.tsx`、`StudentAnalyticsTabs.tsx`、`ReservationCalendar.tsx`
- `ui/Input.tsx`: 汎用入力部品

## 開発コマンド

```bash
# DB（Docker 必要）
supabase start && supabase db reset        # ローカル Supabase 起動＋マイグレーション適用

# バックエンド（backend/ で。仮想環境は backend/.venv）
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#   /health, /docs (Swagger)。初回は cp .env.example .env
#   デモ管理者: curl -X POST http://localhost:8000/api/admin/seed/demo

# フロントエンド（frontend/ で）
npm run dev        # http://localhost:3000（LAN 公開は npm run dev -- -H 0.0.0.0）
npm run build
npm run lint
```

- 環境変数: バックエンドは `backend/.env`（`DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `SUPABASE_*`）、フロントは `frontend/.env.local`（`NEXT_PUBLIC_API_BASE_URL`）。どちらも git 管理外。
- 自動テストは未整備（テストディレクトリ・テストランナー設定なし）。

## 注意点

- DB スキーマ変更は `supabase/migrations/` に新しい日付付き SQL を追加する形で行う（SQLAlchemy モデルとは別に手で同期が必要）。
- `.cursor/` と `supabase/snippets/` は Cursor / Supabase のローカル作業用で、アプリ本体とは無関係。
