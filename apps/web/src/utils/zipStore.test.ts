import { describe, expect, it } from 'vitest'
import { createStoredZip, sha256Hex } from './zipStore'

describe('audit package zip writer', () => {
  it('creates a valid stored ZIP envelope', () => {
    const zip = createStoredZip([{ name: 'manifest.json', data: '{"ok":true}\n' }], new Date('2026-08-30T00:00:00Z'))
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(Array.from(zip.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06])
    expect(new TextDecoder().decode(zip)).toContain('manifest.json')
  })

  it('produces stable sha256 checksums', async () => {
    await expect(sha256Hex('abc')).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
