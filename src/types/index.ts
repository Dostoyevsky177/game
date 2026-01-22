/**
 * 选项 - 问题中的单个选项
 */
export interface Option {
  id: string;
  label: string;
  color?: string; // 用于大屏展示的颜色
}

/**
 * 问题 - 投票问题
 */
export interface Question {
  id: string;
  eventId: string;
  title: string;
  options: Option[];
  order: number;
}

/**
 * 活动 - 投票活动
 */
export interface Event {
  id: string;
  name: string;
  questions: Question[];
  currentQuestionId: string | null;
  createdAt: Date;
}

/**
 * 投票记录 - 单条投票
 */
export interface Vote {
  id: string;
  questionId: string;
  optionId: string;
  deviceId: string; // 用于防刷票
  timestamp: Date;
}

/**
 * 选项统计 - 单个选项的统计数据
 */
export interface OptionStat {
  optionId: string;
  label: string;
  count: number;
  percentage: number;
}

/**
 * 投票统计 - 整体统计数据
 */
export interface VoteStats {
  totalVotes: number;
  options: OptionStat[];
}

/**
 * 取消订阅函数类型
 */
export type Unsubscribe = () => void;
