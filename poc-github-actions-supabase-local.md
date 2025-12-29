# POC検証手順: GitHub Actions + Supabase Local

## 概要

Zenn記事に記載したGitHub Actionsワークフローが実際に動作するか、検証用リポジトリを使って確認する手順です。

## 検証目的

調査レポートで挙げられた以下の項目を実際に確認します：

### 優先度 🔴 高

1. `pnpm/action-setup@v2` でNode 20で問題が発生するか
2. `supabase start` の実行時間を実測（5分超過するか）
3. `supabase db reset` がCI環境で確実に機能するか
4. ubuntu-latestランナーでの完全なテスト実行

### 優先度 🟡 中

5. タイムアウト値の最適化
6. `supabase db start` vs `supabase start` の検証

---

## Step 1: 検証用リポジトリの作成

### 1.1 GitHubで新規リポジトリを作成

1. GitHub (https://github.com) にログイン
2. 右上の「+」→「New repository」をクリック
3. 以下の設定で作成：
   - Repository name: `supabase-local-poc`
   - Description: `POC: GitHub Actions with Supabase Local`
   - Visibility: Private（または Public）
   - ✅ Add a README file
   - ✅ Add .gitignore → Node を選択
4. 「Create repository」をクリック

### 1.2 リポジトリをローカルにクローン

```bash
git clone https://github.com/<your-username>/supabase-local-poc.git
cd supabase-local-poc
```

---

## Step 2: 最小限のプロジェクト構成を作成

### 2.1 package.json を作成

```bash
cat > package.json << 'EOF'
{
  "name": "supabase-local-poc",
  "version": "1.0.0",
  "description": "POC: GitHub Actions with Supabase Local",
  "scripts": {
    "test": "node test.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@9.15.0"
}
EOF
```

### 2.2 シンプルなテストファイルを作成

```bash
cat > test.js << 'EOF'
/**
 * Supabase Local 接続テスト
 * 環境変数から接続情報を取得し、データベースに接続できるか確認
 */

const { createClient } = require('@supabase/supabase-js');

async function runTests() {
  console.log('🧪 Starting Supabase Local connection tests...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // 環境変数チェック
  console.log('📋 Environment Variables:');
  console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Not set'}`);
  console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Not set'}`);
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log('');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Required environment variables are not set');
    process.exit(1);
  }
  
  // Supabase クライアント作成
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Test 1: 接続テスト
  console.log('Test 1: Supabase connection...');
  try {
    const { data, error } = await supabase.from('_dummy_').select('*').limit(1);
    // テーブルが存在しなくてもエラーにならない（接続は成功）
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('  ✅ Successfully connected to Supabase\n');
  } catch (error) {
    // 接続自体が失敗した場合
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('  ❌ Failed to connect to Supabase');
      console.error(`  Error: ${error.message}\n`);
      process.exit(1);
    }
    // テーブルが無いエラーは接続成功とみなす
    console.log('  ✅ Successfully connected to Supabase (table not found is expected)\n');
  }
  
  // Test 2: Storage 接続テスト
  console.log('Test 2: Storage connection...');
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    console.log(`  ✅ Storage accessible. Buckets: ${data.map(b => b.name).join(', ') || '(none)'}\n`);
  } catch (error) {
    console.error(`  ❌ Storage error: ${error.message}\n`);
  }
  
  // Test 3: Auth 接続テスト
  console.log('Test 3: Auth connection...');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log('  ✅ Auth service accessible\n');
  } catch (error) {
    console.error(`  ❌ Auth error: ${error.message}\n`);
  }
  
  console.log('🎉 All tests completed!');
}

runTests().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
EOF
```

### 2.3 Supabase 設定ファイルを作成

```bash
# supabase ディレクトリ作成
mkdir -p supabase

# config.toml を作成
cat > supabase/config.toml << 'EOF'
project_id = "poc-test"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 17

[studio]
enabled = true
port = 54323
api_url = "http://127.0.0.1"

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
enable_signup = true
EOF

# seed.sql を作成（空でOK、db resetのテスト用）
cat > supabase/seed.sql << 'EOF'
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
EOF
```

### 2.4 依存関係をインストール

```bash
pnpm init  # 既に package.json があるのでスキップ
pnpm add @supabase/supabase-js
```

---

## Step 3: GitHub Actions ワークフローを作成

### 3.1 検証ケースA: 記事のオリジナルコード（v2 使用）

```bash
mkdir -p .github/workflows

cat > .github/workflows/test-original.yml << 'EOF'
# ケースA: 記事のオリジナルコード（pnpm v2）
# 目的: v2 が Node 20 で本当に動作するか確認

