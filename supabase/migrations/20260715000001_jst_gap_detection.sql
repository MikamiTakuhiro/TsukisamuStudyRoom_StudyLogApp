-- 乖離検知を日本時間の日付基準に修正
CREATE OR REPLACE FUNCTION detect_study_plan_gaps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted INTEGER := 0;
    rec RECORD;
    today_jst DATE;
BEGIN
    today_jst := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;

    FOR rec IN
        SELECT sp.student_id, sp.subject, sp.unit, sp.target_completion_date
        FROM study_plans sp
        LEFT JOIN progress_tracking pt ON pt.plan_id = sp.plan_id AND pt.completion_date IS NOT NULL
        WHERE pt.progress_id IS NULL
          AND sp.target_completion_date < today_jst
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
