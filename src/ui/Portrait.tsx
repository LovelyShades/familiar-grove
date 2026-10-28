import { anchorFromSource, asset, assetUrl } from '../scene/assets';
import { APPEARANCES } from '../game/registry';

// Face points come from the familiar registry (on the ORIGINAL artwork).
const FACES: Record<string, [number, number]> = Object.fromEntries(APPEARANCES.map((a) => [a.asset, a.face]));

interface Props {
  /** Manifest asset id. */
  id: string;
  /** How far to zoom into the face (1 = whole sprite). */
  zoom?: number;
  className?: string;
}

/** A square crop of a sprite, centred on the creature's face. Uses the real artwork. */
export function Portrait({ id, zoom = 2.6, className = '' }: Props) {
  const face = FACES[id];
  const record = asset(id);
  if (!face) {
    return <img className={`portrait-img ${className}`} src={assetUrl(id)} alt="" draggable={false} />;
  }
  const f = anchorFromSource(id, face[0], face[1]);
  const aspect = record.size.height / record.size.width;
  // background-position % that puts the focus point in the centre of the square box
  const imgH = zoom * aspect;
  const px = ((f.x * zoom - 0.5) / (zoom - 1)) * 100;
  const py = imgH === 1 ? 50 : ((f.y * imgH - 0.5) / (imgH - 1)) * 100;
  return (
    <div
      className={`portrait ${className}`}
      style={{
        backgroundImage: `url("${assetUrl(id)}")`,
        backgroundSize: `${zoom * 100}% auto`,
        backgroundPosition: `${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%`,
      }}
    />
  );
}
