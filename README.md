# 盘口分析工作台 V17

## 功能
- Railway 云端部署
- Sportmonks 全球赛事接口
- 今日比赛 / 滚球 / 搜索 / 自动刷新
- 比赛库、盘口、时间轴、计算、凯利、统计、复盘
- 云端账号同步
- iPhone Safari 适配

## Railway
1. GitHub 上传这 5 个文件。
2. Railway 连接该 GitHub 仓库。
3. Variables 添加：
   - APP_SECRET：自己生成的长随机字符串
   - SPORTMONKS_API_TOKEN：从 MySportmonks 创建的 Token
4. Start Command 使用 `npm start`。
5. 打开 Railway Domains 里的公网网址。
6. 先访问 `/health`，看到 `"ok":true,"version":17` 即后端正常。

## 注意
SPORTMONKS_API_TOKEN 只放 Railway Variables，不要写进 GitHub。
Sportmonks 可用赛事范围取决于你的套餐。
JSON 数据库适合个人测试；长期大量使用建议升级 PostgreSQL。
