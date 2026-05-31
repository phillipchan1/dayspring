import { isMac, renderKey, SHORTCUT_GROUPS, type Shortcut } from './shortcuts'

/** The shortcut listing, shared by the Settings tab and the “?” overlay. */
export function ShortcutsGuide() {
  const mac = isMac()
  return (
    <div className="shortcuts">
      {SHORTCUT_GROUPS.map((group) => (
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
      </span>
    </li>
  )
}
