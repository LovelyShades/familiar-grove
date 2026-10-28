import { assetUrl } from '../scene/assets';

export type Panel = 'grove' | 'bestiary' | 'summon' | 'options';

const ITEMS: { id: Panel; label: string; icon: string }[] = [
  { id: 'grove', label: 'Grove', icon: 'ui.nav.grove' },
  { id: 'bestiary', label: 'Bestiary', icon: 'ui.nav.bestiary' },
  { id: 'summon', label: 'Summon', icon: 'ui.nav.summon' },
  { id: 'options', label: 'Options', icon: 'ui.nav.options' },
];

export function NavBar({ active, onNavigate }: { active: Panel; onNavigate: (panel: Panel) => void }) {
  return (
    <nav className="glass navbar" aria-label="Main">
      {ITEMS.map((item, i) => (
        <span className="nav-slot" key={item.id}>
          {i > 0 && <span className="nav-gem" aria-hidden="true" />}
          <button
            className={`nav-button${item.id === active ? ' active' : ''}`}
            type="button"
            aria-current={item.id === active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <img src={assetUrl(item.icon)} alt="" draggable={false} />
            <span>{item.label}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}
