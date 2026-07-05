-- Row Level Security（Supabase Data API 経由アクセス時の防御）
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_study_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspiration_school_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_id_sequences ENABLE ROW LEVEL SECURITY;

-- FastAPI（service_role / postgres 接続）からは RLS をバイパス。
-- anon/authenticated ロール向け: 直接 DB API を使う場合の最小ポリシー

CREATE POLICY "service_role_full_access_students"
    ON students FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_read_own_student"
    ON students FOR SELECT
    TO authenticated
    USING (
        supabase_auth_id = auth.uid()
    );

-- その他テーブルも service_role のみフルアクセス（API 経由運用）
CREATE POLICY "service_role_full_access_sessions" ON login_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_seats" ON seats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_attendance" ON attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_daily" ON daily_study_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_aspiration" ON aspiration_school_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_exam" ON exam_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_plans" ON study_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_progress" ON progress_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_notifications" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_sequences" ON user_id_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);
