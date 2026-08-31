export function appendAdvisorPreference(history, draft, limit = 8) {
  const messages = Array.isArray(history) ? history : [];
  const preference = typeof draft === 'string'
    ? draft.replace(/\s+/g, ' ').trim()
    : '';

  if (!preference) return messages.slice(-limit);

  return [...messages, preference].slice(-limit);
}
