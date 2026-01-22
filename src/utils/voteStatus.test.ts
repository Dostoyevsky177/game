import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { checkVoteStatus, markAsVoted, clearVoteStatus } from './voteStatus';

/**
 * Feature: realtime-voting-system, Property 3: 防重复投票
 * Validates: Requirements 4.1, 4.2
 * 
 * For any 设备 ID 和问题 ID，如果该设备已对该问题投票（localStorage 中有记录），
 * 则 checkVoteStatus 应返回 true，且 submitVote 应被阻止执行。
 */
describe('voteStatus Property Tests', () => {
  // 在每个测试前清理 localStorage
  beforeEach(() => {
    localStorage.clear();
  });

  // 生成有效的 questionId
  const questionIdArbitrary = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);

  test('Property 3: checkVoteStatus returns false for any question that has not been voted', () => {
    fc.assert(
      fc.property(questionIdArbitrary, (questionId: string) => {
        // 清除可能存在的状态
        clearVoteStatus(questionId);
        
        // 未投票时应返回 false
        expect(checkVoteStatus(questionId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 3: markAsVoted then checkVoteStatus returns true for any questionId', () => {
    fc.assert(
      fc.property(questionIdArbitrary, (questionId: string) => {
        // 清除可能存在的状态
        clearVoteStatus(questionId);
        
        // 标记为已投票
        const markResult = markAsVoted(questionId);
        expect(markResult).toBe(true);
        
        // 检查状态应返回 true
        expect(checkVoteStatus(questionId)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 3: different questionIds have independent vote status', () => {
    fc.assert(
      fc.property(
        questionIdArbitrary,
        questionIdArbitrary,
        (questionId1: string, questionId2: string) => {
          // 跳过相同的 questionId
          fc.pre(questionId1 !== questionId2);
          
          // 清除状态
          clearVoteStatus(questionId1);
          clearVoteStatus(questionId2);
          
          // 只对 questionId1 投票
          markAsVoted(questionId1);
          
          // questionId1 应该已投票
          expect(checkVoteStatus(questionId1)).toBe(true);
          
          // questionId2 应该未投票
          expect(checkVoteStatus(questionId2)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: markAsVoted is idempotent - multiple marks do not change status', () => {
    fc.assert(
      fc.property(
        questionIdArbitrary,
        fc.integer({ min: 1, max: 10 }),
        (questionId: string, times: number) => {
          // 清除状态
          clearVoteStatus(questionId);
          
          // 多次标记
          for (let i = 0; i < times; i++) {
            markAsVoted(questionId);
          }
          
          // 状态应该仍然是已投票
          expect(checkVoteStatus(questionId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: clearVoteStatus resets the vote status', () => {
    fc.assert(
      fc.property(questionIdArbitrary, (questionId: string) => {
        // 先标记为已投票
        markAsVoted(questionId);
        expect(checkVoteStatus(questionId)).toBe(true);
        
        // 清除状态
        clearVoteStatus(questionId);
        
        // 应该恢复为未投票
        expect(checkVoteStatus(questionId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
