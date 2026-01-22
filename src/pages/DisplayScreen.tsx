import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { databaseService } from '../services/database';
import { calculateStats } from '../utils/stats';
import type { Question, Vote, VoteStats, Unsubscribe } from '../types';
import './DisplayScreen.css';

/**
 * DisplayScreen 组件属性
 */
interface DisplayScreenProps {
  eventId: string;
}

/**
 * 轮播配置
 */
const CAROUSEL_INTERVAL = 20000; // 20秒轮播间隔

/**
 * 比较两个 VoteStats 是否相同
 */
function areStatsEqual(a: VoteStats, b: VoteStats): boolean {
  if (a.totalVotes !== b.totalVotes) return false;
  if (a.options.length !== b.options.length) return false;
  for (let i = 0; i < a.options.length; i++) {
    if (a.options[i].optionId !== b.options[i].optionId) return false;
    if (a.options[i].count !== b.options[i].count) return false;
  }
  return true;
}

/**
 * DisplayScreen 组件状态
 */
interface DisplayScreenState {
  questions: Question[];           // 所有问题列表
  currentCarouselIndex: number;    // 当前轮播索引
  voteStats: VoteStats;
  isConnected: boolean;
  isLoading: boolean;
}

/**
 * 动画数值 - 用于平滑过渡
 */
interface AnimatedStats {
  totalVotes: number;
  options: { optionId: string; percentage: number; count: number }[];
}

/**
 * 默认颜色配置 - 暖色 vs 冷色
 */
const DEFAULT_COLORS = [
  '#FF6B6B', // 暖红
  '#4ECDC4', // 冷青
  '#FFE66D', // 暖黄
  '#95E1D3', // 冷绿
  '#F38181', // 暖粉
  '#AA96DA', // 冷紫
];

/**
 * 获取选项颜色
 */
function getOptionColor(index: number, customColor?: string): string {
  return customColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

/**
 * 计算文字的视觉宽度
 * 中文字符宽度约为英文的 1.8 倍
 * 数字和英文字母宽度相近
 */
function calculateVisualWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    // 判断是否为中文字符（包括中文标点）
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      width += 1.8; // 中文字符
    } else {
      width += 1; // 英文、数字、符号
    }
  }
  return width;
}

/**
 * 根据文字视觉宽度和色块宽度计算动态字体大小
 * 保持 选项名:百分比:票数 = 1 : 0.7 : 0.35 的相对比例
 */
function calculateFontSizes(label: string, blockWidthPercent: number): { label: string; percentage: string; count: string } {
  const visualWidth = calculateVisualWidth(label);
  
  // 基础字体大小（vw 单位，响应式）
  // 根据视觉宽度而非字符数量来决定
  let baseLabelSize: number;
  
  if (visualWidth <= 2) {
    baseLabelSize = 6; // 很短，如 "Go"、"是"
  } else if (visualWidth <= 4) {
    baseLabelSize = 5.5; // 短，如 "Java"、"前端"
  } else if (visualWidth <= 6) {
    baseLabelSize = 5; // 中等，如 "Python"、"全栈"
  } else if (visualWidth <= 8) {
    baseLabelSize = 4.5; // 较长，如 "后端开发"
  } else if (visualWidth <= 10) {
    baseLabelSize = 4; // 长，如 "TypeScript"
  } else if (visualWidth <= 12) {
    baseLabelSize = 3.5; // 很长
  } else if (visualWidth <= 15) {
    baseLabelSize = 3; // 超长
  } else {
    baseLabelSize = 2.5; // 极长文字
  }
  
  // 根据色块宽度进一步调整（窄色块需要更小的字体）
  // 当色块宽度小于 25% 时，按比例缩小字体
  const widthFactor = blockWidthPercent < 25 ? blockWidthPercent / 25 : 1;
  const adjustedSize = baseLabelSize * Math.max(widthFactor, 0.5); // 最小缩放到 50%
  
  // 保持相对比例：选项名 : 百分比 : 票数 = 1 : 0.7 : 0.35
  return {
    label: `clamp(1.2rem, ${adjustedSize}vw, ${adjustedSize * 1.2}rem)`,
    percentage: `clamp(0.9rem, ${adjustedSize * 0.7}vw, ${adjustedSize * 0.7 * 1.2}rem)`,
    count: `clamp(0.7rem, ${adjustedSize * 0.35}vw, ${adjustedSize * 0.35 * 1.2}rem)`,
  };
}

