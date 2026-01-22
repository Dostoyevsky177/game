import type { Vote, Question, Unsubscribe } from '../types';

/**
 * API 基础 URL
 */
const API_BASE = 'http://localhost:4396/api';

/**
 * 轮询间隔（毫秒）- 越短越实时
 */
const POLL_INTERVAL = 200; // 200ms - 更短的间隔实现更快更新

/**
 * 用户投票记录
 */
export interface UserVoteRecord {
  questionId: string;
  optionId: string;
}

/**
 * 数据库服务接口
 */
export interface DatabaseService {
  submitVote(vote: Omit<Vote, 'id'>): Promise<void>;
  subscribeToVotes(questionId: string, callback: (votes: Vote[]) => void): Unsubscribe;
  getQuestions(eventId: string): Promise<Question[]>;
  subscribeToCurrentQuestion(eventId: string, callback: (questionId: string | null) => void): Unsubscribe;
  subscribeToVoteCleared(eventId: string, callback: (questionId: string) => void): Unsubscribe;
  setCurrentQuestion(eventId: string, questionId: string): Promise<void>;
  clearVotes(questionId: string): Promise<void>;
  getUserVotes(deviceId: string): Promise<UserVoteRecord[]>;
}

/**
 * 本地 API 数据库服务实现
 * 使用轮询替代实时订阅
 */
export const databaseService: DatabaseService = {
  /**
   * 提交投票
   */
  async submitVote(vote: Omit<Vote, 'id'>): Promise<void> {
    const response = await fetch(`${API_BASE}/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: vote.questionId,
        optionId: vote.optionId,
        deviceId: vote.deviceId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit vote');
    }
  },

  /**
   * 订阅投票数据变更 - 使用轮询
   */
  subscribeToVotes(questionId: string, callback: (votes: Vote[]) => void): Unsubscribe {
    let isSubscribed = true;

    const fetchVotes = async () => {
      try {
        const response = await fetch(`${API_BASE}/questions/${questionId}/votes`);
        if (response.ok) {
          const data = await response.json();
          const votes: Vote[] = data.map((row: Record<string, unknown>) => ({
            id: row.id as string,
            questionId: row.questionId as string,
            optionId: row.optionId as string,
            deviceId: row.deviceId as string,
            timestamp: new Date(row.timestamp as string),
          }));
          if (isSubscribed) {
            callback(votes);
          }
        }
      } catch {
        // 网络错误时静默处理，下次轮询会重试
      }
    };

    // 立即获取一次
    fetchVotes();

    // 开始轮询
    const intervalId = setInterval(() => {
      if (isSubscribed) {
        fetchVotes();
      }
    }, POLL_INTERVAL);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  },

  /**
   * 获取活动的所有问题
   */
  async getQuestions(eventId: string): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/events/${eventId}/questions`);

    if (!response.ok) {
      throw new Error('Failed to get questions');
    }

    const data = await response.json();
    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      eventId: row.eventId as string,
      title: row.title as string,
      options: row.options as { id: string; label: string; color?: string }[],
      order: row.order as number,
    }));
  },

  /**
   * 订阅当前问题变更 - 使用轮询
   */
  subscribeToCurrentQuestion(
    eventId: string,
    callback: (questionId: string | null) => void
  ): Unsubscribe {
    let isSubscribed = true;
    let lastQuestionId: string | null = null;

    const fetchCurrentQuestion = async () => {
      try {
        const response = await fetch(`${API_BASE}/events/${eventId}`);
        if (response.ok) {
          const event = await response.json();
          const currentId = event.currentQuestionId || null;

          // 只在变化时调用回调
          if (isSubscribed && currentId !== lastQuestionId) {
            lastQuestionId = currentId;
            callback(currentId);
          }
        }
      } catch {
        // 网络错误时静默处理
      }
    };

    // 立即获取一次
    fetchCurrentQuestion();

    // 开始轮询
    const intervalId = setInterval(() => {
      if (isSubscribed) {
        fetchCurrentQuestion();
      }
    }, POLL_INTERVAL);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  },

  /**
   * 订阅投票清空事件 - 使用轮询
   */
  subscribeToVoteCleared(
    eventId: string,
    callback: (questionId: string) => void
  ): Unsubscribe {
    let isSubscribed = true;
    let lastClearedId: string | null = null;

    const fetchCleared = async () => {
      try {
        const response = await fetch(`${API_BASE}/events/${eventId}/cleared`);
        if (response.ok) {
          const data = await response.json();
          const clearedId = data.clearedQuestionId;

          // 检测到新的清空事件
          if (isSubscribed && clearedId && clearedId !== lastClearedId) {
            lastClearedId = clearedId;
            callback(clearedId);

            // 通知后端已收到，清除通知状态
            fetch(`${API_BASE}/events/${eventId}/clear-notification`, {
              method: 'POST',
            });
          }
        }
      } catch {
        // 网络错误时静默处理
      }
    };

    // 立即获取一次
    fetchCleared();

    // 开始轮询
    const intervalId = setInterval(() => {
      if (isSubscribed) {
        fetchCleared();
      }
    }, POLL_INTERVAL);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  },

  /**
   * 设置当前问题
   */
  async setCurrentQuestion(eventId: string, questionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/events/${eventId}/current-question`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to set current question');
    }
  },

  /**
   * 清空指定问题的所有投票
   */
  async clearVotes(questionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/questions/${questionId}/votes`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear votes');
    }
  },

  /**
   * 获取用户的所有投票记录
   */
  async getUserVotes(deviceId: string): Promise<UserVoteRecord[]> {
    const response = await fetch(`${API_BASE}/devices/${deviceId}/votes`);

    if (!response.ok) {
      throw new Error('Failed to get user votes');
    }

    const data = await response.json();
    return data.map((row: Record<string, unknown>) => ({
      questionId: row.questionId as string,
      optionId: row.optionId as string,
    }));
  },
};
