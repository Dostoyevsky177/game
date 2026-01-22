/**
 * 添加问题脚本
 * 
 * 使用方法:
 *   npx tsx scripts/add-question.ts
 * 
 * 交互式输入问题标题和选项
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as readline from 'readline';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const EVENT_ID = '00000000-0000-0000-0000-000000000001';

// 预设颜色
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3',
  '#F38181', '#AA96DA', '#3498db', '#e74c3c',
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 请配置 .env 文件中的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log('');
  console.log('📝 添加新问题');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 获取当前问题数量
  const { data: existing } = await supabase
    .from('questions')
    .select('id')
    .eq('event_id', EVENT_ID);
  
  const order = (existing?.length || 0) + 1;

  // 输入问题标题
  const title = await ask('❓ 问题标题: ');
  if (!title) {
    console.log('❌ 问题标题不能为空');
    rl.close();
    return;
  }

  // 输入选项
  console.log('');
  console.log('📋 输入选项（每行一个，输入空行结束）:');
  
  const options: { id: string; label: string; color: string }[] = [];
  let optionIndex = 0;
  
  while (true) {
    const label = await ask(`   选项 ${String.fromCharCode(65 + optionIndex)}: `);
    if (!label) break;
    
    options.push({
      id: String.fromCharCode(65 + optionIndex),
      label,
      color: COLORS[optionIndex % COLORS.length],
    });
    optionIndex++;
    
    if (optionIndex >= 8) {
      console.log('   (最多8个选项)');
      break;
    }
  }

  if (options.length < 2) {
    console.log('❌ 至少需要2个选项');
    rl.close();
    return;
  }

  // 确认
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📌 问题: ${title}`);
  console.log(`📋 选项: ${options.map(o => o.label).join(' | ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const confirm = await ask('确认添加? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ 已取消');
    rl.close();
    return;
  }

  // 插入数据库
  const { data, error } = await supabase
    .from('questions')
    .insert({
      event_id: EVENT_ID,
      title,
      options,
      order,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 添加失败:', error.message);
  } else {
    console.log('');
    console.log('✅ 添加成功!');
    console.log(`   问题ID: ${data.id}`);
    console.log(`   序号: ${order}`);
  }

  rl.close();
}

main().catch(console.error);
