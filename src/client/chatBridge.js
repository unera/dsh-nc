/**
 * Bridge from the file viewer back to the conversation.
 *
 * The browser half knows nothing about sessions and drafts, so the plugin body
 * installs an implementation here: one function that appends a reference line to
 * the current session draft and brings the chat view back.
 */

let impl = null

/**
 * Install the implementation.
 * @param fn - receives `{ sessionId, text }` and returns whether it worked.
 */
export function setChatBridge(fn) {
  impl = typeof fn === 'function' ? fn : null
}

/**
 * Append a comment reference to the chat draft and go back to the chat.
 * @param payload - session identity and the reference text.
 * @returns whether the bridge handled it.
 */
export function sendCommentToChat(payload) {
  if (!impl) return false
  try {
    return impl(payload) !== false
  } catch {
    return false
  }
}
