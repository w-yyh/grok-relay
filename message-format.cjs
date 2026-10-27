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
function reconcileIdentities(jobs, contactId, entries) {
  const used = new Set(
    jobs
      .filter((j) => j.to === contactId && j.requestId)
      .map((j) => j.requestId),
  );
  const changed = [];
  for (const entry of [...entries].sort(
    (a, b) => a.timestampMs - b.timestampMs,
  )) {
    if (
      entry.kind !== "message" ||
      !entry.requestId ||
      used.has(entry.requestId)
    )
      continue;
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
    job.requestId = entry.requestId;
    if (job.kind === "message") job.status = "waiting_reply";
    else job.status = "delivered";
    job.deliveredAt = new Date(entry.timestampMs).toISOString();
    delete job.error;
    used.add(entry.requestId);
    changed.push(job.id);
  }
  return changed;
}
module.exports = { displayName, formatMessage, reconcileIdentities };
