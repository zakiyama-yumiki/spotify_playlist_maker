import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseSetlist } from './parser'
import type { SetlistTrackBlock } from './types'

const readFixture = (filename: string): string =>
  readFileSync(new URL(`../../../../docs/${filename}`, import.meta.url), 'utf-8')

const extractTrackTitles = (blocks: SetlistTrackBlock[]): string[] =>
  blocks.map((block) => block.track.title)

describe('セットリスト統合テスト', () => {
  it('乃木坂46サンプルを正規化・解析できる', () => {
    const nogi = readFixture('setlist_sample_nogi.txt')
    const result = parseSetlist(nogi)

    const trackBlocks = result.blocks.filter(
      (block): block is SetlistTrackBlock => block.type === 'track',
    )
    const titles = extractTrackTitles(trackBlocks)

    expect(trackBlocks).toHaveLength(43)
    expect(titles[0]).toBe('乃木坂46、真夏の全国ツアー2025 @マリンメッセA館')
    expect(titles[5]).toBe('Overture')
    expect(titles).toContain('Sing Out! / c 賀喜')
    expect(titles.at(-1)).toBe('EN3. 乃木坂の詩 / c賀喜')

    expect(result.metadata).toEqual({
      encoreCount: 0,
      totalLines: 45,
      skippedLines: [
        { original: '1', lineNumber: 1 },
        { original: '2', lineNumber: 24 },
      ],
    })
  })

  it('星野源サンプルを正規化・解析できる', () => {
    const gen = readFixture('setlist_sample_hoshino-gen.txt')
    const result = parseSetlist(gen)

    const trackBlocks = result.blocks.filter(
      (block): block is SetlistTrackBlock => block.type === 'track',
    )
    const titles = extractTrackTitles(trackBlocks)

    expect(trackBlocks).toHaveLength(21)
    expect(titles[0]).toBe('地獄でなぜ悪い')
    expect(titles).toContain('弾き語り')
    expect(titles.at(-1)).toBe('Eureka')

    expect(result.metadata).toEqual({
      encoreCount: 0,
      totalLines: 22,
      skippedLines: [
        { original: '2', lineNumber: 15 },
      ],
    })
  })
})
