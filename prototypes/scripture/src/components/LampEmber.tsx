interface Props {
  lit?: boolean
  label?: string
}

export function LampEmber({ lit = false, label }: Props) {
  return (
    <div className="lamp-ember" data-lit={lit ? 'true' : undefined}>
      <span className="lamp-ember__glow" aria-hidden />
      {lit ? (
        <>
          <span className="lamp-ember__ref">{label ?? 'James 4:8'}</span>
          <span className="lamp-ember__hint">landed today</span>
        </>
      ) : (
        <span className="lamp-ember__empty">Nothing lit yet</span>
      )}
    </div>
  )
}
