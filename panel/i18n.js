"use strict";
// English message IDs are the fallback text. User content is never translated.
(() => {
  const zh = {
    "Grok Bot group": "Grok Bot 群聊",
    "Group ID": "群聊 ID",
    "Paste a Grok group ID": "粘贴 Grok 群聊 ID",
    "{count} group": "{count} 个群聊",
    "{count} groups": "{count} 个群聊",
    "Paused — message saved": "已暂停，消息已保存",
    "Waiting for Codex to finish": "等待 Codex 当前任务结束",
    "Waiting for Codex connection": "等待 Codex 连接",
    "Open main window": "打开主窗口",
    Refresh: "刷新",
    Settings: "设置",
    Navigation: "导航",
    Messages: "消息",
    Contacts: "联系人",
    "Connecting…": "连接中…",
    Start: "启动",
    Pause: "暂停",
    "Two-way messaging": "双向通信",
    "Existing conversations. Both sides visible.":
      "在原有对话中通信，两边均可查看。",
    "Recent messages": "最近消息",
    Compose: "写消息",
    "Search messages or contacts": "搜索消息或联系人",
    "Message status": "消息状态",
    All: "全部",
    Pending: "待处理",
    Attention: "需要关注",
    "Loading messages…": "正在加载消息…",
    "Add contact +": "添加联系人 +",
    "Register a contact once. Agents can find it by address.":
      "登记联系人后，Agent 即可通过地址找到对方。",
    "Search name, address or alias": "搜索名称、地址或别名",
    "Search contacts": "搜索联系人",
    "Keep communication simple": "让通信保持简单",
    Language: "语言",
    "Choose the interface language.": "选择界面语言。",
    "Compact messages": "简洁消息",
    "Only the sender, message type and body.": "仅包含发件人、消息类型和正文。",
    Enabled: "已启用",
    "Show service notices": "显示服务通知",
    "Include setup notices in the message list.": "在消息列表中显示配置通知。",
    "Background relay": "后台通信",
    "Keep relaying with the window closed. Pause retains the queue.":
      "关闭窗口后继续通信；暂停时保留队列。",
    Reconnect: "重新连接",
    "How agents connect": "Agent 如何联系对方",
    "Ask an agent to contact a registered address. It emits a standalone envelope in its original conversation.":
      "让 Agent 联系已登记的地址，它会在原对话中单独输出发送格式。",
    "Reply normally to an incoming message. To continue after a reply, send a new envelope.":
      "收到来信后正常回复即可。收到回信后如需继续交流，请再发起一条消息。",
    "Only explicit messages are routed. Ordinary chat and quoted examples stay local.":
      "只转发明确发起的消息，普通聊天和引用示例不会发送。",
    "About GrokRelay": "关于 GrokRelay",
    "Windows desktop companion · MIT License": "Windows 桌面组件 · MIT 许可证",
    "Connect existing conversations. Each agent keeps its own context and responsibilities. The bridge only delivers messages.":
      "连接现有对话，各 Agent 保留自己的上下文和职责。通讯桥只负责投递消息。",
    "Runtime and compatibility": "运行与兼容性",
    "Both desktop apps must be available. Active Codex conversations receive messages immediately. Network failures are checked before resending. No startup registration.":
      "两端桌面应用需要可用。消息会立即追加到正在运行的 Codex 对话；网络异常时先核对原对话再考虑重发。未设置开机自启。",
    "Adapters use internal desktop interfaces and may break after updates. Text and links only; attachments are not transferred.":
      "适配器使用桌面内部接口，应用更新后可能需要适配。目前仅传递文字和链接，不传递附件。",
    "Local data directory": "本地数据目录",
    "Local connection": "本地连接",
    "Open GrokRelay": "打开 GrokRelay",
    Quit: "退出",
    Close: "关闭",
    "Send on behalf of the selected contact. Replies return to its original conversation.":
      "以所选联系人的身份发送，回信自动返回其原对话。",
    From: "发件人",
    To: "收件人",
    Message: "消息",
    "What does the other agent need to know?": "需要告诉对方什么？",
    Cancel: "取消",
    "Send message": "发送消息",
    "Add contact": "添加联系人",
    Platform: "平台",
    "Display name": "显示名称",
    "Example: Website developer": "例如：网站开发员",
    Address: "地址",
    "Thread link or ID": "对话链接或 ID",
    "Paste codex://threads/…": "粘贴 codex://threads/…",
    "Workspace path": "工作区路径",
    Aliases: "别名",
    "Optional, comma-separated": "选填，用逗号分隔",
    "Saving reconnects the bridge. First registration starts with new messages only. Introduce the address and envelope format to both agents.":
      "保存后将重新连接。首次登记只监听新消息。请告知双方 Agent 联系地址与发送格式。",
    "Remove contact": "移除联系人",
    "Save contact": "保存联系人",
    "Copy message": "复制消息",
    Done: "完成",
    Queued: "排队中",
    Sending: "发送中",
    Confirming: "确认中",
    "Awaiting reply": "等待回信",
    Replied: "已回复",
    Delivered: "已送达",
    "Delivery uncertain": "送达状态不确定",
    Failed: "失败",
    Interrupted: "已中断",
    "No text reply": "无文字回复",
    "No messages yet": "暂无消息",
    "Messages between your agents will appear here.":
      "Agent 之间的消息将显示在这里。",
    "Copy address": "复制地址",
    Edit: "编辑",
    "Add your first contact": "添加第一位联系人",
    "Connect an existing thread or bot.": "接入现有对话或 Bot。",
    "Updating connection…": "正在更新连接…",
    "Bridge paused": "通讯桥已暂停",
    "Add contacts to get started": "添加联系人以开始使用",
    "{online} / {total} contacts connected":
      "{online} / {total} 个联系人已连接",
    "{count} thread": "{count} 个对话",
    "{count} threads": "{count} 个对话",
    "{count} agent": "{count} 位员工",
    "{count} agents": "{count} 位员工",
    "Updated {time}": "更新于 {time}",
    "Local only": "仅本机",
    "Panel disconnected": "面板连接已断开",
    "Paused. Queued messages are retained.": "已暂停，排队中的消息已保留。",
    "Bridge started": "通讯桥已启动",
    Copied: "已复制",
    "Copy failed. Select the text manually.": "复制失败，请手动选择文字复制。",
    "Quitting…": "正在退出…",
    "Messages enter active conversations immediately. Replies return automatically.":
      "消息会立即进入正在运行的对话，回信自动返回。",
    "Paused. This message will wait until the bridge is started.":
      "当前已暂停，消息将在通讯桥启动后发送。",
    "Message queued": "消息已加入队列",
    "Bot ID": "Bot ID",
    "Paste a Grok Bot ID": "粘贴 Grok Bot ID",
    "Edit contact": "编辑联系人",
    "Contacts updated": "联系人已更新",
    "The address must match the selected platform": "地址必须与所选平台一致",
    "Request failed": "请求失败",
    "Language saved": "语言设置已保存",
    "Select registered contacts": "请选择已登记的联系人",
    "Sender and recipient must differ": "发件人与收件人不能相同",
    "A message body is required": "请输入消息正文",
    "Settings are being applied; try again shortly": "设置正在应用，请稍后重试",
    "A contact with pending messages cannot be removed":
      "联系人仍有待处理消息，暂时无法移除",
    "A request is still finishing; try again shortly":
      "请求仍在结束中，请稍后重试",
    "Unsupported language": "不支持此语言",
  };
  const normalize = (value) => (value === "zh-CN" ? "zh-CN" : "en");
  function translate(language, key, values = {}) {
    const text = normalize(language) === "zh-CN" ? zh[key] || key : key;
    return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  }
  const api = { normalize, translate, zh };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.GrokRelayI18n = api;
})();
