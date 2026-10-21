# 0.3.0 进度

更新日期：2026-10-21（Asia/Singapore）。

已生成：每日扫描重置 / 显式恢复、后台串行队列和扫描批次校验、账号分区及旧版备份、触控拖动与视口限制、主页补录入口、Firefox 独立包、Safari 转换源、检查与发布工作流。

新增验收用例：旧批次拒绝、跨日期、取关去重与保留、今日日志去重、跨来源后台串行、迁移备份、跨标签暂停 / 恢复、账号切换与延迟响应、窄屏真实触摸拖动。

当前阶段：代码生成完成，主 Agent 待统一执行单元测试、清单检查、模拟浏览器测试及打包。子 Agent 未运行 build / test / typecheck / lint，不将生成的用例视为通过。

待实机：Firefox 桌面、Firefox Android、iPhone Safari。Firefox unsigned XPI 仍需 AMO 签名 / 上架；Safari 源码仍需 Mac / Xcode 转换、签名及设备验证。安卓 Chrome、iOS Chrome、X App 无扩展运行入口。
