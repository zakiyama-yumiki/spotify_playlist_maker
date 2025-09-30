import { DEFAULT_PARSE_OPTIONS } from './constants'
import { normalizeLine } from './normalize'
import {
  NormalizedSetlistLine,
  RawSetlistLine,
  SetlistBlock,
  SetlistParseMetadata,
  SetlistParseOptions,
  SetlistParseResult,
  SetlistSectionBlock,
  SetlistTrackBlock,
} from './types'

const mergeOptions = (
  partial: Partial<SetlistParseOptions>,
): SetlistParseOptions => ({
  ...DEFAULT_PARSE_OPTIONS,
  ...partial,
})

const toRawLines = (input: string): RawSetlistLine[] => {
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  return lines.map((line, index) => ({
    original: line,
    lineNumber: index + 1,
  }))
}

const createTrackBlock = (line: NormalizedSetlistLine): SetlistTrackBlock => ({
  type: 'track',
  track: line,
})

const createEncoreBlock = (count: number): SetlistSectionBlock => ({
  type: 'section',
  name: count === 1 ? 'Encore' : `Encore ${count}`,
})

const isRenderableTrack = (
  line: NormalizedSetlistLine,
): boolean => Boolean(line.title.length > 0 || line.tags.length > 0)

export const parseSetlist = (
  input: string,
  partialOptions: Partial<SetlistParseOptions> = {},
): SetlistParseResult => {
  const options = mergeOptions(partialOptions)
  const rawLines = toRawLines(input)

  const blocks: SetlistBlock[] = []
  const skippedLines: RawSetlistLine[] = []
  let encoreCount = 0

  const pushEncoreBlock = () => {
    encoreCount += 1
    if (options.keepEncoreMarkers) {
      blocks.push(createEncoreBlock(encoreCount))
    }
  }

  for (const rawLine of rawLines) {
    const normalized = normalizeLine(rawLine, options)

    if (normalized.isEncoreMarker) {
      pushEncoreBlock()
      continue
    }

    const isEmpty = !normalized.title && normalized.tags.length === 0
    if (isEmpty) {
      skippedLines.push(rawLine)
      continue
    }

    if (normalized.isNonSong && options.excludeNonSongs) {
      skippedLines.push(rawLine)
      continue
    }

    if (!isRenderableTrack(normalized)) {
      skippedLines.push(rawLine)
      continue
    }

    blocks.push(createTrackBlock(normalized))
  }

  const metadata: SetlistParseMetadata = {
    encoreCount,
    totalLines: rawLines.length,
    skippedLines,
  }

  return {
    blocks,
    metadata,
  }
}

export const internal = {
  mergeOptions,
  toRawLines,
  createTrackBlock,
  createEncoreBlock,
  isRenderableTrack,
}
