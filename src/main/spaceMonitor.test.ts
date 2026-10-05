import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ Notification: class {} }))
vi.mock('./scanner', () => ({ listVolumes: vi.fn() }))
vi.mock('./config', () => ({ getScanPreferences: vi.fn() }))
vi.mock('./tray', () => ({ getLastScanSummary: vi.fn() }))

import { evaluateAlert } from './spaceMonitor'

const T = 20
const DAY = 24 * 60 * 60 * 1000

describe('evaluateAlert', () => {
  const armed = { armed: true, lastAlertAt: null }
  it('alerts on crossing below, once', () => {
    const a = evaluateAlert(15, T, armed, 0)
    expect(a.alert).toBe(true)
    expect(evaluateAlert(14, T, a.next, 1000).alert).toBe(false)
  })
  it('reminds after 24h while still low', () => {
    const a = evaluateAlert(15, T, armed, 0)
    expect(evaluateAlert(15, T, a.next, DAY).alert).toBe(true)
  })
  it('does not re-arm until clearly recovered', () => {
    const a = evaluateAlert(15, T, armed, 0)
    const hover = evaluateAlert(20.5, T, a.next, 1000)
    expect(hover.next.armed).toBe(false)
    const recovered = evaluateAlert(23, T, hover.next, 2000)
    expect(recovered.next.armed).toBe(true)
    expect(evaluateAlert(10, T, recovered.next, 3000).alert).toBe(true)
  })
})
