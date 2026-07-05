# 月寒スタディルーム — 入退塾管理・学習記録 Web アプリ

自由な座席配置で自立学習を行う塾向けの、**入退塾管理・学習記録**システムです。

## 構成

| レイヤ | 技術 |
|--------|------|
| フロントエンド | Next.js 16 + TypeScript + Tailwind CSS |
| バックエンド | FastAPI (Python) |
| データベース | Supabase (PostgreSQL) |
| 認証 | カスタムセッション + Supabase Auth 連携（任意） |

```
TsukisamuStudyRoom_StudyLogApp/
├── frontend/          # Next.js アプリ
├── backend/           # FastAPI API
└── supabase/
    └── migrations/    # DB マイグレーション SQL
```

---

## 前提条件

以下がインストールされていること：

- **Node.js** 18 以上（`node -v`）
- **Python** 3.11 以上（`python3 --version`）
- **Supabase CLI**（ローカル DB 用・推奨）  
  ```bash
  brew install supabase/tap/supabase
  ```

---

## 1. データベース（Supabase）のセットアップ

### 方法 A: ローカル Supabase（開発推奨）

```bash
cd /Users/mikamitakuhiroshi/TsukisamuStudyRoom_StudyLogApp

# Supabase ローカル環境を起動（Docker が必要）
supabase start

# マイグレーションを適用
supabase db reset
```

ローカル DB の接続情報（デフォルト）:

```
postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres
```

Supabase Studio: http://127.0.0.1:54323

### 方法 B: クラウド Supabase（本番・テスト運用）

