import { useState, type FormEvent } from 'react'

export function KeepName() {
  const [value, setValue] = useState('')
  const [named, setNamed] = useState<string[]>([])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = value.trim()
    if (next.length < 2) return
    setNamed((n) => (n.some((x) => x.toLowerCase() === next.toLowerCase()) ? n : [...n, next]))
    setValue('')
  }

  return (
    <div className="paper">
      <div className="keep">
        <form onSubmit={onSubmit}>
          <input
            className="keep__field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            spellCheck={false}
            aria-label="Name something you carry"
          />
        </form>
        {named.length > 0 && (
          <div className="kept">
            <div className="kept__names">
              {named.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
