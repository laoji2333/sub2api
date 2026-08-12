import { beforeEach, describe, expect, it } from 'vitest'
import { moneySymbolInputPadding, setMoneyDisplaySymbol, useMoneyDisplay } from '@/composables/useMoneyDisplay'

describe('useMoneyDisplay', () => {
  beforeEach(() => setMoneyDisplaySymbol('$'))

  it('uses the configured symbol without converting the amount', () => {
    const { formatMoney, moneyDisplaySymbol } = useMoneyDisplay()

    setMoneyDisplaySymbol(' ¥ ')

    expect(moneyDisplaySymbol.value).toBe('¥')
    expect(formatMoney(12.3)).toBe('¥12.30')
  })

  it('falls back to the dollar symbol when the setting is empty', () => {
    const { formatMoney } = useMoneyDisplay()

    setMoneyDisplaySymbol('   ')

    expect(formatMoney(12.3)).toBe('$12.30')
  })

  it('reserves input space for multi-character symbols', () => {
    const { moneyInputPaddingStyle } = useMoneyDisplay()

    setMoneyDisplaySymbol('HK$')

    expect(moneyInputPaddingStyle.value.paddingLeft).toBe('calc(1rem + 3em)')
    expect(moneySymbolInputPadding('')).toBe('calc(1rem + 1em)')
  })
})