1. [Supabase](https://supabase.com) で無料プロジェクトを作成
2. **SQL Editor** で `supabase/migrations/` 内の SQL を **順番に** 実行  
   または `supabase link` 後に `supabase db push`
3. Dashboard → Settings → Database から接続文字列を取得
4. `backend/.env` の `DATABASE_URL` を設定（`postgresql://` → `postgresql+asyncpg://` に変更）

```env
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 2. バックエンドの起動

```bash
cd backend

# 初回のみ: 仮想環境と依存関係
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 環境変数（.env.example をコピーして編集）
cp .env.example .env

# 開発サーバー起動
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

動作確認:

- http://localhost:8000/health → `{"status":"ok"}`
- http://localhost:8000/docs → API ドキュメント（Swagger）

### 初回デモデータ

管理者が未作成の場合、API でデモ管理者を作成できます：

```bash
curl -X POST http://localhost:8000/api/admin/seed/demo
```

返却される `user_id`（例: `926001`）と `initial_password` でログインしてください。

---

## 3. フロントエンドの起動

```bash
cd frontend

# 初回のみ
npm install

# 環境変数
echo 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8000' > .env.local

# 開発サーバー
npm run dev
```

ブラウザで http://localhost:3000 を開く → ログイン画面が表示されます。

### 本番ビルド

```bash
npm run build
npm run start
```

---

## 4. 使い方（ロール別）

### 管理者（user_id が `9` で始まる）

1. ログイン → 自動的に **管理画面** (`/admin`) へ
2. **生徒新規登録**: 氏名・学年・性別を入力 → `user_id` と初期パスワードが自動発行
3. **保護者アカウント**も同時作成（`{生徒ID}-p`、同じ初期パスワード）
4. **座席・QR管理**: 座席名を登録 → QR コードを画面表示・ダウンロード
5. **リアルタイム出席状況**: 現在どの席に誰がいるか確認
6. **0:00退室処理 / 乖離通知**: 管理画面のボタンで手動実行（本番は cron 推奨）

### 生徒（user_id が `1` で始まる 6 桁）

1. **個人スマホ**でログイン → 「個人スマホ（自動ログイン）」を選択  
   → 次回以降 ID 入力不要（localStorage にセッション保存）
2. **ダッシュボード**:
   - 上部 **QRコードで入退室** → カメラで座席 QR を読み取り
   - タイムラインで過去の来塾履歴を確認（タップで詳細）
   - 右下 **+** ボタンで科目・単元を記録
3. **塾の共有 PC** では「塾の共有PC」を選択 → ブラウザを閉じるとログアウト

### 保護者（user_id = `{生徒ID}-p`）

- 生徒と同じ画面だが **閲覧専用**
- カメラボタン・学習記録ボタンは非表示
- 子どもの出席・学習・模試結果を閲覧

---

## 5. ユーザー ID 自動採番ルール

| 区分 | 形式 | 例 |
|------|------|-----|
| 生徒 | `1` + 年度下2桁 + 連番3桁 | `126001`, `126002` |
| 管理者 | `9` + 年度下2桁 + 連番3桁 | `926001` |
| 保護者 | `{生徒ID}-p` | `126001-p` |

採番は PostgreSQL 関数 `generate_user_id(role)` で自動実行されます。

---

## 6. 同じ Wi-Fi 内のスマホからアクセス

スマホ実機で QR カメラを試す場合：

### 6-1. Mac の IP アドレスを確認

```bash
ipconfig getifaddr en0
# 例: 192.168.1.10
```

### 6-2. フロントを LAN 公開

```bash
cd frontend
npm run dev -- -H 0.0.0.0
```

スマホブラウザ: `http://192.168.1.10:3000`

### 6-3. バックエンドも LAN から叩けるように

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`frontend/.env.local` を一時的に変更:

```env
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.10:8000
```

`backend/.env` の CORS にスマホからのアクセス元を追加:

```env
CORS_ORIGINS=http://localhost:3000,http://192.168.1.10:3000
```

### 6-4. QR カメラについて（重要）

ブラウザのカメラ API は **HTTPS または localhost** が必要です。  
LAN IP（`http://192.168.x.x`）だけではカメラが使えない端末があります。

**対処法（開発時）:**

```bash
# ngrok 等で HTTPS トンネルを張る
ngrok http 3000
```

表示された `https://xxxx.ngrok.io` をスマホで開いてください。

---

## 7. 退室忘れの自動処理（0:00）

PostgreSQL 関数 `process_forgotten_checkouts()` が、退室未記録の出席を 0:00 退室として処理します。

**本番運用**: Supabase の pg_cron または Render Cron で毎日 0:05 JST に以下を実行:

```sql
SELECT process_forgotten_checkouts();
SELECT detect_study_plan_gaps();
```

開発中は管理画面のボタン、または:

```bash
curl -X POST http://localhost:8000/api/admin/cron/forgotten-checkout \
  -H "Authorization: Bearer {管理者トークン}"
```

---

## 8. 認証の仕組み

| ログイン種別 | 保存場所 | 有効期限 |
|-------------|---------|---------|
| 個人スマホ（persistent） | localStorage | 365 日 |
| 共有 PC（temporary） | sessionStorage | 12 時間（ブラウザ終了で実質切断） |

- パスワードは bcrypt でハッシュ化
- セッショントークンは `login_sessions` テーブルで管理
- Supabase Auth 連携（`SUPABASE_SERVICE_ROLE_KEY` 設定時）: ユーザー作成時に Auth ユーザーも同期

---

## 9. デプロイ（無料枠）

| サービス | 用途 |
|---------|------|
| **Vercel** | フロントエンド（`frontend/`） |
| **Render** | バックエンド（`uvicorn app.main:app --host 0.0.0.0 --port $PORT`） |
| **Supabase** | PostgreSQL + Auth |

環境変数は各ホスティングのダッシュボードで設定してください。

---

## 10. トラブルシューティング

| 症状 | 対処 |
|------|------|
| API に接続できない | `NEXT_PUBLIC_API_BASE_URL` と CORS 設定を確認 |
| DB 接続エラー | `supabase start` または `DATABASE_URL` を確認 |
| カメラが起動しない | HTTPS または localhost を使用 |
| ログインできない | `/api/admin/seed/demo` で管理者を作成 |
| マイグレーション失敗 | SQL をファイル順に手動実行 |

---

## API 主要エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/auth/login` | ログイン |
| GET | `/api/auth/me` | 現在のユーザー |
| POST | `/api/attendance/check-in` | 入室 |
| POST | `/api/attendance/check-out` | 退室 |
| GET | `/api/attendance/timeline` | 来塾タイムライン |
| POST | `/api/admin/students` | 生徒登録（管理者） |
| GET | `/api/attendance/live` | リアルタイム席状況（管理者） |

詳細は http://localhost:8000/docs を参照。

---

## ライセンス

塾内利用を想定したプロジェクトです。
