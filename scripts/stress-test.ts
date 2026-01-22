/**
 * 投票系统压测脚本
 * 
 * 使用方法:
 *   npx tsx scripts/stress-test.ts [并发数] [总请求数]
 * 
 * 示例:
 *   npx tsx scripts/stress-test.ts 100 1000   # 100并发，共1000个投票
 *   npx tsx scripts/stress-test.ts 500 5000   # 500并发，共5000个投票
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// 加载 .env 文件
config();

// 配置
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const QUESTION_ID = '00000000-0000-0000-0000-000000000011';
const OPTIONS = ['A', 'B', 'C', 'D'];

// 参数解析
const CONCURRENCY = parseInt(process.argv[2] || '100', 10);
const TOTAL_REQUESTS = parseInt(process.argv[3] || '1000', 10);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 请设置环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  console.error('   或在 .env 文件中配置');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 统计数据
interface Stats {
  success: number;
  failed: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  times: number[];
}

const stats: Stats = {
  success: 0,
  failed: 0,
  totalTime: 0,
  minTime: Infinity,
  maxTime: 0,
  times: [],
};

/**
 * 生成随机设备ID
 */
function randomDeviceId(): string {
  return `stress-test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 随机选择选项
 */
function randomOption(): string {
  return OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
}

/**
 * 发送单个投票请求
 */
async function sendVote(index: number): Promise<void> {
  const startTime = performance.now();
  
  try {
    const { error } = await supabase.from('votes').insert({
      question_id: QUESTION_ID,
      option_id: randomOption(),
      device_id: randomDeviceId(),
      timestamp: new Date().toISOString(),
    });

    const elapsed = performance.now() - startTime;
    
    if (error) {
      stats.failed++;
      console.error(`❌ [${index}] 失败: ${error.message}`);
    } else {
      stats.success++;
      stats.totalTime += elapsed;
      stats.minTime = Math.min(stats.minTime, elapsed);
      stats.maxTime = Math.max(stats.maxTime, elapsed);
      stats.times.push(elapsed);
    }
  } catch (err) {
    stats.failed++;
    console.error(`❌ [${index}] 异常: ${err}`);
  }
}

/**
 * 并发控制器
 */
async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  concurrency: number
): Promise<void> {
  const executing: Promise<void>[] = [];
  
  for (const task of tasks) {
    const p = task().then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
}

/**
 * 计算百分位数
 */
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 打印进度
 */
function printProgress(current: number, total: number): void {
  const percent = Math.floor((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
  process.stdout.write(`\r[${bar}] ${percent}% (${current}/${total})`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('');
  console.log('🚀 投票系统压力测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 并发数: ${CONCURRENCY}`);
  console.log(`📊 总请求: ${TOTAL_REQUESTS}`);
  console.log(`📊 目标问题: ${QUESTION_ID}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const startTime = performance.now();
  
  // 创建任务
  let completed = 0;
  const tasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => async () => {
    await sendVote(i);
    completed++;
    if (completed % 50 === 0 || completed === TOTAL_REQUESTS) {
      printProgress(completed, TOTAL_REQUESTS);
    }
  });

  // 执行压测
  await runWithConcurrency(tasks, CONCURRENCY);
  
  const totalElapsed = performance.now() - startTime;
  
  // 打印结果
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 压测结果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功: ${stats.success}`);
  console.log(`❌ 失败: ${stats.failed}`);
  console.log(`📊 成功率: ${((stats.success / TOTAL_REQUESTS) * 100).toFixed(2)}%`);
  console.log('');
  console.log(`⏱️  总耗时: ${(totalElapsed / 1000).toFixed(2)}s`);
  console.log(`⚡ QPS: ${(TOTAL_REQUESTS / (totalElapsed / 1000)).toFixed(2)} req/s`);
  console.log('');
  
  if (stats.times.length > 0) {
    console.log(`📊 响应时间统计:`);
    console.log(`   最小: ${stats.minTime.toFixed(2)}ms`);
    console.log(`   最大: ${stats.maxTime.toFixed(2)}ms`);
    console.log(`   平均: ${(stats.totalTime / stats.success).toFixed(2)}ms`);
    console.log(`   P50:  ${percentile(stats.times, 50).toFixed(2)}ms`);
    console.log(`   P90:  ${percentile(stats.times, 90).toFixed(2)}ms`);
    console.log(`   P99:  ${percentile(stats.times, 99).toFixed(2)}ms`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

main().catch(console.error);