/**
 * 缓动函数 - easeOutCubic
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 大屏展示页组件
 * 
 * 支持轮播模式：每20秒自动切换到下一个问题统计结果
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export function DisplayScreen({ eventId }: DisplayScreenProps) {
  const [state, setState] = useState<DisplayScreenState>({
    questions: [],
    currentCarouselIndex: 0,
    voteStats: { totalVotes: 0, options: [] },
    isConnected: true,
    isLoading: true,
  });

  // 动画状态
  const [animatedStats, setAnimatedStats] = useState<AnimatedStats>({
    totalVotes: 0,
    options: [],
  });

  // 动画引用
  const animationRef = useRef<number | null>(null);
  const prevStatsRef = useRef<VoteStats>({ totalVotes: 0, options: [] });
  const targetStatsRef = useRef<VoteStats>({ totalVotes: 0, options: [] }); // 目标统计数据
  
  // 轮播计时器引用
  const carouselTimerRef = useRef<number | null>(null);

  const { questions, currentCarouselIndex, voteStats, isConnected, isLoading } = state;
  
  // 当前显示的问题
  const currentQuestion = questions[currentCarouselIndex] || null;

  /**
   * 动画过渡到新的统计数据
   * 只有当目标数据真正变化时才触发新动画
   */
  const animateToStats = useCallback((newStats: VoteStats) => {
    // 如果目标数据没有变化，不触发新动画
    if (areStatsEqual(targetStatsRef.current, newStats)) {
      return;
    }
    
    // 更新目标数据
    targetStatsRef.current = newStats;
    
    // 从当前动画状态开始（而不是从 prevStatsRef）
    const startStats = { ...prevStatsRef.current };
    const startTime = performance.now();
    const duration = 300; // 动画持续时间 300ms

    // 取消之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      // 计算插值
      const interpolatedTotal = Math.round(
        startStats.totalVotes + (newStats.totalVotes - startStats.totalVotes) * easedProgress
      );

      const interpolatedOptions = newStats.options.map((newOpt) => {
        const startOpt = startStats.options.find((o) => o.optionId === newOpt.optionId);
        const startPercentage = startOpt?.percentage || 0;
        const startCount = startOpt?.count || 0;

        return {
          optionId: newOpt.optionId,
          percentage: startPercentage + (newOpt.percentage - startPercentage) * easedProgress,
          count: Math.round(startCount + (newOpt.count - startCount) * easedProgress),
        };
      });

      setAnimatedStats({
        totalVotes: interpolatedTotal,
        options: interpolatedOptions,
      });
      
      // 同步更新 prevStatsRef 以便下次动画从正确位置开始
      prevStatsRef.current = {
        totalVotes: interpolatedTotal,
        options: interpolatedOptions,
      };

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  /**
   * 加载所有问题
   */
  const loadAllQuestions = useCallback(async () => {
    try {
      const questionList = await databaseService.getQuestions(eventId);
      setState((prev) => ({
        ...prev,
        questions: questionList,
        isLoading: false,
        isConnected: true,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isConnected: false,
      }));
    }
  }, [eventId]);

  /**
   * 初始化加载所有问题
   */
  useEffect(() => {
    loadAllQuestions();
  }, [loadAllQuestions]);

  /**
   * 轮播逻辑 - 每20秒切换到下一个问题
   */
  useEffect(() => {
    // 如果没有问题或只有一个问题，不需要轮播
    if (questions.length <= 1) {
      return;
    }

    // 清除之前的计时器
    if (carouselTimerRef.current) {
      window.clearInterval(carouselTimerRef.current);
    }

    // 启动轮播计时器
    carouselTimerRef.current = window.setInterval(() => {
      setState((prev) => {
        const nextIndex = (prev.currentCarouselIndex + 1) % prev.questions.length;
        // 重置动画状态，准备新问题的动画
        prevStatsRef.current = { totalVotes: 0, options: [] };
        targetStatsRef.current = { totalVotes: 0, options: [] };
        return {
          ...prev,
          currentCarouselIndex: nextIndex,
          voteStats: { totalVotes: 0, options: [] },
        };
      });
    }, CAROUSEL_INTERVAL);

    return () => {
      if (carouselTimerRef.current) {
        window.clearInterval(carouselTimerRef.current);
      }
    };
  }, [questions.length]);

  /**
   * 订阅当前问题的投票数据变更
   */
  useEffect(() => {
    if (!currentQuestion) return;

    let unsubscribe: Unsubscribe | null = null;
    let isSubscribed = true;

    const subscribe = () => {
      unsubscribe = databaseService.subscribeToVotes(currentQuestion.id, (votes: Vote[]) => {
        if (!isSubscribed) return;

        const newStats = calculateStats(votes, currentQuestion.options);
        
        setState((prev) => ({
          ...prev,
          voteStats: newStats,
          isConnected: true,
        }));

        // 触发动画
        animateToStats(newStats);
      });
    };

    subscribe();

    // 监听网络状态
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isSubscribed = false;
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentQuestion, animateToStats]);

  /**
   * 清理动画
   */
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  /**
   * 手动切换到指定问题
   */
  const handleIndicatorClick = (index: number) => {
    // 重置动画状态
    prevStatsRef.current = { totalVotes: 0, options: [] };
    targetStatsRef.current = { totalVotes: 0, options: [] };
    setState((prev) => ({
      ...prev,
      currentCarouselIndex: index,
      voteStats: { totalVotes: 0, options: [] },
    }));
    
    // 重置计时器
    if (carouselTimerRef.current) {
      window.clearInterval(carouselTimerRef.current);
    }
    if (questions.length > 1) {
      carouselTimerRef.current = window.setInterval(() => {
        setState((prev) => {
          const nextIndex = (prev.currentCarouselIndex + 1) % prev.questions.length;
          prevStatsRef.current = { totalVotes: 0, options: [] };
          targetStatsRef.current = { totalVotes: 0, options: [] };
          return {
            ...prev,
            currentCarouselIndex: nextIndex,
            voteStats: { totalVotes: 0, options: [] },
          };
        });
      }, CAROUSEL_INTERVAL);
    }
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="display-screen display-screen--loading">
        <div className="loading-indicator">
          <div className="loading-spinner-large" />
          <p>连接中...</p>
        </div>
      </div>
    );
  }

  // 无问题状态
  if (!currentQuestion) {
    return (
      <div className="display-screen display-screen--empty">
        <p className="empty-message">等待问题开始...</p>
        {!isConnected && (
          <div className="connection-status connection-status--offline">
            <span className="status-dot" />
            重连中...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="display-screen">
      {/* 连接状态指示器 */}
      {!isConnected && (
        <div className="connection-status connection-status--offline">
          <span className="status-dot" />
          重连中...
        </div>
      )}

      {/* ① 问题区（Question Header）+ 二维码 */}
      <header className="question-header">
        <div className="qr-code-container">
          <QRCodeSVG 
            value={`${window.location.origin}/vote/${eventId}`}
            size={120}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
          />
          <span className="qr-hint">扫码投票</span>
        </div>
        <h1 className="question-text">{currentQuestion.title}</h1>
      </header>

      {/* ② 核心数据区（Main Visualization）- 比例色块 */}
      <main className="main-visualization">
        <div className="color-blocks">
          {voteStats.options.map((option, index) => {
            const animatedOption = animatedStats.options.find(
              (o) => o.optionId === option.optionId
            );
            const percentage = animatedOption?.percentage || 0;
            const count = animatedOption?.count || 0;
            const originalOption = currentQuestion.options.find(
              (o) => o.id === option.optionId
            );
            const color = getOptionColor(index, originalOption?.color);

            // 计算色块宽度
            // 根据选项数量动态设置最小宽度，确保所有文字都能显示
            const optionCount = voteStats.options.length;
            const minWidth = Math.max(100 / optionCount, 20); // 至少 20%，或平均分配
            const width = voteStats.totalVotes > 0 
              ? Math.max(percentage, minWidth * 0.6) // 有投票时，最小宽度为平均值的 60%
              : 100 / optionCount; // 无投票时平均分配

            // 根据文字长度和色块宽度动态计算字体大小
            const fontSizes = calculateFontSizes(option.label, width);

            return (
              <div
                key={option.optionId}
                className="color-block"
                style={{
                  backgroundColor: color,
                  flex: `${width} 0 0`,
                }}
              >
                <span 
                  className="block-label"
                  style={{ fontSize: fontSizes.label }}
                >
                  {option.label}
                </span>
                <span 
                  className="block-percentage"
                  style={{ fontSize: fontSizes.percentage }}
                >
                  {Math.round(percentage)}%
                </span>
                <span 
                  className="block-count"
                  style={{ fontSize: fontSizes.count }}
                >
                  {count} 票
                </span>
              </div>
            );
          })}
        </div>
      </main>

      {/* ③ 辅助信息区（Footer Info） */}
      <footer className="footer-info">
        <div className="total-votes">
          <span className="total-label">参与人数</span>
          <span className="total-number">{animatedStats.totalVotes}</span>
        </div>
        
        {/* 轮播指示器 - 仅当有多个问题时显示 */}
        {questions.length > 1 && (
          <div className="carousel-indicators">
            {questions.map((q, index) => (
              <button
                key={q.id}
                className={`carousel-indicator ${index === currentCarouselIndex ? 'carousel-indicator--active' : ''}`}
                onClick={() => handleIndicatorClick(index)}
                aria-label={`切换到问题 ${index + 1}`}
                title={q.title}
              >
                <span className="indicator-number">{index + 1}</span>
              </button>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}

export default DisplayScreen;
