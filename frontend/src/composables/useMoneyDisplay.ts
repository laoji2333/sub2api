import { computed, readonly, ref } from 'vue'

const activeMoneyDisplaySymbol = ref('$')

export function setMoneyDisplaySymbol(value: string | null | undefined): void {
  activeMoneyDisplaySymbol.value = value?.trim() || '$'
}

export function moneySymbolInputPadding(symbol: string): string {
  const symbolLength = Array.from(symbol.trim() || '$').length
  return `calc(1rem + ${Math.max(symbolLength, 1)}em)`
}

export function useMoneyDisplay() {
  const moneyDisplaySymbol = readonly(activeMoneyDisplaySymbol)
  const moneyInputPaddingStyle = computed(() => ({
    paddingLeft: moneySymbolInputPadding(moneyDisplaySymbol.value),
  }))

  const prefixMoney = (value: string | number): string => `${moneyDisplaySymbol.value}${value}`
  const formatMoney = (value: number, fractionDigits = 2): string =>
    prefixMoney((Number.isFinite(value) ? value : 0).toFixed(fractionDigits))

  return {
    moneyDisplaySymbol,
    moneyInputPaddingStyle,
    prefixMoney,
    formatMoney,
  }
}
