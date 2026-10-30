const { normalizedText } = require("./message-format.cjs");

function userText(item) {
  if (!["userMessage", "steeringUserMessage"].includes(item.type)) return null;
  if (typeof item.text === "string") return item.text;
  if (Array.isArray(item.content))
    return item.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  const input = item.input || item.restoreMessage?.request?.input;
  if (Array.isArray(input))
    return input
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  return null;
}

function reconcileCodex(jobs, contactId, turns) {
  const changed = [];
  const used = new Set(
    jobs
      .filter((j) => j.to === contactId && j.codexItemId)
      .map((j) => j.codexItemId),
  );
  for (const turn of turns) {
    for (const item of turn.items || []) {
      if (item.status === "pending" || item.status === "failed") continue;
      const body = userText(item);
      if (body == null || used.has(item.id)) continue;
      const job = jobs.find(
        (j) =>
          j.to === contactId &&
          ["delivery_unknown", "sending"].includes(j.status) &&
          j.attemptedAt &&
          ((j.clientMessageId &&
            (item.clientId === j.clientMessageId ||
              item.clientUserMessageId === j.clientMessageId)) ||
            (turn.turnStartedAtMs >= Date.parse(j.attemptedAt) - 2000 &&
              normalizedText(body) === normalizedText(j.wireText))),
      );
      if (!job) continue;
      job.turnId = turn.turnId || turn.id;
      job.codexItemId = item.id;
      job.status = job.kind === "message" ? "waiting_reply" : "delivered";
      job.deliveredAt ||= new Date().toISOString();
      delete job.error;
      used.add(item.id);
      changed.push(job.id);
    }
  }
  return changed;
}
function nextContactToRead(contacts, nextPoll, active, now = Date.now()) {
  return contacts
    .filter((c) => !active.has(c.id) && (nextPoll.get(c.id) || 0) <= now)
    .sort((a, b) => (nextPoll.get(a.id) || 0) - (nextPoll.get(b.id) || 0))[0];
}
module.exports = { reconcileCodex, userText, nextContactToRead };
