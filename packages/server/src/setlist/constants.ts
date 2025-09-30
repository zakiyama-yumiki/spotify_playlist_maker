import { SetlistParseOptions } from './types'

export const DEFAULT_PARSE_OPTIONS: SetlistParseOptions = {
  excludeNonSongs: true,
  keepEncoreMarkers: true,
  ignoreCase: true,
}

export const NON_SONG_KEYWORDS: string[] = [
  'mc',
  'm.c.',
  'stage talk',
  'talk',
  'mcコーナー',
  'トーク',
  'interlude',
  'instrumental',
  'intro',
  'outro',
  'opening',
  'ending',
  'se',
  'vtr',
  'member introduction',
  'メンバー紹介',
  'バンド紹介',
  'アンコール待ち',
]

export const NON_SONG_PATTERNS: RegExp[] = [
  /^mc\d*$/i,
  /^m\.c\.$/i,
  /stage\s*talk/i,
  /^talk$/i,
  /^mcコーナー$/i,
  /^トーク$/i,
  /^interlude$/i,
  /^instrumental$/i,
  /^intro$/i,
  /^outro$/i,
  /^opening$/i,
  /^ending$/i,
  /^se$/i,
  /^vtr$/i,
  /member\s*introduction/i,
  /^メンバー紹介$/,
  /^バンド紹介$/,
  /^アンコール待ち$/,
]

export const ENCORE_TOKENS: string[] = ['encore', 'アンコール']

export const ENCORE_PATTERN = /^(?:\[|＜)?\s*(encore|アンコール)\s*(?:\]|＞)?$/i

export const LEADING_TOKEN_PATTERN =
  /^\s*(?:\d{1,3}[.．、:)]?|[\(（]\d{1,2}[\)）]|[IVXLCDM]+[.．、:)]?|[★☆◎○●•・\-–—]|第\d+部)\s*/i

export const TAG_PATTERN = /(?:\(([^)]+)\)|\[([^\]]+)\]|＜([^＞]+)＞|〈([^〉]+)〉)/g

export const EXTRA_NORMALIZE_MAP: Record<string, string> = {
  '〜': '~',
  '～': '~',
  '’': "'",
  '＇': "'",
  '”': '"',
  '“': '"',
  '＆': '&',
  '＃': '#',
  '！': '!',
  '？': '?',
  '　': ' ',
}

export const DELIMITER_PATTERN = /\s*[\/／]\s*/
