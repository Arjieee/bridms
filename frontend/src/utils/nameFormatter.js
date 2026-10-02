/**
 * Name Formatter Utility for Barangay Puerto Relief Inventory & Distribution Monitoring System (BRIDMS)
 * Standardizes names to official Philippine Government / DSWD / LGU format:
 * Format: Lastname, Firstname MiddleInitial.
 * Example: Pisos, Arjie B.
 */

/**
 * Capitalize first letter of each word (Title Case)
 * Handles hyphenated names and apostrophes gracefully (e.g. "dela Cruz", "o'connor")
 */
export const capitalizeWords = (str) => {
  if (!str || typeof str !== 'string') return ''
  return str
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)\S/g, (char) => char.toUpperCase())
}

/**
 * Extract clean capitalized middle initial with trailing period.
 * Examples:
 *  - "Bantayan" -> "B."
 *  - "B." -> "B."
 *  - "b" -> "B."
 *  - "" or null -> ""
 */
export const getMiddleInitial = (mname) => {
  if (!mname || typeof mname !== 'string') return ''
  const trimmed = mname.trim()
  if (!trimmed) return ''
  const cleaned = trimmed.replace(/[^a-zA-Z]/g, '')
  if (!cleaned) return ''
  return cleaned[0].toUpperCase() + '.'
}

/**
 * Formats a person record into official formal format:
 * "Lastname, Firstname M." or "Lastname, Firstname" (if no middle name)
 *
 * Supports:
 * - Object: { fname, lname, mname } or { first_name, last_name, middle_name }
 * - Object with full_name string fallback: { full_name: "Arjie Pisos" }
 * - Direct arguments: formatFormalName(lname, fname, mname)
 */
export const formatFormalName = (personOrLname, fname, mname) => {
  if (!personOrLname) return ''

  let last = ''
  let first = ''
  let middle = ''

  if (typeof personOrLname === 'object') {
    last = personOrLname.lname || personOrLname.last_name || ''
    first = personOrLname.fname || personOrLname.first_name || ''
    middle = personOrLname.mname || personOrLname.middle_name || ''

    // Fallback if the object only has a single full_name / name string
    if (!last && !first) {
      const raw = (personOrLname.full_name || personOrLname.name || '').trim()
      if (!raw) return ''

      // If already formatted with comma ("Pisos, Arjie B."), standardize casing and return
      if (raw.includes(',')) {
        const [lPart, fPart] = raw.split(',').map((s) => s.trim())
        return `${capitalizeWords(lPart)}, ${capitalizeWords(fPart)}`
      }

      // If in natural format "Arjie B. Pisos" or "Juan Dela Cruz"
      const parts = raw.split(/\s+/).filter(Boolean)
      if (parts.length === 1) return capitalizeWords(parts[0])
      if (parts.length === 2) return `${capitalizeWords(parts[1])}, ${capitalizeWords(parts[0])}`

      // Check if second-to-last part looks like a middle initial or middle name
      const lName = parts[parts.length - 1]
      const secondToLast = parts[parts.length - 2]
      if (secondToLast.length <= 2 || secondToLast.endsWith('.')) {
        const mi = getMiddleInitial(secondToLast)
        const fParts = parts.slice(0, parts.length - 2).join(' ')
        return `${capitalizeWords(lName)}, ${capitalizeWords(fParts)}${mi ? ' ' + mi : ''}`
      }

      const fParts = parts.slice(0, parts.length - 1).join(' ')
      return `${capitalizeWords(lName)}, ${capitalizeWords(fParts)}`
    }
  } else {
    last = personOrLname || ''
    first = fname || ''
    middle = mname || ''
  }

  const cleanLast = capitalizeWords(last)
  const cleanFirst = capitalizeWords(first)
  const mi = getMiddleInitial(middle)

  if (!cleanLast && !cleanFirst) return ''
  if (!cleanLast) return cleanFirst + (mi ? ` ${mi}` : '')
  if (!cleanFirst) return cleanLast

  return `${cleanLast}, ${cleanFirst}${mi ? ' ' + mi : ''}`
}

/**
 * Formats a person record into natural format:
 * "Firstname M. Lastname" or "Firstname Lastname"
 */
export const formatNaturalName = (personOrFname, lname, mname) => {
  if (!personOrFname) return ''

  let first = ''
  let last = ''
  let middle = ''

  if (typeof personOrFname === 'object') {
    first = personOrFname.fname || personOrFname.first_name || ''
    last = personOrFname.lname || personOrFname.last_name || ''
    middle = personOrFname.mname || personOrFname.middle_name || ''

    if (!first && !last) {
      return personOrFname.full_name || personOrFname.name || ''
    }
  } else {
    first = personOrFname || ''
    last = lname || ''
    middle = mname || ''
  }

  const cleanFirst = capitalizeWords(first)
  const cleanLast = capitalizeWords(last)
  const mi = getMiddleInitial(middle)

  if (!cleanFirst && !cleanLast) return ''
  if (!cleanLast) return cleanFirst
  if (!cleanFirst) return cleanLast

  return `${cleanFirst}${mi ? ' ' + mi : ''} ${cleanLast}`
}

/**
 * Smart matching helper for search bars.
 * Matches search query against:
 *  - First Name
 *  - Middle Name
 *  - Last Name
 *  - Formal format: "Pisos, Arjie B."
 *  - Natural format: "Arjie Pisos"
 */
export const matchesPersonSearch = (person, query) => {
  if (!query || !person) return true
  const q = query.trim().toLowerCase()
  if (!q) return true

  const fname = (person.fname || person.first_name || '').toLowerCase()
  const mname = (person.mname || person.middle_name || '').toLowerCase()
  const lname = (person.lname || person.last_name || '').toLowerCase()
  const formal = formatFormalName(person).toLowerCase()
  const natural = formatNaturalName(person).toLowerCase()

  return (
    fname.includes(q) ||
    mname.includes(q) ||
    lname.includes(q) ||
    formal.includes(q) ||
    natural.includes(q)
  )
}
