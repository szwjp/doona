import {createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode, type Ref} from 'react';
import {ChartDescription} from './charts/description';
import {cx} from './cx';
import {HelpRow, type Help} from './ContextualHelp';
import {ActionHelp} from './Button';
import {ControlSizeContext, type ControlSize} from './controlSize';
import {TextTooltip} from './Tooltip';

// The card surface's class, for a react-aria element that has to be the card itself (a drop zone) and a form that is
// one. Extra classes lay out what the card holds.
export const cardClass = (...layout: Array<string | false | undefined>) => cx('rp-card', ...layout);

// False inside a preview whose frame already names it (a gallery item): its cards and widget sections keep their names
// for assistive technology but draw no title.
export const TitlesShown = createContext(true);
// The name dashboard.css gives the heights of a card that a dashboard cell holds until it first comes on screen
// (DashboardTile), so the preview there keeps the room its Skeleton held; the cards inside it name none.
export const HeldCard = createContext<string | undefined>(undefined);

type Tint = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type TileHeader = {icon: ReactNode; tint: Tint; kind: 'metric' | 'control'; layout?: 'responsive'};

// A dashboard tile's caption: an icon in a role colour, the label, then any control the caption holds. A control
// card's label that shows only its icon (`tip`) keeps its words for assistive technology and shows them over the icon.
export function TileHead({icon, tint, kind, layout, label, tip, children}: TileHeader & {label: string; tip?: boolean; children?: ReactNode}) {
  return (
    <span className={`${kind === 'metric' ? 'rp-tile-head' : 'rp-qlabel'} rp-tint-c${tint}`} data-layout={layout}>
      {tip ? (
        <TextTooltip text={label} className={`rp-qicon rp-tint-c${tint}`}>
          {icon}
        </TextTooltip>
      ) : (
        icon
      )}
      <span className={kind === 'metric' ? 'rp-tile-caption' : 'rp-truncate'}>{label}</span>
      {kind === 'metric' && children ? <span className="rp-tile-controls">{children}</span> : children}
    </span>
  );
}

// A control card's line never wraps: by the card's own width it shows its label whole, then without the label's icon,
// then the icon alone. The label and its icon are measured whole — with every part drawn, whatever step is committed —
// and the control beside them fits itself to the room that is left; measuring the whole line instead would let the step
// decide the measurement that decides the step, which on WebKit packs and unpacks forever. A resize, new words or a late
// web font measure it again, and a new step commits before the browser paints.
type ControlStep = 'full' | 'bare' | 'icon';
function ControlLine({tile, label, children}: {tile: TileHeader; label: string; children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<ControlStep>('full');
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    let frame = 0;
    const measure = () => {
      const room = row.clientWidth;
      if (!room) return;
      // Every part whole: the step's own hiding rules would otherwise shrink the line they are chosen by.
      const committed = row.dataset.step;
      row.dataset.step = 'full';
      row.dataset.probe = '';
      const head = row.firstElementChild as HTMLElement;
      const whole = head.getBoundingClientRect().width;
      const icon = head.querySelector('svg')?.getBoundingClientRect().width ?? 0;
      delete row.dataset.probe;
      row.dataset.step = committed ?? 'full';
      setStep(whole <= room + 0.5 ? 'full' : whole - icon <= room + 0.5 ? 'bare' : 'icon');
    };
    // One measurement per frame: a MutationObserver callback that measures and commits can otherwise re-enter its own
    // observer, which never yields on WebKit.
    const later = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    const resized = new ResizeObserver(later);
    resized.observe(row);
    const changed = new MutationObserver(later);
    changed.observe(row, {subtree: true, childList: true, characterData: true});
    document.fonts.addEventListener('loadingdone', later);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      changed.disconnect();
      document.fonts.removeEventListener('loadingdone', later);
    };
  }, []);
  return (
    <div ref={ref} className="rp-row" data-step={step}>
      <TileHead {...tile} label={label} tip={step === 'icon'} />
      {children}
    </div>
  );
}

// A card. A titled card is a section named by its heading: the title with an optional control beside it (a toggle, a
// link), an optional note on what the card is drawn from, then the body; a chart in the body is described by the note
// to assistive technology. With `tile` the title is a caption after an icon in a role colour, not a heading, and names
// nothing: a metric tile's small caption holds its own control (`aside`), and a control card's label sits beside
// its control on one line (ControlLine). An untitled card holds its own header, and takes `aria-label` when it needs a
// name.
// `titleVariant="caption"` keeps a titled region's name without adding a heading.
// A tile's caption needs its words, so a card with `tile` must have a `title`.
type CardHeader = {tile: TileHeader; title: string} | {tile?: undefined; title?: string};

export function Card({
  title,
  titleVariant = 'heading',
  level = 2,
  titleId,
  tile,
  note,
  help,
  aside,
  reason,
  id,
  className,
  tabIndex,
  'aria-label': label,
  children,
  ref,
  size
}: CardHeader & {
  titleVariant?: 'heading' | 'caption';
  level?: 2 | 3;
  // A heading id other code relies on, such as a `?card=` scroll target.
  titleId?: string;
  note?: string;
  // What the title means, in a help popover beside it.
  help?: Help;
  aside?: ReactNode;
  // Why the card's disabled actions cannot run.
  reason?: string | null;
  id?: string;
  // Layout for what the card holds.
  className?: string;
  tabIndex?: number;
  'aria-label'?: string;
  children?: ReactNode;
  // A card that pauses its reads off screen observes itself.
  ref?: Ref<HTMLElement>;
  // The size of the controls inside the card; unset, they are M.
  size?: ControlSize;
}) {
  const ownTitleId = useId();
  const noteId = useId();
  const headingId = titleId ?? ownTitleId;
  const Heading = level === 2 ? 'h2' : 'h3';
  const Title = titleVariant === 'caption' ? 'span' : Heading;
  const shown = useContext(TitlesShown);
  const held = useContext(HeldCard);
  const titled = title != null && !tile;
  const named = title != null && (shown || tile) && (
    <Title className={titleVariant === 'caption' ? 'rp-qlabel' : 'rp-h3'} id={headingId}>
      {title}
    </Title>
  );
  const heading = tile ? (
    <TileHead {...tile} label={title}>
      {tile.kind === 'metric' && aside}
    </TileHead>
  ) : named ? (
    <HelpRow help={help}>{named}</HelpRow>
  ) : (
    named
  );
  const card = (
    <section
      ref={ref}
      id={id}
      tabIndex={tabIndex}
      className={cardClass(
        titled && 'rp-titled',
        tile?.layout === 'responsive' && 'rp-tile-responsive',
        tile?.kind === 'control' && 'rp-control-card',
        className
      )}
      aria-labelledby={titled && shown && !label ? headingId : undefined}
      aria-label={label ?? (titled && !shown ? title : undefined)}
      data-card={held}
    >
      <ActionHelp reason={reason}>
        {aside && tile && tile.kind === 'control' ? (
          <ControlLine tile={tile} label={title}>
            {aside}
          </ControlLine>
        ) : aside && tile?.kind !== 'metric' ? (
          <div className="rp-row">
            {heading}
            {aside}
          </div>
        ) : (
          heading
        )}
        {note && (
          <p className="rp-note" id={noteId}>
            {note}
          </p>
        )}
        <ChartDescription.Provider value={note ? noteId : undefined}>
          <HeldCard value={undefined}>{children}</HeldCard>
        </ChartDescription.Provider>
      </ActionHelp>
    </section>
  );
  // A card's controls are M wherever the card sits, unless the card sets L.
  return <ControlSizeContext value={size ?? null}>{card}</ControlSizeContext>;
}
