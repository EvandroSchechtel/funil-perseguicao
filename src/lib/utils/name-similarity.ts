/**
 * Semantic similarity for WhatsApp group names.
 *
 * Groups in a campaign typically follow a numeric pattern:
 *   "#01 Grupo de Lançamento", "#02 Grupo de Lançamento", ...
 *
 * The algorithm:
 *  1. Strip leading/trailing ordinal prefixes (#01, 02 -, etc.)
 *  2. Normalize: lowercase, remove diacritics, replace non-word chars
 *  3. Score = 0.6 × Jaccard(tokens) + 0.4 × (1 − Levenshtein / maxLen)
 */

// ── Ordinal stripping ──────────────────────────────────────────────────────────

/** Removes leading ordinal patterns: #01, #1, 01 -, 02., Turma 01, 1 - */
function stripLeadingOrdinal(name: string): string {
  return name
    // "#01 Name", "#1 Name"
    .replace(/^#\d{1,3}\.?\s*[-–—·]?\s*/u, "")
    // "01 - Name", "02. Name", "1 Name"
    .replace(/^\d{1,3}[.\s]*[-–—·]?\s*/u, "")
    .trim()
}

/** Removes trailing ordinal patterns: "Name #01", "Name - 02" */
function stripTrailingOrdinal(name: string): string {
  return name
    .replace(/\s*[-–—·]?\s*#?\d{1,3}$/u, "")
    .trim()
}

function stripOrdinals(name: string): string {
  return stripTrailingOrdinal(stripLeadingOrdinal(name))
}

// ── Normalization ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "de", "do", "da", "dos", "das", "e", "o", "a", "os", "as",
  "em", "no", "na", "nos", "nas", "para", "por", "com", "um", "uma",
])

export function normalizeGroupName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^\w\s]/g, " ")        // non-word → space
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeForComparison(name: string): string {
  return normalizeGroupName(stripOrdinals(name))
}

function tokenize(str: string): Set<string> {
  return new Set(
    str.split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  )
}

// ── Distance algorithms ────────────────────────────────────────────────────────

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0
  const intersection = [...a].filter((t) => b.has(t)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, prev.length, ...curr)
  }
  return prev[n]
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Returns a similarity score 0..1 between two group names.
 *
 * Examples (score → expected decision):
 *  "#01 Grupo Lançamento"  vs "#03 Grupo Lançamento"  → ~0.95 (auto-link ✓)
 *  "Turma A Vendas"        vs "Turma B Vendas"         → ~0.88 (auto-link ✓)
 *  "Suporte Interno"       vs "Grupo Lançamento"       → ~0.10 (skip ✗)
 */
export function groupNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeForComparison(nameA)
  const normB = normalizeForComparison(nameB)

  if (normA === normB) return 1.0
  if (!normA || !normB) return 0.0

  const tokensA = tokenize(normA)
  const tokensB = tokenize(normB)
  const jaccard = jaccardSimilarity(tokensA, tokensB)

  const maxLen = Math.max(normA.length, normB.length)
  const levScore = maxLen === 0 ? 1.0 : 1.0 - levenshtein(normA, normB) / maxLen

  return 0.6 * jaccard + 0.4 * levScore
}

/** Minimum score to consider two group names "similar enough" to auto-link. */
export const SIMILARITY_THRESHOLD = 0.65
