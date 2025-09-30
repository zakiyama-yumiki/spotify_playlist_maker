import { describe, expect, it } from 'vitest'

import { DEFAULT_PARSE_OPTIONS } from './constants'
import { normalizeLine } from './normalize'
import type { RawSetlistLine } from './types'

const createRawLine = (original: string, lineNumber = 1): RawSetlistLine => ({
  original,
  lineNumber,
})

describe('normalizeLine', () => {
  it('番号や全角・余分な空白を正規化し、タグを抽出する', () => {
    const raw = createRawLine(' ③）Ｓｏｎｇ Ａ (Acoustic) [Live] 〈Special〉 ')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.title).toBe('Song A')
    expect(result.tags).toEqual(['Acoustic', 'Live', 'Special'])
    expect(result.isEncoreMarker).toBe(false)
    expect(result.isNonSong).toBe(false)
    expect(result.raw).toBe(raw)
  })

  it('Encoreトークンを含む行をセクション扱いとして検出する', () => {
    const raw = createRawLine('  ENCORE  ')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.isEncoreMarker).toBe(true)
    expect(result.isNonSong).toBe(false)
    expect(result.title).toBe('ENCORE')
  })

  it('非楽曲キーワードを検出し、設定で除外判断できる情報を返す', () => {
    const raw = createRawLine('Stage Talk')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.isNonSong).toBe(true)
    expect(result.title).toBe('Stage Talk')
  })

  it('デリミタで分割した複数タイトルも正規化する', () => {
    const raw = createRawLine('Song A／Song B / Song C')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.title).toBe('Song A / Song B / Song C')
  })

  it('タグのみの行でもタグを保持したままトラック扱いできる情報を返す', () => {
    const raw = createRawLine('[Acoustic Version]')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.title).toBe('')
    expect(result.tags).toEqual(['Acoustic Version'])
    expect(result.isEncoreMarker).toBe(false)
    expect(result.isNonSong).toBe(false)
  })

  it('Encoreワードがタグに含まれていてもEncoreマーカーとして検出する', () => {
    const raw = createRawLine('Song A [Encore]')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.title).toBe('Song A')
    expect(result.tags).toEqual(['Encore'])
    expect(result.isEncoreMarker).toBe(true)
  })

  it('タグの前後に余計な空白があってもトリムして抽出する', () => {
    const raw = createRawLine('Song A ( Live Version  ) [  Acoustic  ]')

    const result = normalizeLine(raw, DEFAULT_PARSE_OPTIONS)

    expect(result.tags).toEqual(['Live Version', 'Acoustic'])
  })
})
