import { useState } from 'react'
import { Icon } from './Icon'

/** 이름·태그처럼 여러 개를 칩으로 입력 (쉼표나 엔터로 추가) */
export function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState('')
  const commit = (raw: string) => {
    const parts = raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !values.includes(s))
    if (parts.length) onChange([...values, ...parts])
    setText('')
  }
  return (
    <div className="chip-input">
      {values.map((v) => (
        <span key={v} className="chip chip-on">
          {v}
          <button type="button" aria-label={`${v} 지우기`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      <input
        value={text}
        placeholder={values.length ? '' : placeholder}
        onChange={(e) => {
          const v = e.target.value
          if (/[,，]/.test(v)) commit(v)
          else setText(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(text)
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={() => text && commit(text)}
        enterKeyHint="done"
      />
    </div>
  )
}
