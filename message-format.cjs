// Display text is deliberately independent of transport IDs and queue metadata.
function displayName(contact) {
  return contact.shortName || contact.name.split(/[（｜|]/)[0].trim();
}
function formatMessage(job, lookup) {
  if (job.kind === "notice") return "GrokRelay\n\n" + job.text;
  const from =
    job.from === "bridge" ? "Operator" : displayName(lookup(job.from));
  return (
    from +
    " · " +
    (job.kind === "reply" ? "Reply" : "Message") +
    "\n\n" +
    job.text
  );
}
// Older deliveries used a visible ID. New deliveries correlate the actual user
// message and timestamp in the transcript, without adding IDs to the chat.
function reconcileIdentities(jobs, contactId, entries, isGroup = false) {
  const used = new Set(
    jobs
      .filter((j) => j.to === contactId && j.requestId)
      .map((j) => j.requestId),
  );
  const changed = [];
  for (const entry of [...entries].sort(
    (a, b) => a.timestampMs - b.timestampMs,
  )) {
    // Group user posts have a client nonce and a conversation-turn ID, but no
    // requestId. Scope replies to that turn, never to the whole group history.
    const groupTurn =
      isGroup && /^t[0-9a-z]+u$/.test(entry.id || "")
        ? entry.id.slice(0, -1)
        : null;
    const identity =
      entry.requestId || (groupTurn ? "group:" + entry.id : null);
    if (entry.kind !== "message" || !identity || used.has(identity)) continue;
    const body = typeof entry.content === "string" ? entry.content : "";
    const job = jobs.find(
      (j) =>
        j.to === contactId &&
        !j.requestId &&
        j.attemptedAt &&
        entry.timestampMs >= Date.parse(j.attemptedAt) - 2000 &&
        (j.wireText
          ? body === j.wireText
          : body.includes("\u6d88\u606f\u7f16\u53f7 " + j.id + "\u3011")),
    );
    if (!job) continue;
    job.requestId = identity;
    if (groupTurn) job.groupTurnId = groupTurn;
    if (job.kind === "message") job.status = "waiting_reply";
    else job.status = "delivered";
    job.deliveredAt = new Date(entry.timestampMs).toISOString();
    delete job.error;
    used.add(identity);
    changed.push(job.id);
  }
  return changed;
}
function matchesReply(job, entry) {
  if (job.groupTurnId) {
    const prefix = job.groupTurnId + "s";
    return (
      entry.kind === "send-message" &&
      entry.id?.startsWith(prefix) &&
      /^[0-9a-z]+$/.test(entry.id.slice(prefix.length))
    );
  }
  return !!job.requestId && job.requestId === entry.requestId;
}
module.exports = {
  displayName,
  formatMessage,
  reconcileIdentities,
  matchesReply,
};
