-- seat_reservations に RLS を有効化（Supabase Data API 経由の公開読み取りを防ぐ）
ALTER TABLE seat_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seat_reservations" ON seat_reservations;
CREATE POLICY "service_role_full_access_seat_reservations"
    ON seat_reservations FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
