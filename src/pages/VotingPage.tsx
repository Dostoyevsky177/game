import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../services/database';
import type { UserVoteRecord } from '../services/database';
import type { Question } from '../types';
import './VotingPage.css';

/**
 * VotingPage 组件属性
 */
interface VotingPageProps {
  eventId: string;
}

/**
 * VotingPage 组件状态
 */
interface VotingPageState {
  questions: Question[];
  userVotes: Map<string, string>; // questionId -> optionId
  isLoading: boolean;
  isSubmitting: string | null; // 正在提交的问题ID
  error: string | null;
}

/**
 * 生成设备ID（用于标识用户）
 */
function getDeviceId(): string {
  const key = 'device_id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/**
 * H5 投票页组件
 * 
 * 功能：
 * - 显示所有问题列表
 * - 用户可以选择回答任意问题
 * - 支持修改已投票的选项
 */
export function VotingPage({ eventId }: VotingPageProps) {
  const [state, setState] = useState<VotingPageState>({
    questions: [],
    userVotes: new Map(),
    isLoading: true,
    isSubmitting: null,
    error: null,
  });

  const { questions, userVotes, isLoading, isSubmitting, error } = state;

  /**
   * 加载所有问题和用户投票记录
   */
  const loadData = useCallback(async () => {
    try {
      const deviceId = getDeviceId();
      
      // 并行加载问题和用户投票记录
      const [questionList, voteRecords] = await Promise.all([
        databaseService.getQuestions(eventId),
        databaseService.getUserVotes(deviceId),
      ]);

      // 转换投票记录为 Map
      const votesMap = new Map<string, string>();
      voteRecords.forEach((record: UserVoteRecord) => {
        votesMap.set(record.questionId, record.optionId);
      });

      setState(prev => ({
        ...prev,
        questions: questionList,
        userVotes: votesMap,
        isLoading: false,
        error: null,
      }));
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: '网络异常，请重试',
      }));
    }
  }, [eventId]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 提交或更新投票
   */
  const handleVote = async (questionId: string, optionId: string) => {
    if (isSubmitting) return;

    // 如果选择的是同一个选项，不需要提交
    if (userVotes.get(questionId) === optionId) return;

    setState(prev => ({ ...prev, isSubmitting: questionId, error: null }));

    try {
      await databaseService.submitVote({
        questionId,
        optionId,
        deviceId: getDeviceId(),
        timestamp: new Date(),
      });

      // 更新本地状态
      setState(prev => {
        const newVotes = new Map(prev.userVotes);
        newVotes.set(questionId, optionId);
        return {
          ...prev,
          userVotes: newVotes,
          isSubmitting: null,
        };
      });
    } catch {
      setState(prev => ({
        ...prev,
        isSubmitting: null,
        error: '提交失败，请重试',
      }));
    }
  };

  /**
   * 重试加载
   */
  const handleRetry = () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    loadData();
  };

  /**
   * 计算已回答问题数
   */
  const answeredCount = userVotes.size;
  const totalCount = questions.length;

  // 加载中状态
  if (isLoading) {
    return (
      <div className="voting-page voting-page--loading">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    );
  }

  // 错误状态（无问题时）
  if (error && questions.length === 0) {
    return (
      <div className="voting-page voting-page--error">
        <p className="error-message">{error}</p>
        <button className="retry-button" onClick={handleRetry}>
          重试
        </button>
      </div>
    );
  }

  // 无问题状态
  if (questions.length === 0) {
    return (
      <div className="voting-page voting-page--empty">
        <p>暂无投票问题</p>
      </div>
    );
  }

  // 问题列表界面
  return (
    <div className="voting-page voting-page--list">
      {/* 顶部进度 */}
      <header className="voting-header">
        <h1 className="voting-title">互动投票</h1>
        <div className="voting-progress">
          <span className="progress-text">
            已回答 <strong>{answeredCount}</strong> / {totalCount}
          </span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="error-toast">
          <p>{error}</p>
        </div>
      )}

      {/* 问题列表 */}
      <div className="questions-list">
        {questions.map((question, index) => {
          const selectedOptionId = userVotes.get(question.id);
          const isAnswered = !!selectedOptionId;
          const isCurrentSubmitting = isSubmitting === question.id;

          return (
            <div 
              key={question.id} 
              className={`question-card ${isAnswered ? 'question-card--answered' : ''}`}
            >
              {/* 问题标题 */}
              <div className="question-header">
                <span className="question-number">{index + 1}</span>
                <h2 className="question-title">{question.title}</h2>
                {isAnswered && (
                  <span className="answered-badge">✓ 已答</span>
                )}
              </div>

              {/* 选项列表 */}
              <div className="options-grid">
                {question.options.map((option) => {
                  const isSelected = selectedOptionId === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      className={`option-btn ${isSelected ? 'option-btn--selected' : ''}`}
                      onClick={() => handleVote(question.id, option.id)}
                      disabled={isCurrentSubmitting}
                      style={option.color ? { 
                        '--option-color': option.color,
                        borderColor: isSelected ? option.color : undefined,
                        backgroundColor: isSelected ? option.color : undefined,
                      } as React.CSSProperties : undefined}
                    >
                      {isSelected && <span className="check-icon">✓</span>}
                      <span className="option-label">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 提交中状态 */}
              {isCurrentSubmitting && (
                <div className="submitting-indicator">
                  <div className="loading-spinner-small" />
                  <span>提交中...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <footer className="voting-footer">
        <p>点击选项即可投票，可随时修改选择</p>
      </footer>
    </div>
  );
}

export default VotingPage;
