import { formatKRW, parseAmount } from '../lib/format'

/** 숫자만 입력, 쉼표 자동 + 아래에 "150만 원"처럼 읽기 쉽게 보여줌 */
export function AmountInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  id,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  autoFocus?: boolean
  id?: string
}) {
  return (
    <div className="amount-wrap">
      <div className="amount-input">
        <input
          id={id}
          inputMode="numeric"
          autoFocus={autoFocus}
          placeholder={placeholder ?? '0'}
          value={value === undefined ? '' : value.toLocaleString('ko-KR')}
          onChange={(e) => onChange(parseAmount(e.target.value))}
        />
        <span className="amount-unit">원</span>
      </div>
      {value && value >= 10000 ? <span className="amount-hint">{formatKRW(value)}</span> : null}
    </div>
  )
}
