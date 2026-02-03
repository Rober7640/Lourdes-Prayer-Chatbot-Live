// Typing simulation utilities for natural chat experience

/**
 * Promise-based sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a unique ID for chat items
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

/**
 * Calculate delay between characters for typing simulation
 * Returns ms per character with natural variance
 */
export function getCharacterDelay(): number {
  return 0 // Disabled for testing
}

/**
 * Calculate pause between consecutive messages
 */
export function calculatePauseBetweenMessages(): number {
  return 0 // Disabled for testing
}

/**
 * Calculate initial "thinking" delay before typing starts
 */
export function calculateThinkingDelay(): number {
  return 0 // Disabled for testing
}

/**
 * Chunk a long message into smaller pieces (max 30 words)
 * Only chunks if message is significantly over the limit
 * Backend already chunks to ~25 words, so this is a safety net
 */
export function chunkMessage(text: string, maxWords: number = 30): string[] {
  const words = text.split(' ')

  // Don't chunk if under limit - backend already handles this
  if (words.length <= maxWords) {
    return [text]
  }

  // Only chunk very long messages that somehow got through
  const chunks: string[] = []
  let currentWords: string[] = []

  for (const word of words) {
    currentWords.push(word)

    const currentText = currentWords.join(' ')

    // Check if we're at a good break point (sentence end) and over minimum
    const atSentenceEnd = /[.!?]$/.test(word)
    const overMinimum = currentWords.length >= 15
    const atLimit = currentWords.length >= maxWords

    if ((atSentenceEnd && overMinimum) || atLimit) {
      chunks.push(currentText)
      currentWords = []
    }
  }

  // Add remaining words
  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' '))
  }

  return chunks
}
