// Levenshtein distance for fuzzy string matching
function levenshtein(a, b) {
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function similarity(a, b) {
  if (!a || !b) return 0
  const longer = a.length > b.length ? a : b
  if (!longer.length) return 1.0
  const dist = levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim())
  return (longer.length - dist) / longer.length
}

/**
 * Check for duplicates in existing households + pending registrations.
 * Returns { isDuplicate, severity, conflicts }
 *   - severity: 'block' (>=95% match) | 'warn' (>=80% match) | null
 *   - conflicts: array of human-readable conflict messages
 */
export function checkDuplicate(formData, households, pendingRegs) {
  const conflicts = []
  let maxScore = 0

  const newFname = formData.head.fname.toLowerCase().trim()
  const newLname = formData.head.lname.toLowerCase().trim()
  const newContact = (formData.head.contact || '').trim()
  const newEmail = (formData.head.email || '').toLowerCase().trim()
  const newUsername = (formData.username || '').toLowerCase().trim()

  // Check existing households
  for (const hh of households) {
    const head = hh.members?.find(m => m.is_head)
    if (!head) continue
    let score = 0
    const reasons = []

    // Exact full name match
    const nameSim = similarity(`${newFname} ${newLname}`, `${head.fname} ${head.lname}`)
    if (nameSim >= 0.95) { score += 50; reasons.push(`name "${head.fname} ${head.lname}"`) }
    else if (nameSim >= 0.85) { score += 30; reasons.push(`similar name "${head.fname} ${head.lname}"`) }

    // Same purok + similar name
    if (parseInt(formData.purok_id) === hh.purok_id && nameSim >= 0.8) {
      score += 15
      if (!reasons.some(r => r.includes('purok'))) reasons.push(`same ${hh.purok_name}`)
    }

    // Contact number match
    if (newContact && head.contact === newContact) {
      score += 40; reasons.push(`contact "${newContact}"`)
    }

    // Email match
    if (newEmail && head.email?.toLowerCase() === newEmail) {
      score += 40; reasons.push(`email "${newEmail}"`)
    }

    // House address very similar
    if (formData.house_no_street && hh.house_no_street) {
      const addrSim = similarity(formData.house_no_street, hh.house_no_street)
      if (addrSim >= 0.9) { score += 15; reasons.push(`address "${hh.house_no_street}"`) }
    }

    if (score >= 50) {
      conflicts.push({
        type: 'household',
        score,
        message: `Possible duplicate of "${head.fname} ${head.lname}" (${hh.hh_code}, ${hh.purok_name}): ${reasons.join(', ')}`,
      })
      maxScore = Math.max(maxScore, score)
    }
  }

  // Check pending registrations
  for (const reg of pendingRegs) {
    if (reg.status === 'rejected') continue
    let score = 0
    const reasons = []
    const nameSim = similarity(`${newFname} ${newLname}`, `${reg.head.fname.toLowerCase()} ${reg.head.lname.toLowerCase()}`)
    if (nameSim >= 0.95) { score += 50; reasons.push(`pending registration of "${reg.head.fname} ${reg.head.lname}"`) }
    if (newContact && reg.head.contact === newContact) { score += 40; reasons.push(`same contact`) }
    if (newEmail && reg.head.email?.toLowerCase() === newEmail) { score += 40; reasons.push(`same email`) }
    if (newUsername && reg.username?.toLowerCase() === newUsername) { score += 50; reasons.push(`same username`) }
    if (score >= 50) {
      conflicts.push({ type: 'pending', score, message: `Conflicts with pending registration: ${reasons.join(', ')}` })
      maxScore = Math.max(maxScore, score)
    }
  }

  if (maxScore >= 90) return { isDuplicate: true, severity: 'block', conflicts }
  if (maxScore >= 60) return { isDuplicate: true, severity: 'warn', conflicts }
  return { isDuplicate: false, severity: null, conflicts: [] }
}
