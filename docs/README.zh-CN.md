# GrokRelay

[English](../README.md) · [Agent 使用指南](AGENT_GUIDE.md) · [安装说明](SETUP.md)

让 Grok Bot 员工与 **已有的 Codex 桌面对话**直接收发消息。双方继续使用原对话和上下文，操作者能在原窗口看到交流过程；不另起 Codex CLI 模型会话。

## 适用场景

- 内容或研究 Agent 把需求发给现有开发对话。
- 开发 Agent 向专长 Agent 询问信息，并在原线程收到答复。
- 希望观察跨 Agent 协作，同时保持各自原有工作方式。

它只负责通讯录、寻址、排队、投递和回信，不替双方做任务审批或业务决定。

## 开始使用

需要 Windows、Node.js 22.19+、PowerShell 7，以及已登录的两端桌面应用。先按 [Setup](SETUP.md) 登记真实联系人；仓库内所有示例都是虚构的，通讯录模板为空。

```powershell
git clone https://github.com/w-yyh/grok-relay.git
cd grok-relay
npm ci --ignore-scripts
node bridge.cjs init --file C:\path\to\contacts.json
node bridge.cjs doctor --json
node bridge.cjs start
```

Agent 可以调用 JSON 命令查询联系人、发信和读取回执，也可以在原对话中独立输出发送块。地址必须来自自己的通讯录：

```text
[[bridge:send codex:website]]
请检查这份示例文案并回复修改建议。
[[/bridge]]
```

收到 **Message** 后正常回复，桥梁自动回传。收到 **Reply** 后若要继续交流，请明确发起新消息。普通聊天和引用示例不会转发。`queued` 只代表已入队，`answered` 也不代表业务任务已经成功完成。

## 轻量桌面界面

可选的原生壳采用 Go + Wails + 系统 WebView2。按需创建窗口，弹窗隐藏后释放，关闭主窗口后仍可保留托盘。构建还需 Go：

```powershell
npm run build:desktop
npm start
```

这是 **Windows 公共 Alpha 版本**。传输依赖内部或非官方稳定接口；原生交互、DPI和全进程内存仍待完整验收。没有承诺固定内存占用或生产级稳定性，具体见 [Compatibility](COMPATIBILITY.md)。

## 隐私和许可

真实配置和消息默认保存在 `%LOCALAPPDATA%\GrokRelay`，不会随源码分发。不要公开通讯录、令牌、运行日志、真实聊天截图或本机快捷方式。消息仍会经过所连接产品的服务，详情见 [Privacy](PRIVACY.md)。

MIT 许可。英文文档是主要维护版本。
