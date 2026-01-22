import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { VotingPage } from './pages/VotingPage';
import { DisplayScreen } from './pages/DisplayScreen';
import { ControlPanel } from './pages/ControlPanel';
import './App.css';

/**
 * 路由包装组件 - 使用 useParams 提取 eventId
 */
function VotingPageWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  if (!eventId) {
    return <div className="error-page">缺少活动ID</div>;
  }
  return <VotingPage eventId={eventId} />;
}

function DisplayScreenWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  if (!eventId) {
    return <div className="error-page">缺少活动ID</div>;
  }
  return <DisplayScreen eventId={eventId} />;
}

function ControlPanelWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  if (!eventId) {
    return <div className="error-page">缺少活动ID</div>;
  }
  return <ControlPanel eventId={eventId} />;
}

/**
 * 主应用组件
 * 
 * 路由配置:
 * - /vote/:eventId - H5投票页
 * - /display/:eventId - 大屏展示页
 * - /control/:eventId - 主持人控制台
 * 
 * Requirements: 1.1
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* H5 投票页 */}
        <Route path="/vote/:eventId" element={<VotingPageWrapper />} />
        
        {/* 大屏展示页 */}
        <Route path="/display/:eventId" element={<DisplayScreenWrapper />} />
        
        {/* 主持人控制台 */}
        <Route path="/control/:eventId" element={<ControlPanelWrapper />} />
        
        {/* 默认重定向到大屏展示页（演示用） */}
        <Route path="/" element={<Navigate to="/display/demo" replace />} />
        
        {/* 404 处理 */}
        <Route path="*" element={
          <div className="error-page">
            <h1>404</h1>
            <p>页面不存在</p>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
