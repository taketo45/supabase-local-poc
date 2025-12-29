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
  const sup);
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
    console.log(`  ✅ Storage accessible. Buckets: ${data.ma // Test 3: Auth 接続テスト
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
