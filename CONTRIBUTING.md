# 参与贡献

欢迎通过 Issues 报告问题或建议功能。提交问题时请说明浏览器版本、插件版本、重现步骤和实际结果；截图请先去掉不想公开的个人信息。

提交改动前运行 `npm ci`、`npm test`、`npm run check:manifests`。涉及卡片、计数或高亮时运行 `npm run test:browser`；使用模拟 X 页面和临时浏览器资料，不操作真实账号发帖或取关。Linux 先执行 `npx playwright-core install --with-deps chromium`。插件无需构建；避免添加与功能无关的权限和运行时依赖。

请让每个 PR 聚焦一个问题，说明用户能看到的变化、验证方式和已知限制。运行文件变化时同步更新两个 manifest、package / lock 版本、CHANGELOG、progress 与 feature_list。所有写入走后台队列；扫描写入携带 epoch / 日期，不能绕过账号分区或重置暂停。发布前运行 `python scripts/package.py`。Firefox Android 与 Safari 必须分别记录真实设备验证状态，不以 Chromium 手机尺寸模拟替代实机结果。
