import type { Vote, Option, VoteStats, OptionStat } from '../types';

/**
 * 根据投票列表计算各选项票数和百分比
 * 
 * @param votes - 投票记录列表
 * @param options - 可选的选项列表，用于获取选项标签
 * @returns 投票统计结果
 * 
 * Requirements: 3.2, 3.5
 */
export function calculateStats(votes: Vote[], options: Option[] = []): VoteStats {
  const totalVotes = votes.length;
  
  // 统计每个选项的票数
  const countMap = new Map<string, number>();
  
  for (const vote of votes) {
    const currentCount = countMap.get(vote.optionId) || 0;
    countMap.set(vote.optionId, currentCount + 1);
  }
  
  // 构建选项统计列表
  // 如果提供了 options，按 options 顺序构建；否则按 countMap 的键构建
  const optionStats: OptionStat[] = [];
  
  if (options.length > 0) {
    // 使用提供的选项列表
    for (const option of options) {
      const count = countMap.get(option.id) || 0;
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
      
      optionStats.push({
        optionId: option.id,
        label: option.label,
        count,
        percentage,
      });
    }
  } else {
    // 从投票记录中提取选项
    for (const [optionId, count] of countMap) {
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
      
      optionStats.push({
        optionId,
        label: optionId, // 没有选项信息时使用 optionId 作为标签
        count,
        percentage,
      });
    }
  }
  
  return {
    totalVotes,
    options: optionStats,
  };
}
