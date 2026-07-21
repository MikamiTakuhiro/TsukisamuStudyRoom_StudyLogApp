-- 座席予約テーブル
CREATE TABLE IF NOT EXISTS seat_reservations (
    reservation_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT seat_reservations_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_seat_reservations_student ON seat_reservations(student_id);
CREATE INDEX IF NOT EXISTS idx_seat_reservations_start ON seat_reservations(start_time);
CREATE INDEX IF NOT EXISTS idx_seat_reservations_end ON seat_reservations(end_time);
