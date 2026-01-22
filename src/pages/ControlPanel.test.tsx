import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ControlPanel } from './ControlPanel';
import { databaseService } from '../services/database';
import type { Question } from '../types';

// Mock the database service
vi.mock('../services/database', () => ({
  databaseService: {
    getQuestions: vi.fn(),
    subscribeToCurrentQuestion: vi.fn(),
    setCurrentQuestion: vi.fn(),
  },
}));

const mockQuestions: Question[] = [
  {
    id: 'q1',
    eventId: 'event1',
    title: '你最喜欢的颜色是什么？',
    options: [
      { id: 'opt1', label: '红色' },
      { id: 'opt2', label: '蓝色' },
    ],
    order: 1,
  },
  {
    id: 'q2',
    eventId: 'event1',
    title: '你最喜欢的水果是什么？',
    options: [
      { id: 'opt3', label: '苹果' },
      { id: 'opt4', label: '香蕉' },
    ],
    order: 2,
  },
];

describe('ControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试正确显示问题列表
   * Requirements: 5.1
   */
  test('renders question list correctly', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的颜色是什么？')).toBeInTheDocument();
    });

    expect(screen.getByText('你最喜欢的水果是什么？')).toBeInTheDocument();
    expect(screen.getByText('主持人控制台')).toBeInTheDocument();
  });

  /**
   * 测试当前问题显示"当前"标记
   * Requirements: 5.1
   */
  test('shows active badge for current question', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('当前')).toBeInTheDocument();
    });
  });

  /**
   * 测试切题功能调用正确的数据库方法
   * Requirements: 5.2
   */
  test('calls setCurrentQuestion when switching questions', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(databaseService.setCurrentQuestion).mockResolvedValue(undefined);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的水果是什么？')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('你最喜欢的水果是什么？'));

    await waitFor(() => {
      expect(databaseService.setCurrentQuestion).toHaveBeenCalledWith('event1', 'q2');
    });
  });

  /**
   * 测试加载问题列表失败显示重试按钮
   * Requirements: 5.1
   */
  test('shows retry button when loading questions fails', async () => {
    vi.mocked(databaseService.getQuestions).mockRejectedValue(new Error('Network error'));
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback(null);
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('加载问题列表失败')).toBeInTheDocument();
    });

    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  /**
   * 测试重试按钮功能
   */
  test('retry button reloads questions', async () => {
    vi.mocked(databaseService.getQuestions)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockQuestions);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('加载问题列表失败')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的颜色是什么？')).toBeInTheDocument();
    });
  });

  /**
   * 测试切题失败显示错误提示
   */
  test('shows error when switching question fails', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(databaseService.setCurrentQuestion).mockRejectedValue(new Error('Switch failed'));
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的水果是什么？')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('你最喜欢的水果是什么？'));

    await waitFor(() => {
      expect(screen.getByText('切题失败，请重试')).toBeInTheDocument();
    });
  });

  /**
   * 测试无问题时显示空状态
   */
  test('shows empty state when no questions', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue([]);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback(null);
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('暂无问题')).toBeInTheDocument();
    });
  });

  /**
   * 测试点击当前问题不触发切换
   */
  test('does not switch when clicking current question', async () => {
    vi.mocked(databaseService.getQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(databaseService.subscribeToCurrentQuestion).mockImplementation(
      (_eventId, callback) => {
        callback('q1');
        return () => {};
      }
    );

    render(<ControlPanel eventId="event1" />);

    await waitFor(() => {
      expect(screen.getByText('你最喜欢的颜色是什么？')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('你最喜欢的颜色是什么？'));

    expect(databaseService.setCurrentQuestion).not.toHaveBeenCalled();
  });
});
