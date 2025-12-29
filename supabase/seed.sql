-- POC テスト用シードデータ
-- このファイルは supabase db reset で自動適用される

-- テスト用テーブル作成
CREATE TABLE IF NOT EXISTS poc_test (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- テストデータ挿入
INSERT INTO poc_test (name) VALUES 
  ('Test Item 1'),
  ('Test Item 2'),
  ('Test Item 3');

-- 結果確認用
SELECT 'Seed data applied successfully!' as status;
