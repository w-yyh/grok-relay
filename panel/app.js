"use strict";
const $ = (selector) => document.querySelector(selector);
let language = GrokRelayI18n.normalize(localStorage.getItem("language"));
const t = (key, values) => GrokRelayI18n.translate(language, key, values);
function applyLanguage(value) {
  language = GrokRelayI18n.normalize(value);
  document.documentElement.lang = language;
  localStorage.setItem("language", language);
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  for (const attr of ["title", "aria-label", "placeholder"]) {
    document
      .querySelectorAll("[data-i18n-" + attr + "]")
      .forEach((el) =>
        el.setAttribute(attr, t(el.getAttribute("data-i18n-" + attr))),
      );
  }
  $("#language").value = language;
}
const viewParams = new URLSearchParams(location.search);
const isNative = viewParams.get("native") === "1";
const isTray = isNative && viewParams.get("mode") === "tray";
document.body.classList.toggle("native", isNative);
document.body.classList.toggle("tray", isTray);
function openNative(view = "activity") {
  return api("/native/main?view=" + encodeURIComponent(view), {}).catch((e) =>
    toast(t(e.message)),
  );
}
let data = null,
  busy = false,
  activeMessage = null,
  toastTimer,
  refreshing = false;
const pending = new Set([
  "queued",
  "sending",
  "waiting_identity",
  "waiting_reply",
]);
const problems = new Set([
  "delivery_unknown",
  "failed",
  "interrupted",
  "completed_without_text",
]);
const labels = {
  queued: "Queued",
  sending: "Sending",
  waiting_identity: "Confirming",
  waiting_reply: "Awaiting reply",
  answered: "Replied",
  delivered: "Delivered",
  delivery_unknown: "Delivery uncertain",
  failed: "Failed",
  interrupted: "Interrupted",
  completed_without_text: "No text reply",
};
function statusLabel(job) {
  if (job.status === "queued") {
    if (!data.running) return t("Paused — message saved");
    if (job.waitReason === "recipient_busy")
      return t("Waiting for Codex to finish");
    if (job.waitReason === "recipient_unavailable")
      return t("Waiting for Codex connection");
  }
  return t(labels[job.status] || job.status);
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const contact = (id) => data?.contacts.find((c) => c.id === id);
const name = (id) =>
  id === "bridge" ? "GrokRelay" : contact(id)?.shortName || id;
const icon = (id) =>
  `<span class="platform-mark ${id.startsWith("codex:") ? "codex-mark" : "grok-mark"}">${id === "bridge" ? "⇄" : id.startsWith("codex:") ? "C" : "G"}</span>`;
const time = (value) =>
  new Date(value).toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
async function api(url, value) {
  const response = await fetch(
    url,
    value === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
  );
  const result = await response.json();
  if (!response.ok) throw Error(result.error || t("Request failed"));
  return result;
}
function switchTab(id) {
  if (isTray && id === "settings") {
    openNative("settings");
    return;
  }
  document
    .querySelectorAll(".view")
    .forEach((el) => (el.hidden = el.id !== id));
  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.classList.toggle("selected", el.dataset.tab === id);
    if (el.dataset.tab === id) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}
const rendered = new Map();
function updateList(selector, html) {
  if (rendered.get(selector) === html) return;
  $(selector).innerHTML = html;
  rendered.set(selector, html);
}
function renderMessages() {
  if (!data) return;
  const query = $("#message-search").value.toLowerCase(),
    filter = $("#message-filter").value;
  const jobs = data.jobs.filter(
    (j) =>
      ($("#show-notices").checked || j.kind !== "notice") &&
      (filter === "all" ||
        (filter === "pending" ? pending : problems).has(j.status)) &&
      `${name(j.from)} ${name(j.to)} ${j.text}`.toLowerCase().includes(query),
  );
  $("#message-count").textContent = jobs.length;
  const html = jobs.length
    ? jobs
        .map(
          (j) =>
            `<button class="message-row" data-message="${escape(j.id)}"><div class="message-top">${icon(j.from)}<strong>${escape(name(j.from))}</strong><time title="${escape(new Date(j.createdAt).toLocaleString(language))}">${time(j.createdAt)}</time></div><div class="message-preview">${escape(j.text)}</div><div class="message-bottom"><span class="recipient">${j.kind === "reply" ? "↩" : "→"} ${escape(name(j.to))}</span><span class="status ${problems.has(j.status) ? "bad" : pending.has(j.status) ? "waiting" : ""}">${escape(statusLabel(j))}</span></div></button>`,
        )
        .join("")
    : `<div class="empty"><strong>${t("No messages yet")}</strong>${t("Messages between your agents will appear here.")}</div>`;
  updateList("#messages", html);
}
function renderContacts() {
  if (!data) return;
  const query = $("#contact-search").value.toLowerCase();
  const list = data.contacts.filter((c) =>
    `${c.name} ${c.id} ${c.aliases.join(" ")}`.toLowerCase().includes(query),
  );
  const html = list.length
    ? ["Codex", "Grok Bot"]
        .map((platform) => {
          const group = list.filter((c) => c.platform === platform);
          if (!group.length) return "";
          return (
            `<div class="group-label">${platform}</div>` +
            group
              .map(
                (c) =>
                  `<div class="contact-row">${icon(c.id)}<div class="contact-copy"><strong title="${escape(c.name)}">${escape(c.shortName)}</strong><small><i class="dot ${data.running && c.route.status === "online" ? "online" : ""}"></i> <code>${escape(c.id)}</code></small></div><div class="contact-actions"><button data-copy="${escape(c.id)}">${t("Copy address")}</button><button data-edit="${escape(c.id)}">${t("Edit")}</button></div></div>`,
              )
              .join("")
          );
        })
        .join("")
    : `<div class="empty"><strong>${t("Add your first contact")}</strong>${t("Connect an existing thread or bot.")}</div>`;
  updateList("#contact-list", html);
}
function countLabel(count, noun) {
  return t("{count} " + noun + (count === 1 ? "" : "s"), { count });
}
function render() {
  const online = data.contacts.filter(
    (c) => c.route.status === "online",
  ).length;
  $("#contact-count").textContent = data.contacts.length;
  $("#connection-label").textContent = busy
    ? t("Updating connection…")
    : !data.running
      ? t("Bridge paused")
      : !data.contacts.length
        ? t("Add contacts to get started")
        : t("{online} / {total} contacts connected", {
            online,
            total: data.contacts.length,
          });
  $("#status-dot").className =
    "dot " +
    (data.running
      ? online === data.contacts.length && online
        ? "online"
        : "problem"
      : "");
  $("#toggle-worker").textContent = data.running ? t("Pause") : t("Start");
  $("#toggle-worker").disabled = busy;
  $("#restart-worker").disabled = busy;
  $("#compose").disabled = data.contacts.length < 2;
  $("#codex-count").textContent = countLabel(
    data.contacts.filter((c) => c.platform === "Codex").length,
    "thread",
  );
  $("#grok-count").textContent =
    countLabel(
      data.contacts.filter(
        (c) => c.platform === "Grok Bot" && c.kind !== "group",
      ).length,
      "agent",
    ) +
    (data.contacts.some((c) => c.kind === "group")
      ? " · " +
        countLabel(
          data.contacts.filter((c) => c.kind === "group").length,
          "group",
        )
      : "");
  $("#last-update").textContent = data.updatedAt
    ? t("Updated {time}", { time: time(data.updatedAt) })
    : t("Local only");
  $("#data-dir").textContent = data.dataDir;
  renderMessages();
  renderContacts();
}
async function refresh() {
  if (document.hidden && data) return;
  if (refreshing) return;
  refreshing = true;
  try {
    data = await api("/api/status");
    if (language !== data.language) applyLanguage(data.language);
    render();
  } catch {
    $("#connection-label").textContent = t("Panel disconnected");
    $("#status-dot").className = "dot problem";
    $("#toggle-worker").disabled = true;
    $("#compose").disabled = true;
  } finally {
    refreshing = false;
  }
}
async function changeWorker(action) {
  busy = true;
  render();
  try {
    data = await api("/api/control", { action });
    toast(
      action === "stop"
        ? t("Paused. Queued messages are retained.")
        : t("Bridge started"),
    );
  } catch (e) {
    toast(t(e.message));
  } finally {
    busy = false;
    await refresh();
  }
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t("Copied"));
  } catch {
    toast(t("Copy failed. Select the text manually."));
  }
}
document
  .querySelectorAll("[data-tab]")
  .forEach((el) => (el.onclick = () => switchTab(el.dataset.tab)));
