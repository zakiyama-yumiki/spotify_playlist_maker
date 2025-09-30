import {
  DELIMITER_PATTERN,
  ENCORE_PATTERN,
  ENCORE_TOKENS,
  EXTRA_NORMALIZE_MAP,
  LEADING_TOKEN_PATTERN,
  NON_SONG_KEYWORDS,
  NON_SONG_PATTERNS,
  TAG_PATTERN,
} from './constants'
import {
  NormalizedSetlistLine,
  RawSetlistLine,
  SetlistParseOptions,
} from './types'

const applyUnicodeNormalization = (text: string): string => {
  const nfkc = text.normalize('NFKC')
  return Object.entries(EXTRA_NORMALIZE_MAP).reduce((acc, [key, value]) => acc.replaceAll(key, value), nfkc)
}

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim()

const stripLeadingToken = (text: string): { value: string; stripped: boolean } => {
  const stripped = text.replace(LEADING_TOKEN_PATTERN, '')
  return { value: stripped, stripped: stripped.length !== text.length }
}

const extractTags = (
  input: string,
): { title: string; tags: string[] } => {
  const tags: string[] = []
  const tagRegex = new RegExp(TAG_PATTERN)
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(input)) !== null) {
    const tagCandidate = match.slice(1).find((candidate) => Boolean(candidate))
    if (tagCandidate) {
      tags.push(normalizeWhitespace(tagCandidate))
    }
  }

  const title = normalizeWhitespace(input.replace(new RegExp(TAG_PATTERN), ' '))
  return { title, tags }
}

const detectEncore = (title: string, tags: string[], detectText: string): boolean => {
  if (!detectText) {
    return false
  }

  if (ENCORE_PATTERN.test(detectText)) {
    return true
  }

  return tags.some((tag) => {
    const normalizedTag = tag.normalize('NFKC')
    return ENCORE_PATTERN.test(normalizedTag) || ENCORE_TOKENS.includes(normalizedTag.toLowerCase())
  })
}

const detectNonSong = (title: string, tags: string[], detectText: string): boolean => {
  if (!detectText) {
    return false
  }

  const keywordMatch = NON_SONG_KEYWORDS.some((keyword) => keyword === detectText)
  if (keywordMatch) {
    return true
  }

  const patternMatch = NON_SONG_PATTERNS.some((pattern) => pattern.test(detectText))
  if (patternMatch) {
    return true
  }

  return tags.some((tag) => {
    const normalizedTag = tag.normalize('NFKC').toLowerCase()
    return (
      NON_SONG_KEYWORDS.includes(normalizedTag) ||
      NON_SONG_PATTERNS.some((pattern) => pattern.test(normalizedTag))
    )
  })
}

const splitByDelimiter = (title: string): string => {
  if (!DELIMITER_PATTERN.test(title)) {
    return title
  }

  const parts = title.split(DELIMITER_PATTERN).map((part) => normalizeWhitespace(part))
  return parts.join(' / ')
}

export const normalizeLine = (
  rawLine: RawSetlistLine,
  options: SetlistParseOptions,
): NormalizedSetlistLine => {
  const normalizedSource = applyUnicodeNormalization(rawLine.original)
  const collapsedWhitespace = normalizeWhitespace(normalizedSource)
  const { value: withoutLeadingToken } = stripLeadingToken(collapsedWhitespace)
  const normalizedTitleCandidate = normalizeWhitespace(withoutLeadingToken)
  const { title: titleWithoutTags, tags } = extractTags(normalizedTitleCandidate)
  const titleWithDelimiter = splitByDelimiter(titleWithoutTags)

  const detectionTarget = options.ignoreCase === false
    ? titleWithDelimiter
    : titleWithDelimiter.toLowerCase()

  const isEncoreMarker = detectEncore(titleWithDelimiter, tags, detectionTarget)
  const isNonSong = detectNonSong(titleWithDelimiter, tags, detectionTarget)

  return {
    title: titleWithDelimiter,
    tags,
    isEncoreMarker,
    isNonSong,
    raw: rawLine,
  }
}

export const helpers = {
  applyUnicodeNormalization,
  normalizeWhitespace,
  stripLeadingToken,
  extractTags,
  detectEncore,
  detectNonSong,
  splitByDelimiter,
}
