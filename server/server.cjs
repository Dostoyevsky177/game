/**
 * 本地投票系统后端服务
 * 使用 JSON 文件存储数据
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4396;

// 中间件
app.use(cors());
app.use(express.json());

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

// 读取数据文件
function readEventsData() {
    try {
        const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { events: {}, questions: {} };
    }
}

function readVotesData() {
    try {
        const data = fs.readFileSync(VOTES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { votes: [] };
    }
}

// 写入数据文件
function writeEventsData(data) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
}

function writeVotesData(data) {
    fs.writeFileSync(VOTES_FILE, JSON.stringify(data, null, 2));
}

// ==================== API 接口 ====================

/**
 * GET /api/events/:eventId
 * 获取活动信息（包含 currentQuestionId）
 */
app.get('/api/events/:eventId', (req, res) => {
    const { eventId } = req.params;
    const data = readEventsData();
    const event = data.events[eventId];

    if (!event) {
        return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
});

/**
 * GET /api/events/:eventId/questions
 * 获取活动的所有问题
 */
app.get('/api/events/:eventId/questions', (req, res) => {
    const { eventId } = req.params;
    const data = readEventsData();

    const questions = Object.values(data.questions)
        .filter(q => q.eventId === eventId)
        .sort((a, b) => a.order - b.order);

    res.json(questions);
});

/**
 * GET /api/questions/:questionId/votes
 * 获取问题的所有投票
 */
app.get('/api/questions/:questionId/votes', (req, res) => {
    const { questionId } = req.params;
    const data = readVotesData();

    const votes = data.votes.filter(v => v.questionId === questionId);
    res.json(votes);
});

/**
 * POST /api/votes
 * 提交或更新投票（如果已投票则更新选项）
 */
app.post('/api/votes', (req, res) => {
    const { questionId, optionId, deviceId } = req.body;

    if (!questionId || !optionId || !deviceId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const data = readVotesData();

    // 检查是否已投票（同设备同问题）
    const existingVoteIndex = data.votes.findIndex(
        v => v.questionId === questionId && v.deviceId === deviceId
    );

    if (existingVoteIndex !== -1) {
        // 已投票，更新选项
        data.votes[existingVoteIndex].optionId = optionId;
        data.votes[existingVoteIndex].timestamp = new Date().toISOString();
        writeVotesData(data);
        return res.json({ ...data.votes[existingVoteIndex], updated: true });
    }

    // 新投票
    const vote = {
        id: `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        questionId,
        optionId,
        deviceId,
        timestamp: new Date().toISOString()
    };

    data.votes.push(vote);
    writeVotesData(data);

    res.status(201).json(vote);
});

/**
 * GET /api/devices/:deviceId/votes
 * 获取指定设备的所有投票记录
 */
app.get('/api/devices/:deviceId/votes', (req, res) => {
    const { deviceId } = req.params;
    const data = readVotesData();

    const votes = data.votes.filter(v => v.deviceId === deviceId);
    res.json(votes);
});

/**
 * PUT /api/events/:eventId/current-question
 * 设置当前问题
 */
app.put('/api/events/:eventId/current-question', (req, res) => {
    const { eventId } = req.params;
    const { questionId } = req.body;

    if (!questionId) {
        return res.status(400).json({ error: 'Missing questionId' });
    }

    const data = readEventsData();

    if (!data.events[eventId]) {
        return res.status(404).json({ error: 'Event not found' });
    }

    data.events[eventId].currentQuestionId = questionId;
    writeEventsData(data);

    res.json({ success: true });
});

/**
 * DELETE /api/questions/:questionId/votes
 * 清空问题的所有投票
 */
app.delete('/api/questions/:questionId/votes', (req, res) => {
    const { questionId } = req.params;
    const votesData = readVotesData();
    const eventsData = readEventsData();

    // 删除该问题的所有投票
    votesData.votes = votesData.votes.filter(v => v.questionId !== questionId);
    writeVotesData(votesData);

    // 更新 clearedQuestionId 通知前端
    const question = eventsData.questions[questionId];
    if (question) {
        const eventId = question.eventId;
        if (eventsData.events[eventId]) {
            eventsData.events[eventId].clearedQuestionId = questionId;
            writeEventsData(eventsData);
        }
    }

    res.json({ success: true });
});

/**
 * GET /api/events/:eventId/cleared
 * 获取清空状态（用于轮询检测投票清空事件）
 */
app.get('/api/events/:eventId/cleared', (req, res) => {
    const { eventId } = req.params;
    const data = readEventsData();
    const event = data.events[eventId];

    if (!event) {
        return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ clearedQuestionId: event.clearedQuestionId });
});

/**
 * POST /api/events/:eventId/clear-notification
 * 清除清空通知（前端收到后调用）
 */
app.post('/api/events/:eventId/clear-notification', (req, res) => {
    const { eventId } = req.params;
    const data = readEventsData();

    if (data.events[eventId]) {
        data.events[eventId].clearedQuestionId = null;
        writeEventsData(data);
    }

    res.json({ success: true });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 投票系统后端服务已启动: http://localhost:${PORT}`);
    console.log(`📁 数据目录: ${DATA_DIR}`);
});
