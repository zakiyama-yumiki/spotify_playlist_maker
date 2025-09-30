import { describe, expect, it } from 'vitest'

import { parseSetlist } from './parser'

describe('parseSetlist', () => {
  const baseInput = [
    '01. Song A (Acoustic)',
    'Stage Talk',
    'Encore',
    '03. Song C (Live)',
    'Song D / Song E [Duet]'
  ].join('\n')

  it('既定オプションでEncore区切りや非楽曲除外が行われる', () => {
    const result = parseSetlist(baseInput)

    expect(result.blocks).toEqual([
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song A',
          tags: ['Acoustic'],
          isEncoreMarker: false,
          isNonSong: false,
          raw: { original: '01. Song A (Acoustic)', lineNumber: 1 },
        }),
      },
      {
        type: 'section',
        name: 'Encore',
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song C',
          tags: ['Live'],
          isEncoreMarker: false,
          isNonSong: false,
          raw: { original: '03. Song C (Live)', lineNumber: 4 },
        }),
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song D / Song E',
          tags: ['Duet'],
          isEncoreMarker: false,
          isNonSong: false,
          raw: { original: 'Song D / Song E [Duet]', lineNumber: 5 },
        }),
      },
    ])

    expect(result.metadata).toEqual({
      encoreCount: 1,
      totalLines: 5,
      skippedLines: [
        {
          original: 'Stage Talk',
          lineNumber: 2,
        },
      ],
    })
  })

  it('非楽曲保持とEncore非表示のオプションに対応する', () => {
    const result = parseSetlist(baseInput, {
      excludeNonSongs: false,
      keepEncoreMarkers: false,
    })

    expect(result.blocks).toEqual([
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song A',
          raw: { original: '01. Song A (Acoustic)', lineNumber: 1 },
        }),
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Stage Talk',
          isNonSong: true,
          raw: { original: 'Stage Talk', lineNumber: 2 },
        }),
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song C',
          raw: { original: '03. Song C (Live)', lineNumber: 4 },
        }),
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song D / Song E',
          raw: { original: 'Song D / Song E [Duet]', lineNumber: 5 },
        }),
      },
    ])

    expect(result.metadata).toEqual({
      encoreCount: 1,
      totalLines: 5,
      skippedLines: [],
    })
  })

  it('複数Encoreを正しくカウントしセクション名を付与する', () => {
    const input = [
      'Encore',
      'Encore',
      'Song A',
      'Encore',
      'Song B',
    ].join('\n')

    const result = parseSetlist(input)

    expect(result.blocks).toEqual([
      { type: 'section', name: 'Encore' },
      { type: 'section', name: 'Encore 2' },
      {
        type: 'track',
        track: expect.objectContaining({ title: 'Song A' }),
      },
      { type: 'section', name: 'Encore 3' },
      {
        type: 'track',
        track: expect.objectContaining({ title: 'Song B' }),
      },
    ])

    expect(result.metadata.encoreCount).toBe(3)
    expect(result.metadata.totalLines).toBe(5)
    expect(result.metadata.skippedLines).toEqual([])
  })

  it('空行や非楽曲行をスキップし、メタデータに記録する', () => {
    const input = [
      '',
      '   ',
      'Song A',
      'Stage Talk',
      'Song B',
    ].join('\n')

    const result = parseSetlist(input)

    expect(result.blocks).toEqual([
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song A',
          raw: { original: 'Song A', lineNumber: 3 },
        }),
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song B',
          raw: { original: 'Song B', lineNumber: 5 },
        }),
      },
    ])

    expect(result.metadata.skippedLines).toEqual([
      { original: '', lineNumber: 1 },
      { original: '   ', lineNumber: 2 },
      { original: 'Stage Talk', lineNumber: 4 },
    ])
    expect(result.metadata.totalLines).toBe(5)
  })

  it('タグのみの行もトラックとして保持される', () => {
    const input = [
      '[Acoustic Version]',
      'Song A',
    ].join('\n')

    const result = parseSetlist(input)

    expect(result.blocks).toEqual([
      {
        type: 'track',
        track: expect.objectContaining({
          title: '',
          tags: ['Acoustic Version'],
          raw: { original: '[Acoustic Version]', lineNumber: 1 },
        }),
      },
      {
        type: 'track',
        track: expect.objectContaining({
          title: 'Song A',
          raw: { original: 'Song A', lineNumber: 2 },
        }),
      },
    ])

    expect(result.metadata.skippedLines).toEqual([])
  })
})