name: "Case A: Original (pnpm v2)"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:  # 手動実行可能

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      # ⚠️ v2 を使用（非推奨だが動作するか確認）
      - name: Install pnpm (v2 - deprecated)
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: "[TIMING] Start Supabase Local"
        id: supabase-start
        run: |
          echo "start_time=$(date +%s)" >> $GITHUB_OUTPUT
          supabase start
          echo "end_time=$(date +%s)" >> $GITHUB_OUTPUT
      
      - name: "[TIMING] Calculate Supabase start time"
        run: |
          start=${{ steps.supabase-start.outputs.start_time }}
          end=${{ steps.supabase-start.outputs.end_time }}
          duration=$((end - start))
          echo "⏱️ supabase start took ${duration} seconds"
          echo "## ⏱️ Timing Results" >> $GITHUB_STEP_SUMMARY
          echo "- \`supabase start\`: **${duration} seconds**" >> $GITHUB_STEP_SUMMARY
      
      - name: Reset Database
        run: supabase db reset
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      
      - name: Summary
        run: |
          echo "## ✅ Case A: Original (pnpm v2) - Completed" >> $GITHUB_STEP_SUMMARY
          echo "- pnpm version: $(pnpm --version)" >> $GITHUB_STEP_SUMMARY
          echo "- Node version: $(node --version)" >> $GITHUB_STEP_SUMMARY
          echo "- Supabase CLI version: $(supabase --version)" >> $GITHUB_STEP_SUMMARY
EOF
```

### 3.2 検証ケースB: 推奨コード（v4 + timeout）

```bash
cat > .github/workflows/test-recommended.yml << 'EOF'
# ケースB: 推奨コード（pnpm v4 + timeout）
# 目的: 修正後のコードが問題なく動作するか確認

name: "Case B: Recommended (pnpm v4)"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'  # キャッシュ有効化
      
      # ✅ v4 を使用（推奨）
      - name: Install pnpm (v4 - recommended)
        uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: "[TIMING] Start Supabase Local"
        id: supabase-start
        run: |
          echo "start_time=$(date +%s)" >> $GITHUB_OUTPUT
          supabase start
          echo "end_time=$(date +%s)" >> $GITHUB_OUTPUT
        timeout-minutes: 10  # ✅ タイムアウト追加
      
      - name: "[TIMING] Calculate Supabase start time"
        run: |
          start=${{ steps.supabase-start.outputs.start_time }}
          end=${{ steps.supabase-start.outputs.end_time }}
          duration=$((end - start))
          echo "⏱️ supabase start took ${duration} seconds"
          echo "## ⏱️ Timing Results" >> $GITHUB_STEP_SUMMARY
          echo "- \`supabase start\`: **${duration} seconds**" >> $GITHUB_STEP_SUMMARY
      
      - name: Reset Database
        run: supabase db reset
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      
      - name: Summary
        run: |
          echo "## ✅ Case B: Recommended (pnpm v4) - Completed" >> $GITHUB_STEP_SUMMARY
          echo "- pnpm version: $(pnpm --version)" >> $GITHUB_STEP_SUMMARY
          echo "- Node version: $(node --version)" >> $GITHUB_STEP_SUMMARY
          echo "- Supabase CLI version: $(supabase --version)" >> $GITHUB_STEP_SUMMARY
EOF
```

### 3.3 検証ケースC: supabase db start vs supabase start

```bash
cat > .github/workflows/test-db-start.yml << 'EOF'
# ケースC: supabase db start の検証
# 目的: db start が start より高速か確認

name: "Case C: DB Start Only"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test-db-start:
    name: "Using supabase db start"
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: "[TIMING] Start Supabase DB Only"
        id: db-start
        run: |
          echo "start_time=$(date +%s)" >> $GITHUB_OUTPUT
          supabase db start
          echo "end_time=$(date +%s)" >> $GITHUB_OUTPUT
        timeout-minutes: 5
      
      - name: "[TIMING] Calculate DB start time"
        run: |
          start=${{ steps.db-start.outputs.start_time }}
          end=${{ steps.db-start.outputs.end_time }}
          duration=$((end - start))
          echo "⏱️ supabase db start took ${duration} seconds"
          echo "## ⏱️ Timing Results (DB Only)" >> $GITHUB_STEP_SUMMARY
          echo "- \`supabase db start\`: **${duration} seconds**" >> $GITHUB_STEP_SUMMARY

  test-full-start:
    name: "Using supabase start (full)"
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: "[TIMING] Start Supabase Full"
        id: full-start
        run: |
          echo "start_time=$(date +%s)" >> $GITHUB_OUTPUT
          supabase start
          echo "end_time=$(date +%s)" >> $GITHUB_OUTPUT
        timeout-minutes: 10
      
      - name: "[TIMING] Calculate Full start time"
        run: |
          start=${{ steps.full-start.outputs.start_time }}
          end=${{ steps.full-start.outputs.end_time }}
          duration=$((end - start))
          echo "⏱️ supabase start took ${duration} seconds"
          echo "## ⏱️ Timing Results (Full)" >> $GITHUB_STEP_SUMMARY
          echo "- \`supabase start\`: **${duration} seconds**" >> $GITHUB_STEP_SUMMARY
EOF
```

---

## Step 4: リポジトリにプッシュ

```bash
# 変更をステージング
git add .

# コミット
git commit -m "feat: Add POC for GitHub Actions + Supabase Local"

git commit -m "modified: feat: Add POC for GitHub Actions + Supabase Local"

