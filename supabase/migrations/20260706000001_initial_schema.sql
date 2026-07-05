-- 月寒スタディルーム: 初期スキーマ
-- Supabase Dashboard > SQL Editor または `supabase db push` で適用

-- ============================================================
-- ユーザーID採番用シーケンス管理
-- ============================================================
CREATE TABLE IF NOT EXISTS user_id_sequences (
    prefix CHAR(1) NOT NULL CHECK (prefix IN ('1', '9')),
    year_suffix CHAR(2) NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (prefix, year_suffix)
);

-- 6桁 user_id 自動生成（生徒=1xxxxx, 管理者=9xxxxx）
CREATE OR REPLACE FUNCTION generate_user_id(p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix CHAR(1);
    v_year CHAR(2);
    v_seq INTEGER;
BEGIN
    IF p_role IN ('student', 'parent') THEN
        v_prefix := '1';
    ELSIF p_role = 'admin' THEN
        v_prefix := '9';
    ELSE
        RAISE EXCEPTION 'Invalid role for user_id generation: %', p_role;
    END IF;

    v_year := TO_CHAR(CURRENT_DATE, 'YY');

    INSERT INTO user_id_sequences (prefix, year_suffix, last_seq)
    VALUES (v_prefix, v_year, 1)
    ON CONFLICT (prefix, year_suffix)
    DO UPDATE SET last_seq = user_id_sequences.last_seq + 1
    RETURNING last_seq INTO v_seq;

    RETURN v_prefix || v_year || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- ============================================================
-- ① 生徒・ユーザーテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    student_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
    gender VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin', 'parent')),
    linked_student_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
    supabase_auth_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT parent_must_link CHECK (
        (role = 'parent' AND linked_student_id IS NOT NULL)
        OR (role != 'parent' AND linked_student_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);
CREATE INDEX IF NOT EXISTS idx_students_linked ON students(linked_student_id);

-- ============================================================
-- ② ログインセッション
-- ============================================================
CREATE TABLE IF NOT EXISTS login_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('persistent', 'temporary')),
    expires_at TIMESTAMPTZ NOT NULL,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token);
CREATE INDEX IF NOT EXISTS idx_login_sessions_student ON login_sessions(student_id);

-- ============================================================
-- ③ 座席
-- ============================================================
CREATE TABLE IF NOT EXISTS seats (
    seat_id SERIAL PRIMARY KEY,
    seat_name VARCHAR(50) NOT NULL UNIQUE,
    qr_code_data VARCHAR(500) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ④ 出席
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(seat_id),
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    is_forgotten_checkout BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_active ON attendance(student_id) WHERE check_out_time IS NULL;

-- ============================================================
-- ⑤ 日次学習記録
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_study_records (
    record_id SERIAL PRIMARY KEY,
    attendance_id INTEGER REFERENCES attendance(attendance_id) ON DELETE SET NULL,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL,
    topic_unit VARCHAR(200) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_study_student ON daily_study_records(student_id);

-- ============================================================
-- ⑥ 志望校履歴
-- ============================================================
CREATE TABLE IF NOT EXISTS aspiration_school_history (
    aspiration_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    target_school VARCHAR(200) NOT NULL,
    priority_rank INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- ⑦ 模試結果
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_results (
    exam_result_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    exam_name VARCHAR(200) NOT NULL,
    exam_date DATE NOT NULL,
    subject_scores JSONB NOT NULL DEFAULT '{}',
    total_score INTEGER NOT NULL DEFAULT 0,
    school_judgment VARCHAR(10)
);

-- ============================================================
-- ⑧ 学習計画
-- ============================================================
CREATE TABLE IF NOT EXISTS study_plans (
    plan_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL,
    unit VARCHAR(200) NOT NULL,
    target_completion_date DATE NOT NULL
);

-- ============================================================
-- ⑨ 進捗記録
-- ============================================================
CREATE TABLE IF NOT EXISTS progress_tracking (
    progress_id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES study_plans(plan_id) ON DELETE CASCADE,
    completion_date DATE,
    achievement_level VARCHAR(50)
);

-- ============================================================
-- ⑩ 通知
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trigger_gap_detected BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(student_id);

-- ============================================================
-- 0:00 退室忘れ自動処理
-- ============================================================
CREATE OR REPLACE FUNCTION process_forgotten_checkouts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected INTEGER;
    midnight TIMESTAMPTZ;
BEGIN
    midnight := DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo';

    UPDATE attendance
    SET
        check_out_time = midnight,
        is_forgotten_checkout = TRUE
    WHERE check_out_time IS NULL
      AND check_in_time < midnight;

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

-- 乖離検知通知（学習計画 vs 進捗）
CREATE OR REPLACE FUNCTION detect_study_plan_gaps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted INTEGER := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT sp.student_id, sp.subject, sp.unit, sp.target_completion_date
        FROM study_plans sp
        LEFT JOIN progress_tracking pt ON pt.plan_id = sp.plan_id AND pt.completion_date IS NOT NULL
        WHERE pt.progress_id IS NULL
          AND sp.target_completion_date < CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.student_id = sp.student_id
                AND n.notification_type = 'plan_gap'
                AND n.content LIKE '%' || sp.subject || '%'
                AND n.sent_at > NOW() - INTERVAL '7 days'
          )
    LOOP
        INSERT INTO notifications (student_id, notification_type, content, trigger_gap_detected)
        VALUES (
            rec.student_id,
            'plan_gap',
            format('「%s %s」の目標期限（%s）を過ぎています。進捗を確認しましょう。', rec.subject, rec.unit, rec.target_completion_date),
            TRUE
        );
        inserted := inserted + 1;
    END LOOP;
    RETURN inserted;
END;
$$;
