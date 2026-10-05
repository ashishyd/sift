import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ dialog: {} }))

import { parseHeldDeleted, parseMemoryHogs, parseSnapshots, parseSwapUsage } from './hiddenSpace'

describe('hiddenSpace parsers', () => {
  it('parses swap usage', () => {
    expect(parseSwapUsage('total = 2048.00M  used = 1014.31M  free = 1033.69M  (encrypted)')).toEqual({
      totalBytes: 2048 * 1024 ** 2,
      usedBytes: 1014.31 * 1024 ** 2
    })
  })

  it('parses snapshots newest first', () => {
    const out = 'Snapshots for disk /:\ncom.apple.TimeMachine.2026-10-01-010101.local\ncom.apple.TimeMachine.2026-10-03-020202.local\n'
    expect(parseSnapshots(out)).toEqual(['2026-10-03-020202', '2026-10-01-010101'])
  })

  it('keeps big held deleted files once per pid+path', () => {
    const out = 'p10\ncApp\ns5000\nn/x/big\ns5000\nn/x/big\ns10\nn/x/tiny\n'.replace(/5000/g, '20000000')
    const files = parseHeldDeleted(out)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ pid: 10, processName: 'App', path: '/x/big' })
  })

  it('aggregates helpers per app bundle', () => {
    const rss = 300 * 1024
    const out = `1 ${rss} /Applications/Foo.app/Contents/MacOS/Foo\n2 ${rss} /Applications/Foo.app/Contents/Helper\n3 99999999 /usr/bin/other\n`
    const hogs = parseMemoryHogs(out)
    expect(hogs).toHaveLength(1)
    expect(hogs[0]).toMatchObject({ name: 'Foo', pids: [1, 2] })
  })
})

describe('parseSimulatorRuntimes', () => {
  it('maps simctl JSON, largest first', async () => {
    const { parseSimulatorRuntimes } = await import('./hiddenSpace')
    const json = JSON.stringify({
      A: { identifier: 'A', platformIdentifier: 'com.apple.platform.appletvsimulator', version: '26.2', sizeBytes: 5, deletable: true },
      B: { identifier: 'B', platformIdentifier: 'com.apple.platform.iphonesimulator', version: '26.3.1', sizeBytes: 9, lastUsedAt: '2026-09-04T06:36:23Z', deletable: true }
    })
    const r = parseSimulatorRuntimes(json)
    expect(r.map((x) => x.name)).toEqual(['iOS 26.3.1', 'tvOS 26.2'])
    expect(parseSimulatorRuntimes('not json')).toEqual([])
  })
})
