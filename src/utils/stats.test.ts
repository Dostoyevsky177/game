import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateStats } from './stats';
import type { Vote, Option } from '../types';

/**
 * Feature: realtime-voting-system, Property 2: 统计计算正确性
 * Validates: Requirements 3.2, 3.5
 * 
 * For any 投票记录列表，calculateStats 函数计算出的统计结果应满足：
 * - totalVotes 等于投票记录的数量
 * - 各选项的 count 之和等于 totalVotes
 * - 各选项的 percentage 之和等于 100%（允许浮点误差 ±0.1%）
 * - 每个选项的 percentage = (count / totalVotes) * 100
 */
describe('calculateStats Property Tests', () => {
  // 生成随机投票记录的 Arbitrary
  const voteArbitrary = fc.record({
    id: fc.uuid(),
    questionId: fc.uuid(),
    optionId: fc.constantFrom('A', 'B', 'C', 'D'),
    deviceId: fc.uuid(),
    timestamp: fc.date(),
  });

  test('Property 2: calculateStats produces correct statistics for any vote list', () => {
    fc.assert(
      fc.property(fc.array(voteArbitrary), (votes: Vote[]) => {
        const stats = calculateStats(votes);

        // 验证 totalVotes 等于投票记录的数量
        expect(stats.totalVotes).toBe(votes.length);

        // 验证各选项的 count 之和等于 totalVotes
        const sumCounts = stats.options.reduce((sum, opt) => sum + opt.count, 0);
        expect(sumCounts).toBe(stats.totalVotes);

        // 验证百分比之和（允许浮点误差 ±0.1%）
        if (stats.totalVotes > 0) {
          const sumPercentages = stats.options.reduce(
            (sum, opt) => sum + opt.percentage,
            0
          );
          expect(Math.abs(sumPercentages - 100)).toBeLessThan(0.1);
        }

        // 验证每个选项的 percentage = (count / totalVotes) * 100
        for (const optStat of stats.options) {
          if (stats.totalVotes > 0) {
            const expectedPercentage = (optStat.count / stats.totalVotes) * 100;
            expect(optStat.percentage).toBeCloseTo(expectedPercentage, 10);
          } else {
            expect(optStat.percentage).toBe(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 2: calculateStats with options preserves option order and labels', () => {
    // 生成选项列表，确保每个选项有唯一的 id
    const optionIdsArbitrary = fc.uniqueArray(
      fc.constantFrom('A', 'B', 'C', 'D'),
      { minLength: 1, maxLength: 4 }
    );

    fc.assert(
      fc.property(
        optionIdsArbitrary,
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 4, maxLength: 4 }),
        fc.nat({ max: 50 }), // 投票数量
        (optionIds, labels, voteCount) => {
          // 构建选项列表
          const options: Option[] = optionIds.map((id, i) => ({
            id,
            label: labels[i] || id,
          }));

          // 生成只包含有效 optionId 的投票
          const votes: Vote[] = [];
          for (let i = 0; i < voteCount; i++) {
            const randomOptionId = optionIds[Math.floor(Math.random() * optionIds.length)];
            votes.push({
              id: `vote-${i}`,
              questionId: 'q1',
              optionId: randomOptionId,
              deviceId: `device-${i}`,
              timestamp: new Date(),
            });
          }

          const stats = calculateStats(votes, options);

          // 验证选项数量与提供的选项列表一致
          expect(stats.options.length).toBe(options.length);

          // 验证选项顺序和标签
          for (let i = 0; i < options.length; i++) {
            expect(stats.options[i].optionId).toBe(options[i].id);
            expect(stats.options[i].label).toBe(options[i].label);
          }

          // 验证 totalVotes 等于投票记录的数量
          expect(stats.totalVotes).toBe(votes.length);

          // 验证各选项的 count 之和等于 totalVotes（因为所有投票都是有效选项）
          const sumCounts = stats.options.reduce((sum, opt) => sum + opt.count, 0);
          expect(sumCounts).toBe(stats.totalVotes);
        }
      ),
      { numRuns: 100 }
    );
  });
});
