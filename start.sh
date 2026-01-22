#!/bin/bash

# 获取局域网 IP
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

if [ -z "$IP" ]; then
  echo "❌ 无法获取局域网 IP，请检查网络连接"
  exit 1
fi

PORT=5800
EVENT_ID="00000000-0000-0000-0000-000000000001"

echo ""
echo "🚀 实时投票系统启动中..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 投票页:    http://$IP:$PORT/vote/$EVENT_ID"
echo "🖥️  大屏展示:  http://$IP:$PORT/display/$EVENT_ID"
echo "🎛️  控制台:   http://$IP:$PORT/control/$EVENT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
