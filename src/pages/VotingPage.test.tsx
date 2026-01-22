import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VotingPage } from './VotingPage';
import { databaseService } from '../services/database';
import * as voteStatus from '../utils/voteStatus';
import type { Question } from '../types';

// Mock the database service
vi.mock('../services/database', () => ({
  databaseService: {
    getQuestions: vi.fn(),
    subscribeToCurrentQuestion: vi.fn(),
    subscribeToVoteCleared: vi.fn(() => () => {}),
    submitVote: vi.fn(),
  },
}));

// Mock the voteStatus utilities
vi.mock('../utils/voteStatus', () => ({
  checkVoteStatus: vi.fn(),
  markAsVoted: vi.fn(),
  clearVoteStatus: vi.fn(),
}));

const mockQuestion: Question = {
  id: 'q1',
  eventId: 'event1',
  title: '你最喜欢的颜色是什么？',
  options: [
    { id: 'opt1', label: '红色' },
    { id: 'opt2', label: '蓝色' },
    { id: 'opt3', label: '绿色' },
  ],
  order: 1,
};

describe('VotingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(voteStatus.checkVoteStatus).mockReturnValue(false);
    vi.mocked(voteStatus.markAsVoted).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试正确渲染问题和选项
   * Requirements: 1.2
   */
  test('renders question title and options correctly', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的颜色是什么？')).toBeInTheDocument();
    });

    expect(screen.getByText('红色')).toBeInTheDocument();
    expect(screen.getByText('蓝色')).toBeInTheDocument();
    expect(screen.getByText('绿色')).toBeInTheDocument();
  });

  /**
   * 测试已投票状态显示"已参与"
   * Requirements: 1.3, 4.2
   */
  test('shows "已参与" when user has already voted', async () => {
    vi.mocked(voteStatus.checkVoteStatus).mockReturnValue(true);
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('您已参与')).toBeInTheDocument();
    });
  });

  /**
   * 测试点击选项提交投票
   * Requirements: 1.3
   */
  test('submits vote when option is clicked', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.submitVote).mockResolvedValue(undefined);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('红色')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('红色'));

    await waitFor(() => {
      expect(databaseService.submitVote).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q1',
          optionId: 'opt1',
        })
      );
    });

    expect(voteStatus.markAsVoted).toHaveBeenCalledWith('q1');
  });

  /**
   * 测试网络错误显示重试按钮
   * Requirements: 1.5
   */
  test('shows error message and retry button on network error', async () => {
    vi.mocked(databaseService.getQuestions).mockRejectedValue(new Error('Network error'));
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('网络异常，请重试')).toBeInTheDocument();
    });

    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  /**
   * 测试重试按钮功能
   * Requirements: 1.5
   */
  test('retry button reloads data', async () => {
    vi.mocked(databaseService.getQuestions)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('网络异常，请重试')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的颜色是什么？')).toBeInTheDocument();
    });
  });

  /**
   * 测试投票提交失败时显示错误
   * Requirements: 1.5
   */
  test('shows error when vote submission fails', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.submitVote).mockRejectedValue(new Error('Submit failed'));
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('红色')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('红色'));

    await waitFor(() => {
      expect(screen.getByText('网络异常，请重试')).toBeInTheDocument();
    });

    // Should not mark as voted on failure
    expect(voteStatus.markAsVoted).not.toHaveBeenCalled();
  });

  /**
   * 测试防重复投票检查
   * Requirements: 4.1, 4.2
   */
  test('prevents duplicate voting', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );
    // First two checks return false (initial load + useEffect), third returns true (concurrent check during submit)
    vi.mocked(voteStatus.checkVoteStatus)
      .mockReturnValueOnce(false) // Initial load in loadQuestion
      .mockReturnValueOnce(false) // useEffect check when question changes
      .mockReturnValue(true);     // Check during handleVote (simulating concurrent vote)

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('红色')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('红色'));

    // Should show voted state without submitting
    await waitFor(() => {
      expect(screen.getByText('您已参与')).toBeInTheDocument();
    });

    expect(databaseService.submitVote).not.toHaveBeenCalled();
  });

  /**
   * 测试活动结束状态
   */
  test('shows "活动已结束" when no current question', async () => {
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback(null);
        return () => {};
      }
    );

    render(<VotingPage eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('活动已结束')).toBeInTheDocument();
    });
  });
});
