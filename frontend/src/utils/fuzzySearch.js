/**
 * Prefix-based fuzzy search helper.
 * Enforces that query tokens match strictly at the BEGINNING (prefix) of words/tokens in the target content.
 * 
 * @param {string | string[] | Record<string, any>} target - Target text, array of texts, or object values.
 * @param {string} query - The user search query.
 * @returns {boolean} True if every query token matches the start of a word in the target content.
 */
export function fuzzyMatch(target, query) {
  if (!query || !query.trim()) return true
  if (!target) return false

  let rawStrings = []

  if (typeof target === 'string') {
    rawStrings = [target]
  } else if (Array.isArray(target)) {
    rawStrings = target.flat(Infinity).filter(Boolean).map(String)
  } else if (typeof target === 'object') {
    rawStrings = Object.values(target).flat(Infinity).filter(Boolean).map(String)
  }

  // Normalize target content into lowercase words/tokens
  const combinedTarget = rawStrings.join(' ').toLowerCase()
  const normalizedTarget = combinedTarget.replace(/[-_.,()/\\]/g, ' ')
  
  // Extract all individual words/tokens from the target
  const targetWords = normalizedTarget.split(/\s+/).filter(Boolean)

  // Normalize query tokens
  const cleanQuery = query.toLowerCase().trim()
  const normalizedQuery = cleanQuery.replace(/[-_.,()/\\]/g, ' ')
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)

  if (queryTokens.length === 0) return true

  // Every token in the query must match the START (prefix) of at least one word in target
  const allTokensMatchPrefix = queryTokens.every(qToken => {
    return targetWords.some(tWord => {
      // 1. Direct word prefix match (e.g., 'ju' matches 'juan', 'purok' matches 'purok 3')
      if (tWord.startsWith(qToken)) return true
      // 2. Strip leading zeroes for numeric codes (e.g., '123' matches '00123' or 'hh-00123')
      const strippedTWord = tWord.replace(/^0+/, '')
      if (strippedTWord && strippedTWord.startsWith(qToken)) return true
      return false
    })
  })

  return allTokensMatchPrefix
}