$("#language").onchange = async () => {
  const select = $("#language");
  select.disabled = true;
  try {
    const saved = await api("/api/preferences", { language: select.value });
    applyLanguage(saved.language);
    if (data) render();
    if (isNative)
      await api("/native/language?value=" + encodeURIComponent(language), {});
    toast(t("Language saved"));
  } catch (e) {
    select.value = language;
    toast(t(e.message));
  } finally {
    select.disabled = false;
  }
};
applyLanguage(language);
$("#settings-shortcut").onclick = () => switchTab("settings");
$("#open-window").onclick = () =>
  isNative
    ? openNative()
    : window.open("/", "grok-relay-panel", "popup=yes,width=520,height=760");
$("#native-open").onclick = () => openNative();
$("#native-quit").onclick = () => {
  $("#native-quit").disabled = true;
  $("#native-quit").textContent = t("Quitting…");
  api("/native/quit", {}).catch((e) => {
    toast(t(e.message));
    $("#native-quit").disabled = false;
  });
};
$("#refresh").onclick = refresh;
$("#toggle-worker").onclick = () =>
  changeWorker(data.running ? "stop" : "start");
$("#restart-worker").onclick = () => changeWorker("restart");
$("#message-search").oninput = renderMessages;
$("#message-filter").onchange = renderMessages;
$("#contact-search").oninput = renderContacts;
$("#show-notices").checked = localStorage.getItem("show-notices") === "true";
$("#show-notices").onchange = () => {
  localStorage.setItem("show-notices", $("#show-notices").checked);
  renderMessages();
};
document
  .querySelectorAll(".close")
  .forEach((el) => (el.onclick = () => el.closest("dialog").close()));
