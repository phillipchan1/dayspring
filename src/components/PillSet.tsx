/**
 * ONE PILL, EVERY CONTROL.
 *
 * The rooms had grown four ways to show a choice: the Altar's mono lowercase
 * pills, the Lamp's serif chips filled solid gold, the Ascent's outlined month
 * pills and underlined year tabs, Pages' segmented track. Every choice in a
 * room's bar is this now — what you are looking for, how you are looking, and
 * when — set in the bar's sans, and the chosen one wears the rail's own chosen
 * tile (soft accent, accent ink), so "chosen" looks the same wherever you meet it.
 */
export interface PillOption<T extends string> {
  key: T
  label: string
  title?: string
}

export function PillSet<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: PillOption<T>[]
  /** The chosen key, or null when none of these names what is showing. */
  value: T | null
  onChange: (key: T) => void
  /** What the group chooses, for a screen reader ("Type", "View", "When"). */
  label: string
  className?: string
}) {
  return (
    <div className={`pill-set${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className="pill"
          aria-pressed={value === o.key}
          title={o.title}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
