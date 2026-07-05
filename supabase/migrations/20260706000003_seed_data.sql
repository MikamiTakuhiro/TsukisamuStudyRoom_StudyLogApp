-- 開発・テスト用シード（本番では管理者登録APIを使用）
-- パスワードはすべて "password123" （bcrypt hash はアプリ側 seed スクリプトで生成推奨）
-- ここでは座席のみ投入

INSERT INTO seats (seat_name, qr_code_data) VALUES
    ('A-1', 'seat:A-1'),
    ('A-2', 'seat:A-2'),
    ('B-1', 'seat:B-1'),
    ('窓側1', 'seat:窓側1'),
    ('窓側2', 'seat:窓側2')
ON CONFLICT (seat_name) DO NOTHING;