git commit -m "modified2: feat: Add POC for GitHub Actions + Supabase Local"

# プッシュ
git push origin main
```

---

## Step 5: GitHub Actions の実行を確認

### 5.1 Actions タブで確認

1. GitHub リポジトリの「Actions」タブを開く
2. 3つのワークフローが実行されていることを確認：
   - `Case A: Original (pnpm v2)`
   - `Case B: Recommended (pnpm v4)`
   - `Case C: DB Start Only`

### 5.2 手動で実行する場合

1. Actions タブで対象のワークフローを選択
2. 「Run workflow」ボタンをクリック
3. ブランチを選択して実行

---

## Step 6: 検証結果の確認

### 6.1 確認ポイント

各ワークフローの実行結果で以下を確認します：

| 確認項目 | 確認場所 | 期待値 |
|---------|---------|--------|
| pnpm v2 が動作するか | Case A の結果 | ✅ 成功 または ⚠️ 警告付き成功 |
| pnpm v4 が動作するか | Case B の結果 | ✅ 成功 |
| supabase start の実行時間 | Summary の Timing Results | 5分以上かかるか |
| supabase db start の実行時間 | Case C の結果 | start より短いか |
| supabase db reset が成功するか | 各ケースの Reset Database ステップ | ✅ 成功 |
| テストが通るか | Run tests ステップ | ✅ 成功 |

### 6.2 Summary の確認

各ワークフロー実行後、「Summary」タブで以下の情報を確認：

- 実行時間（⏱️ Timing Results）
- 各ツールのバージョン
- 成功/失敗のステータス

---

## Step 7: 検証結果のレポート作成

以下のテンプレートを使って結果をまとめます：

```markdown
# GitHub Actions + Supabase Local POC 検証結果

## 検証日時
- 実施日: YYYY-MM-DD
- 実施者: @username

## 検証環境
- GitHub Actions Runner: ubuntu-latest
- Node.js: 20.x
- pnpm: 9.x
- Supabase CLI: latest

## 検証結果

### Case A: pnpm v2 の動作確認

| 項目 | 結果 | 備考 |
|-----|------|-----|
| ワークフロー実行 | ✅ / ❌ | |
| pnpm インストール | ✅ / ❌ | 警告メッセージがあれば記載 |
| supabase start | ✅ / ❌ | 実行時間: XX秒 |
| supabase db reset | ✅ / ❌ | |
| テスト実行 | ✅ / ❌ | |

### Case B: pnpm v4 の動作確認

| 項目 | 結果 | 備考 |
|-----|------|-----|
| ワークフロー実行 | ✅ / ❌ | |
| pnpm インストール | ✅ / ❌ | |
| supabase start | ✅ / ❌ | 実行時間: XX秒 |
| supabase db reset | ✅ / ❌ | |
| テスト実行 | ✅ / ❌ | |

### Case C: supabase db start vs supabase start

| コマンド | 実行時間 | 備考 |
|---------|---------|-----|
| supabase db start | XX秒 | |
| supabase start | XX秒 | |
| **差分** | XX秒 | start の方が XX秒長い |

## 結論

### pnpm バージョンについて
- v2: [ ] 問題なく動作 / [ ] 警告あり / [ ] 動作しない
- 推奨: [ ] v2 のまま / [ ] v4 にアップグレード

### supabase start について
- 実行時間: [ ] 5分未満 / [ ] 5分以上
- timeout-minutes: [ ] 不要 / [ ] 5分 / [ ] 10分 を推奨

### 記事への反映
- [ ] pnpm のバージョンを v4 に変更する
- [ ] timeout-minutes を追加する
- [ ] 実行時間についての注意書きを追加する
- [ ] supabase db start の選択肢を追記する
```

---

## Step 8: 記事の修正

検証結果に基づいて、Zenn記事の GitHub Actions セクションを修正します。

### 修正が必要な場合のチェックリスト

- [ ] `pnpm/action-setup@v2` → `@v4` に変更
- [ ] `timeout-minutes: 10` を追加
- [ ] 実行時間についての注意書きを追加
- [ ] （オプション）`supabase db start` の選択肢を追記

---

## 参考: クリーンアップ

検証が完了したら、リポジトリを削除できます：

```bash
# ローカルリポジトリの削除
cd ..
rm -rf supabase-local-poc

# GitHub上のリポジトリ削除
# Settings → Danger Zone → Delete this repository
```

---

## トラブルシューティング

### ワークフローが実行されない場合

1. `.github/workflows/` ディレクトリの配置を確認
2. YAML の構文エラーをチェック（[YAML Lint](https://www.yamllint.com/) を使用）
3. リポジトリの「Actions」設定で無効化されていないか確認

### supabase start が失敗する場合

考えられる原因：
- Docker のリソース不足
- ネットワークの問題（Docker イメージのダウンロード失敗）
- タイムアウト

対処法：
- `timeout-minutes` を増やして再実行
- ログを確認してエラー内容を特定

### テストが失敗する場合

1. Supabase が正常に起動しているか確認
2. 環境変数が正しく設定されているか確認
3. ローカルで同じ手順を実行して問題を特定

