import { useState, useEffect } from 'react';
import { databaseService } from '../services/database';
import type { Question, Unsubscribe } from '../types';
import './ControlPanel.css';

/**
 * ControlPanel 组件属性
 */
interface ControlPanelProps {
  eventId: string;
}

/**
 * ControlPanel 组件状态
 */
interface ControlPanelState {
  questions: Question[];
  currentQuestionId: string | null;
  isLoading: boolean;
  isSwitching: boolean;
  isClearing: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * 主持人控制台组件
 * 
 * Requirements: 5.1, 5.2
 */
export function ControlPanel({ eventId }: ControlPanelProps) {
  const [state, setState] = useState<ControlPanelState>({
    questions: [],
    currentQuestionId: null,
    isLoading: true,
    isSwitching: false,
    isClearing: false,
    error: null,
    retryCount: 0,
  });

  const { questions, currentQuestionId, isLoading, isSwitching, isClearing, error, retryCount } = state;

  /**
   * 订阅当前问题变更
   */
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;

    const subscribe = () => {
      unsubscribe = databaseService.subscribeToCurrentQuestion(eventId, (questionId) => {
        setState(prev => ({
          ...prev,
          currentQuestionId: questionId,
        }));
      });
    };

    subscribe();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventId]);

  /**
   * 加载问题列表
   */
  useEffect(() => {
    let cancelled = false;
    
    const fetchQuestions = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const questionList = await databaseService.getQuestions(eventId);
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            questions: questionList,
            isLoading: false,
          }));
        }
      } catch {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: '加载问题列表失败',
          }));
        }
      }
    };
    
    fetchQuestions();
    
    return () => {
      cancelled = true;
    };
  }, [eventId, retryCount]);

  /**
   * 切换当前问题
   */
  const handleSwitchQuestion = async (questionId: string) => {
    if (isSwitching || questionId === currentQuestionId) {
      return;
    }

    setState(prev => ({ ...prev, isSwitching: true, error: null }));

    try {
      await databaseService.setCurrentQuestion(eventId, questionId);
      setState(prev => ({
        ...prev,
        isSwitching: false,
      }));
    } catch {
      setState(prev => ({
        ...prev,
        isSwitching: false,
        error: '切题失败，请重试',
      }));
    }
  };

  /**
   * 重试加载
   */
  const handleRetry = () => {
    setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
  };

  /**
   * 清空当前问题的所有投票
   */
  const handleClearVotes = async () => {
    if (!currentQuestionId || isClearing) return;
    
    if (!window.confirm('确定要清空当前问题的所有投票吗？此操作不可撤销。')) {
      return;
    }

    setState(prev => ({ ...prev, isClearing: true, error: null }));

    try {
      await databaseService.clearVotes(currentQuestionId);
      setState(prev => ({ ...prev, isClearing: false }));
    } catch {
      setState(prev => ({
        ...prev,
        isClearing: false,
        error: '清空投票失败，请重试',
      }));
    }
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="control-panel control-panel--loading">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    );
  }

  // 错误状态（无问题列表时）
  if (error && questions.length === 0) {
    return (
      <div className="control-panel control-panel--error">
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
      <div className="control-panel control-panel--empty">
        <p>暂无问题</p>
      </div>
    );
  }

  return (
    <div className="control-panel">
      <header className="control-header">
        <h1 className="control-title">主持人控制台</h1>
        <p className="control-subtitle">点击问题进行切换</p>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {/* 问题列表 */}
      <div className="question-list">
        {questions.map((question, index) => {
          const isActive = question.id === currentQuestionId;
          
          return (
            <button
              key={question.id}
              className={`question-item ${isActive ? 'question-item--active' : ''}`}
              onClick={() => handleSwitchQuestion(question.id)}
              disabled={isSwitching || isClearing}
            >
              <span className="question-number">{index + 1}</span>
              <span className="question-title">{question.title}</span>
              {isActive && <span className="active-badge">当前</span>}
            </button>
          );
        })}
      </div>

      {/* 清空投票按钮 */}
      {currentQuestionId && (
        <div className="clear-votes-section">
          <button
            className="clear-votes-button"
            onClick={handleClearVotes}
            disabled={isClearing || isSwitching}
          >
            {isClearing ? '清空中...' : '🗑️ 清空当前问题投票'}
          </button>
        </div>
      )}

      {/* 切换中状态 */}
      {isSwitching && (
        <div className="switching-overlay">
          <div className="loading-spinner" />
          <p>切换中...</p>
        </div>
      )}
    </div>
  );
}

export default ControlPanel;
