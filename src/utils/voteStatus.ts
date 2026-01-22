/**
 * 防重复投票逻辑
 * 使用 localStorage 存储投票状态，按 questionId 区分不同问题的投票状态
 * 
 * Requirements: 4.1, 4.2
 */

const VOTE_STATUS_PREFIX = 'vote_status_';

/**
 * 获取存储键名
 * @param questionId - 问题ID
 * @returns localStorage 键名
 */
function getStorageKey(questionId: string): string {
  return `${VOTE_STATUS_PREFIX}${questionId}`;
}

/**
 * 检查用户是否已对指定问题投票
 * 
 * @param questionId - 问题ID
 * @returns true 表示已投票，false 表示未投票
 * 
 * Requirements: 4.1, 4.2
 */
export function checkVoteStatus(questionId: string): boolean {
  if (!questionId) {
    return false;
  }
  
  try {
    const key = getStorageKey(questionId);
    const value = localStorage.getItem(key);
    return value === 'true';
  } catch {
    // localStorage 不可用时返回 false，允许投票
    return false;
  }
}

/**
 * 标记用户已对指定问题投票
 * 
 * @param questionId - 问题ID
 * @returns true 表示标记成功，false 表示标记失败
 * 
 * Requirements: 4.1, 4.2
 */
export function markAsVoted(questionId: string): boolean {
  if (!questionId) {
    return false;
  }
  
  try {
    const key = getStorageKey(questionId);
    localStorage.setItem(key, 'true');
    return true;
  } catch {
    // localStorage 不可用时返回 false
    return false;
  }
}

/**
 * 清除指定问题的投票状态（用于测试或管理目的）
 * 
 * @param questionId - 问题ID
 */
export function clearVoteStatus(questionId: string): void {
  if (!questionId) {
    return;
  }
  
  try {
    const key = getStorageKey(questionId);
    localStorage.removeItem(key);
  } catch {
    // 忽略错误
  }
}
