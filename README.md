# 盘口分析工作台 V15 云端正式版

## 功能
- 比赛库、盘口事件、时间轴、盘口矩阵
- 亚洲让球、大小球计算
- 欧赔、概率、EV、Kelly 数学计算
- 异常评分、长期 ROI、回撤、复盘
- 本地数据备份/恢复
- 云端注册、登录、上传、拉取
- 手机 Safari 响应式界面

## Render 部署
1. Node.js 18+
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Environment Variable: `APP_SECRET`，设置一串随机长字符串
5. Health Check Path: `/health`

## 注意
当前版本使用 JSON 文件作为轻量个人/小规模数据存储。Render 普通服务的本地文件系统不适合作为长期可靠数据库；长期使用建议升级到 PostgreSQL，并做好备份。

赔率数据接口只应接入你有权使用的合法数据源。
