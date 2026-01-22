import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { DisplayScreen } from './DisplayScreen';
import { databaseService } from '../services/database';
import type { Question, Vote } from '../types';

// Mock the database service
vi.mock('../services/database', () => ({
  databaseService: {
    getQuestions: vi.fn(),
    subscribeToCurrentQuestion: vi.fn(),
    subscribeToVotes: vi.fn(),
  },
}));

const mockQuestion: Question = {
  id: 'q1',
  eventId: 'event1',
  title: '你最喜欢的编程语言是什么？',
  options: [
    { id: 'opt1', label: 'TypeScript' },
    { id: 'opt2', label: 'Python' },
    { id: 'opt3', label: 'Rust' },
  ],
  order: 1,
};

const mockVotes: Vote[] = [
  { id: 'v1', questionId: 'q1', optionId: 'opt1', deviceId: 'd1', timestamp: new Date() },
  { id: 'v2', questionId: 'q1', optionId: 'opt1', deviceId: 'd2', timestamp: new Date() },
  { id: 'v3', questionId: 'q1', optionId: 'opt2', deviceId: 'd3', timestamp: new Date() },
];

describe('DisplayScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试初始化渲染 - 显示加载状态
   * Requirements: 3.1
   */
  test('renders loading state initially', () => {
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(() => () => {});

    render(<DisplayScreen eventId="event1" />);

    expect(screen.getByText('连接中...')).toBeInTheDocument();
  });

  /**
   * 测试正确渲染问题标题
   * Requirements: 3.1
   */
  test('renders question title correctly', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback('q1'), 0);
        return () => {};
      }
    );
    vi.mocked(databaseService.subscribeToVotes).mockImplementation(
      (_questionId, callback) => {
        setTimeout(() => callback([]), 0);
        return () => {};
      }
    );

    render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的编程语言是什么？')).toBeInTheDocument();
    });
  });

  /**
   * 测试显示选项标签
   * Requirements: 3.5
   */
  test('renders option labels', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback('q1'), 0);
        return () => {};
      }
    );
    vi.mocked(databaseService.subscribeToVotes).mockImplementation(
      (_questionId, callback) => {
        setTimeout(() => callback([]), 0);
        return () => {};
      }
    );

    render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
      expect(screen.getByText('Rust')).toBeInTheDocument();
    });
  });

  /**
   * 测试显示参与人数标签
   * Requirements: 3.5
   */
  test('displays total participant label', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback('q1'), 0);
        return () => {};
      }
    );
    vi.mocked(databaseService.subscribeToVotes).mockImplementation(
      (_questionId, callback) => {
        setTimeout(() => callback(mockVotes), 0);
        return () => {};
      }
    );

    render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('参与人数')).toBeInTheDocument();
    });
  });

  /**
   * 测试断网处理 - 显示重连状态
   * Requirements: 3.4
   */
  test('shows reconnecting status when offline', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback('q1'), 0);
        return () => {};
      }
    );
    vi.mocked(databaseService.subscribeToVotes).mockImplementation(
      (_questionId, callback) => {
        setTimeout(() => callback([]), 0);
        return () => {};
      }
    );

    render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的编程语言是什么？')).toBeInTheDocument();
    });

    // Simulate going offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByText('重连中...')).toBeInTheDocument();
    });
  });

  /**
   * 测试断网后恢复连接
   * Requirements: 3.4
   */
  test('removes reconnecting status when back online', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback('q1'), 0);
        return () => {};
      }
    );
    vi.mocked(databaseService.subscribeToVotes).mockImplementation(
      (_questionId, callback) => {
        setTimeout(() => callback([]), 0);
        return () => {};
      }
    );

    render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的编程语言是什么？')).toBeInTheDocument();
    });

    // Simulate going offline then online
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByText('重连中...')).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(screen.queryByText('重连中...')).not.toBeInTheDocument();
    });
  });

  /**
   * 测试无当前问题时显示等待状态
   */
  test('shows waiting message when no current question', async () => {
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      }
    );

    render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('等待问题开始...')).toBeInTheDocument();
    });
  });

  /**
   * 测试取消订阅清理
   */
  test('unsubscribes on unmount', async () => {
    const unsubscribeQuestion = vi.fn();
    const unsubscribeVotes = vi.fn();

    vi.mocked(databaseService.getQuestions).mockResolvedValue([mockQuestion]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        setTimeout(() => callback('q1'), 0);
        return unsubscribeQuestion;
      }
    );
    vi.mocked(databaseService.subscribeToVotes).mockImplementation(
      (_questionId, callback) => {
        setTimeout(() => callback([]), 0);
        return unsubscribeVotes;
      }
    );

    const { unmount } = render(<DisplayScreen eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的编程语言是什么？')).toBeInTheDocument();
    });

    unmount();

    expect(unsubscribeQuestion).toHaveBeenCalled();
    expect(unsubscribeVotes).toHaveBeenCalled();
  });
});
