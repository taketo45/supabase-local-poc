-- POC テスト用シードデータ
-- このファイルは supabase db reset で自動適用される
-- ※テーブル作成は migrations/ フォルダで行う

-- テストデータ挿入
INSERT INTO poc_test (name) VALUES 
  ('Test Item 1'),
  ('Test Item 2'),
  ('Test Item 3');

-- 結果確認用
SELECT 'Seed data applied successfully!' as status;
