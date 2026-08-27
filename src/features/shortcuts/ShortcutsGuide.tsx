import { getShortcutGroups, isMac, renderKey, type Shortcut } from './shortcuts'

/** The shortcut listing, shared by the Settings tab and the “?” overlay. */
export function ShortcutsGuide() {
  const mac = isMac()
  return (
    <div className="shortcuts">
      {getShortcutGroups().map((group) => (
        <section key={group.title} className="shortcuts__group">
          <h4 className="shortcuts__group-title">{group.title}</h4>
          <ul className="shortcuts__list">
            {group.items.map((item, i) => (
              <ShortcutRow key={`${group.title}-${i}`} item={item} mac={mac} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ShortcutRow({ item, mac }: { item: Shortcut; mac: boolean }) {
  return (
    <li className="shortcut-row">
      <span className="shortcut-row__label">
        {item.label}
        {item.when && <span className="shortcut-row__when">{item.when}</span>}
      </span>
      <span className="shortcut-row__keys">
        {item.keys.map((k, i) => (
          <kbd key={i} className="kbd">
            {renderKey(k, mac)}
          </kbd>
        ))}
        {/* A second binding for the same act — "or" rather than a second row,
            because two rows read as two different things you can do. */}
        {item.alsoKeys ? (
          <>
            <span className="shortcut-row__or">or</span>
            {item.alsoKeys.map((k, i) => (
              <kbd key={`alt-${i}`} className="kbd">
                {renderKey(k, mac)}
              </kbd>
            ))}
          </>
        ) : null}
      </span>
    </li>
  )
}