$("#messages").onclick = (event) => {
  const row = event.target.closest("[data-message]");
  if (!row) return;
  if (isTray) {
    openNative("message:" + row.dataset.message);
    return;
  }
  showMessage(row.dataset.message);
};
function showMessage(id) {
  activeMessage = data.jobs.find((j) => j.id === id);
  if (!activeMessage) return;
  $("#detail-title").textContent =
    `${name(activeMessage.from)} → ${name(activeMessage.to)}`;
  $("#detail-meta").textContent =
    new Date(activeMessage.createdAt).toLocaleString(language) +
    " · " +
    statusLabel(activeMessage);
  $("#detail-body").textContent = activeMessage.text;
  $("#detail-error").textContent = activeMessage.error || "";
  $("#detail-error").hidden = !activeMessage.error;
  $("#message-dialog").showModal();
}
$("#detail-copy").onclick = () => copy(activeMessage.text);
$("#compose").onclick = () => {
  if (isTray) {
    openNative("compose");
    return;
  }
  $("#send-text").value = localStorage.getItem("message-draft") || "";
  const options = data.contacts
    .map(
      (c) =>
        `<option value="${escape(c.id)}">${escape(c.shortName)} · ${c.platform}</option>`,
    )
    .join("");
  $("#send-from").innerHTML = options;
  $("#send-to").innerHTML = options;
  $("#send-to").selectedIndex = data.contacts.findIndex(
    (c) => c.platform === "Grok Bot",
  );
  $("#compose-note").textContent = data.running
    ? t("Busy threads are queued. Replies return automatically.")
    : t("Paused. This message will wait until the bridge is started.");
  $("#compose-dialog").showModal();
};
$("#compose-form").onsubmit = async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await api("/api/send", {
      from: $("#send-from").value,
      to: $("#send-to").value,
      text: $("#send-text").value,
    });
    $("#compose-dialog").close();
    $("#send-text").value = "";
    localStorage.removeItem("message-draft");
    toast(t("Message queued"));
    await refresh();
  } catch (e) {
    toast(t(e.message));
  } finally {
    button.disabled = false;
  }
};
function platformFields() {
  const codex = $("#contact-platform").value === "codex";
  const group = $("#contact-platform").value === "grok-group";
  $("#thread-label [data-i18n]").textContent = codex
    ? t("Thread link or ID")
    : group
      ? t("Group ID")
      : t("Bot ID");
  $("#contact-target").placeholder = codex
    ? t("Paste codex://threads/…")
    : group
      ? t("Paste a Grok group ID")
      : t("Paste a Grok Bot ID");
  $("#cwd-label").hidden = !codex;
  $("#contact-cwd").required = codex;
  if (!$("#edit-id").value) $("#contact-id").value = codex ? "codex:" : "grok:";
}
function editContact(id) {
  if (isTray) {
    openNative(id ? "edit:" + id : "add");
    return;
  }
  $("#contact-form").reset();
  const c = id ? contact(id) : null;
  $("#edit-id").value = id || "";
  $("#contact-title").textContent = c ? t("Edit contact") : t("Add contact");
  $("#contact-platform").value =
    c?.kind === "group"
      ? "grok-group"
      : c?.platform === "Grok Bot"
        ? "grok"
        : "codex";
  $("#contact-platform").disabled = !!c;
  $("#contact-id").disabled = !!c;
  platformFields();
  $("#contact-name").value = c?.name || "";
  $("#contact-id").value = c?.id || "codex:";
  $("#contact-target").value = c?.threadId || c?.botId || "";
  $("#contact-cwd").value = c?.cwd || "";
  $("#contact-aliases").value = c?.aliases.join("，") || "";
  $("#delete-contact").hidden = !c;
  $("#contact-dialog").showModal();
}
$("#add-contact").onclick = () => editContact();
$("#contact-platform").onchange = platformFields;
$("#contact-list").onclick = (event) => {
  const edit = event.target.closest("[data-edit]"),
    button = event.target.closest("[data-copy]");
  if (edit) editContact(edit.dataset.edit);
  if (button) copy(button.dataset.copy);
};
function bookWithout(id) {
  const book = { version: 1, codex: [], grok: [] };
  data.contacts
    .filter((c) => c.id !== id)
    .forEach((c) => {
      const { platform, route, shortName, ...saved } = c;
      book[c.threadId ? "codex" : "grok"].push(saved);
    });
  return book;
}
async function saveBook(book, button) {
  button.disabled = true;
  try {
    data = await api("/api/contacts", book);
    $("#contact-dialog").close();
    render();
    toast(t("Contacts updated"));
  } catch (e) {
    toast(t(e.message));
  } finally {
    button.disabled = false;
  }
}
$("#contact-form").onsubmit = (event) => {
  event.preventDefault();
  const selection = $("#contact-platform").value,
    platform = selection === "grok-group" ? "grok" : selection,
    target = $("#contact-target").value.trim();
  const c = {
    id: $("#contact-id").value.trim(),
    name: $("#contact-name").value.trim(),
    aliases: $("#contact-aliases")
      .value.split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  if (!c.id.startsWith(platform + ":")) {
    toast(t("The address must match the selected platform"));
    return;
  }
  if (platform === "codex") {
    c.threadId = target.replace(/^codex:\/\/threads\//, "").split("?")[0];
    c.cwd = $("#contact-cwd").value.trim();
    c.hostId = "local";
  } else {
    c.botId = target;
    if (selection === "grok-group") c.kind = "group";
  }
  const book = bookWithout($("#edit-id").value);
  book[platform].push(c);
  saveBook(book, event.submitter);
};
$("#delete-contact").onclick = (event) =>
  saveBook(bookWithout($("#edit-id").value), event.target);
$("#send-text").oninput = () =>
  localStorage.setItem("message-draft", $("#send-text").value);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
refresh().then(() => {
  const view = viewParams.get("view") || "activity";
  if (view === "compose") $("#compose").click();
  else if (view.startsWith("message:")) showMessage(view.slice(8));
  else if (view.startsWith("edit:")) {
    switchTab("contacts");
    editContact(view.slice(5));
  } else if (view === "add") {
    switchTab("contacts");
    editContact();
  } else if (["contacts", "settings", "activity"].includes(view))
    switchTab(view);
});
setInterval(refresh, 4000);
