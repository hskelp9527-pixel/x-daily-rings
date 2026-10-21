# X Daily Rings · 每日输出环

在 X 网页显示今天的发帖、回复、引用数量，扫描已加载的关注名单，并支持清空今日扫描后重新扫描。数据仅保存在当前浏览器，不需要云端。

[下载](https://github.com/hskelp9527-pixel/x-daily-rings/releases/latest) · [反馈](https://github.com/hskelp9527-pixel/x-daily-rings/issues/new/choose)

## 0.3.0 的使用方式

- **输出环**：三个每日目标，按浏览器当地日期切换。点 ⚙ 修改目标；25%、50%、75% 和完成时给出鼓励。
- **补录另一设备发布的内容**：在当前设备打开自己的 X 主页「回复」标签，手动向下滚动加载今天的内容，插件读取 X 自己的时间线响应，按帖子 ID 去重。也可点「补录当前页面」核对本页已经读到的内容。不会自动滚动或主动请求 X；未加载的内容、已删内容无法补回。
- **关注名单扫描**：打开自己的「正在关注」页面，读取当前加载的用户，显示「已扫描 / 没回关 / 今日取关」，未回关的行标红。只认当前登录账号的关注页。
- **重置今日扫描**：仅清除今天「已扫描」「没回关」的计数并暂停扫描。按钮变为「重新扫描」；再次点击会扫描当前已经加载的名单，之后继续手动滚动可补充。输出环、目标、今日取关、历史记录保留。其他标签页也一起暂停，旧批次的延迟回调不能把数据写回来。
- **取关**：仍然手动点 X 自己的按钮；只有成功响应才记录。今日取关按用户去重。已经取关的人不会因另一个标签页里残留的旧按钮重新变成在关注。
- **拖动与收起**：拖动卡片标题，点 – 收起；支持鼠标与触摸。卡片限制在可见区域内，窄屏底部预留导航位置。
- **关注限速提醒**：识别 X 的限速失败，默认等待 30 分钟。点 ⏱ 可以修改为 1–1440 分钟。等待时间是经验值，X 没有公开固定解除规则；页面都关掉时不会主动提醒。
- **导出**：导出当前账号的每日数量、逐条 ID / 类型 / 时间、目标、没回关 / 已取关名单和旧版备份。

这是一种按当前页面重新获取信息的方式：手机与电脑各自扫描，并非设备间自动同步。没有在当前设备加载过的完整名单、过去日期的设备记录和另一台设备的目标设置不会自动出现。

## 账号与旧版数据

新数据按当前登录账号的 **@ID** 分区，切换账号会切换面板，延迟到达的上一账号响应不会计入当前账号。账号未识别时不记录；切换时未完成的响应可在自己的主页重新加载后补录。

旧版本没有保存所属账号，因此升级后会把旧记录绑定到**首次识别到的账号**，卡片明确显示绑定提示。升级前建议先在旧版导出，并确保先打开旧数据所属的 X 账号。原始旧数据另保留在 `legacyBackup`，不会因扫描重置删除；导出包含 `legacyBoundTo` 和原始备份。@ID 改名会被视为另一分区，可先导出保留原数据。

## 浏览器与手机

| 平台 | 支持状态与安装途径 |
| --- | --- |
| Windows / macOS Chrome、Edge | 使用 `x-daily-rings.zip`，开发者模式加载解压目录 |
| 桌面 Firefox | 使用独立 Firefox 包，Firefox 140+；开发时可在 `about:debugging` 临时加载解压目录的 manifest.json |
| 安卓 Firefox | 已提供 Firefox 140+ 清单和触控布局，**尚未安卓实机验证**。正式安装需要 AMO 签名 / 上架；仓库中的 unsigned XPI 不能当作普通用户可直接安装的已签名插件 |
| 安卓 Chrome | 不支持这种扩展，手机端请使用 Firefox 等支持扩展的浏览器 |
| iPhone Safari | 提供 Safari 转换源包，尚未转换、签名或实机验证。需在 Mac 上用 Xcode 转为 Safari Web Extension App 并签名安装 |
| iPhone Chrome / X App | 无法加载本插件 |

Firefox 包与 Chrome 包的运行代码相同，但后台清单不同：Chrome 使用 service worker，Firefox 使用 background scripts。网络观察脚本在 MAIN world 运行；跨 world 事件只传 JSON 字符串，避免 Firefox 对扩展世界对象访问的限制。

Safari 转换源包 `x-daily-rings-safari-source.zip` 解压后，可在 Mac 上执行 `xcrun safari-web-extension-converter <解压目录>`。这是待适配的源码入口，不是可安装的 iOS App，Windows 上不能完成 Xcode 签名。

## 桌面安装与更新

1. 下载 `x-daily-rings.zip` 并解压到长期保留的目录。
2. 打开 `chrome://extensions` 或 `edge://extensions`，启用开发者模式。
3. 选择「加载已解压的扩展程序」，选中含 manifest.json 的目录，再刷新 X。

更新前点「导出」备份，用新版本覆盖原目录，在扩展管理页重新加载，再刷新 X。不要卸载重装，卸载会清除本机存储。

## 数据与边界

只观察 X 网页自己的网络响应和已加载用户行，不发送额外 X API 请求，不自动翻页、不自动发帖、不自动取关。只有 storage 权限，无服务器、统计或云同步。Chrome 与 Firefox 的所有修改都经扩展后台串行处理，x.com / twitter.com 和多个标签页共同使用同一个队列。

纯转帖不计入，编辑按原始 ID 去重，删除不会扣回，回复自己算发帖。引用正文里嵌入的本人帖子不会再计一次。插件依赖 X 页面结构与响应格式，改版可能需要更新。计数与扫描不代表 X 的官方后台完整数据。

## 开发、检查与发布

运行不需要构建。Node.js 22+，Python 3：

```sh
npm ci
npm test
npm run check:manifests
npx playwright-core install --with-deps chromium
npm run test:browser
python scripts/package.py
```

浏览器测试只使用模拟 X 网页、临时浏览器资料，不登录真实账号，也不真实发帖或取关。默认用 Windows 上已安装的 Edge，否则用 Playwright Chromium；可用 BROWSER_PATH 指定。测试覆盖请求观察、补录、取关、重置、跨标签暂停、账号隔离、延迟响应、拖动、窄屏触摸和持久化。Firefox 清单检查仅是静态检查，不能替代 Firefox Android 实机验收。

打包在 dist/ 生成 Chrome ZIP、Firefox ZIP、Firefox unsigned XPI 和 Safari 转换源码 ZIP。检查与 tag 发布工作流均先执行单元测试、清单检查、安装 Linux Chromium、真实扩展浏览器测试，再打包；失败不发布。具体记录见 progress.md 和 feature_list.json。

同系列：[记得 @](https://github.com/hskelp9527-pixel/x-mention-saver)。MIT；独立项目，与 X Corp 无隶属关系。
