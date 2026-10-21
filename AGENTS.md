# X Daily Rings 项目规则

本目录是独立的 X 浏览器扩展，与祖先目录中的旧 tarot 项目无关。

- 运行文件为 manifest.json、manifest.firefox.json、hook.js、model.js、state.js、background.js、content.js。
- 只观察 X 自己的网络响应与已加载页面；禁止额外 X API、自动滚动、自动发帖、自动取关。
- 所有存储修改通过 background.js 的串行队列；每日扫描使用批次号，重置不能被旧扫描写回。
- 用户数据按当前登录的 X @ID 分区；旧版本数据保留备份，首次识别账号时绑定并明确提示。
- Chrome 桌面和 Firefox 使用独立清单。Firefox Android 未实机验证时必须如实记录；不得宣称 Android Chrome / iOS Chrome 可运行扩展。
- 主 Agent 统一执行 npm test、npm run test:browser 和 python scripts/package.py。子 Agent 只生成改动，不运行这些检查。
- 不操作个人真实 X 账号发帖或取关。用模拟页面验证。
- 运行改动同步更新版本、CHANGELOG.md、README.md、progress.md、feature_list.json、检查与发布工作流。
