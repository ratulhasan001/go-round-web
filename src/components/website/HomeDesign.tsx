"use client";

// The admin "Website" page's home page designer: news headlines, text boxes, partner / work experience logos, the
// section order, and a live preview of the store's home page that follows every keystroke.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BellRing, BriefcaseBusiness, ExternalLink, Eye, EyeOff, Handshake, ImagePlus, Loader2, Megaphone, Monitor, Plus, RotateCw, Smartphone, Sparkles, Trash2, TriangleAlert, Type, X } from "lucide-react";
import { forget, storePhoto } from "@/lib/photos";
import { uid } from "@/lib/calc";
import { HOME_BLOCK_STYLES, HOME_SECTIONS, PREVIEW_READY, PREVIEW_SITE, absolute, blockKey, publicLinks } from "@/lib/site";
import type { HomeBlock, HomeBlockStyle, HomeSettings, LogoItem, SiteSettings } from "@/lib/types";
import { Button, Input, Switch, Textarea, cx, useToast } from "@/components/ui";

const iconBtn = "grid size-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30";
const moveIn = <T,>(list: T[], i: number, d: -1 | 1) => {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d]!, next[i]!];
  return next;
};

/** Upload one photo (or several); the callback runs once per saved photo. */
function usePhotoPicker(cloud: boolean, onSaved: (url: string, file: File) => void) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const input = (multiple = false) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple={multiple}
      hidden
      onChange={async (e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        if (!files.length) return;
        setBusy(true);
        let failed = 0;
        for (const f of files) {
          try {
            onSaved(await storePhoto(f, cloud), f);
          } catch {
            failed++;
          }
        }
        setBusy(false);
        if (failed) toast(failed === 1 ? "Couldn't upload a photo" : `Couldn't upload ${failed} photos`, "err");
      }}
    />
  );
  return { open: () => ref.current?.click(), busy, input };
}

// ---------- news headlines ----------

/** The red "News" ticker along the top of every store page: one box per headline. */
export function HeadlinesEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lines = value.split("\n");
  const [rows, setRows] = useState(3);
  const n = Math.max(3, rows, lines.length);
  const all = Array.from({ length: n }, (_, i) => lines[i] ?? "");
  const save = (next: string[]) => onChange(next.join("\n").replace(/\n+$/, ""));
  const live = all.filter((t) => t.trim()).length;
  const examples = ["e.g. Eid holiday: orders placed after 28 March ship on 2 April", "e.g. New stock of CO2 regulators has arrived", "e.g. Free delivery on orders over ৳5,000 this week"];
  return (
    <div>
      <ul className="flex flex-col gap-2">
        {all.map((t, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={cx("grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold", t.trim() ? "bg-red-600 text-white" : "bg-canvas text-faint")}>{i + 1}</span>
            <Input value={t} placeholder={examples[i] ?? "Another headline"} aria-label={`Headline ${i + 1}`} onChange={(e) => save(all.map((x, j) => (j === i ? e.target.value.replace(/\n/g, " ") : x)))} />
            <button
              type="button"
              className={cx(iconBtn, "hover:bg-red-50 hover:text-red-600")}
              disabled={!t && n <= 3}
              aria-label={`Remove headline ${i + 1}`}
              title="Remove"
              onClick={() => {
                if (n > 3) {
                  setRows(n - 1);
                  save(all.filter((_, j) => j !== i));
                } else save(all.map((x, j) => (j === i ? "" : x)));
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" onClick={() => setRows(n + 1)}>
          <Plus className="size-3.5" /> Add headline
        </Button>
        <span className="text-[12px] text-muted">{live ? `${live} headline${live === 1 ? "" : "s"} scrolling on the website` : "Empty boxes are hidden - the bar disappears when all are empty"}</span>
      </div>
    </div>
  );
}

// ---------- text boxes ----------

const BLOCK_ICONS: Record<HomeBlockStyle, typeof Megaphone> = { notice: TriangleAlert, announcement: Megaphone, greeting: Sparkles, update: BellRing, plain: Type };
const BLOCK_SWATCH: Record<HomeBlockStyle, string> = {
  notice: "bg-red-50 text-red-700 border-red-200",
  announcement: "bg-[#1f7fa8] text-white border-transparent",
  greeting: "bg-[#113a2d] text-[#8cbf5a] border-transparent",
  update: "bg-[#fbf9f4] text-[#1f7fa8] border-line",
  plain: "bg-white text-ink border-line",
};
const BLOCK_START: Record<HomeBlockStyle, Pick<HomeBlock, "title" | "text">> = {
  notice: { title: "Important notice", text: "" },
  announcement: { title: "New stock has arrived", text: "" },
  greeting: { title: "Eid Mubarak!", text: "Warm wishes to you and your family from all of us." },
  update: { title: "Shop update", text: "" },
  plain: { title: "A few words from us", text: "" },
};

/** Adds, edits and removes the home page text boxes (each new one goes to the top of the page). */
export function BlocksEditor({ home, cloud, update }: { home: HomeSettings; cloud: boolean; update: (fn: (h: HomeSettings) => HomeSettings) => void }) {
  const add = (style: HomeBlockStyle) => {
    const id = uid();
    update((h) => ({ ...h, blocks: [...h.blocks, { id, style, ...BLOCK_START[style], button: "", link: "" }], sections: [{ id: blockKey(id), on: true }, ...h.sections] }));
  };
  const edit = (id: string, p: Partial<HomeBlock>) => update((h) => ({ ...h, blocks: h.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)) }));
  const remove = (b: HomeBlock) => {
    if (b.image) forget(b.image);
    update((h) => ({ ...h, blocks: h.blocks.filter((x) => x.id !== b.id), sections: h.sections.filter((x) => x.id !== blockKey(b.id)) }));
  };
  const shown = (id: string) => home.sections.find((x) => x.id === blockKey(id))?.on ?? true;
  const show = (id: string, on: boolean) => update((h) => ({ ...h, sections: h.sections.map((x) => (x.id === blockKey(id) ? { ...x, on } : x)) }));
  // in page order, so the list reads like the page
  const ordered = [...home.blocks].sort((a, b) => home.sections.findIndex((x) => x.id === blockKey(a.id)) - home.sections.findIndex((x) => x.id === blockKey(b.id)));

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">Add a box</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {HOME_BLOCK_STYLES.map((st) => {
          const Icon = BLOCK_ICONS[st.id];
          return (
            <button key={st.id} type="button" onClick={() => add(st.id)} title={st.hint} className={cx("flex h-11 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-bold transition hover:-translate-y-0.5 active:scale-[0.98]", BLOCK_SWATCH[st.id])}>
              <Plus className="size-3.5" />
              <Icon className="size-4" /> {st.label}
            </button>
          );
        })}
      </div>
      {ordered.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {ordered.map((b) => (
            <BlockCard key={b.id} b={b} on={shown(b.id)} cloud={cloud} onShow={(on) => show(b.id, on)} onEdit={(p) => edit(b.id, p)} onRemove={() => remove(b)} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] text-muted">No boxes yet. Add a notice, announcement, greeting or update - it appears at the top of the home page, and you can move it under Page layout.</p>
      )}
    </div>
  );
}

function BlockCard({ b, on, cloud, onShow, onEdit, onRemove }: { b: HomeBlock; on: boolean; cloud: boolean; onShow: (on: boolean) => void; onEdit: (p: Partial<HomeBlock>) => void; onRemove: () => void }) {
  const photo = usePhotoPicker(cloud, (url) => {
    if (b.image) forget(b.image);
    onEdit({ image: url });
  });
  const Icon = BLOCK_ICONS[b.style] ?? Type;
  return (
    <li className={cx("rounded-2xl border border-line bg-white p-3", !on && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx("grid size-8 place-items-center rounded-lg border", BLOCK_SWATCH[b.style])}>
          <Icon className="size-4" />
        </span>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Look">
          {HOME_BLOCK_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              role="radio"
              aria-checked={b.style === st.id}
              title={st.hint}
              onClick={() => onEdit({ style: st.id })}
              className={cx("h-7 rounded-full px-2.5 text-[12px] font-bold transition", b.style === st.id ? "bg-deep text-lime" : "text-muted hover:bg-canvas hover:text-ink")}
            >
              {st.label}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-2">
          <Switch checked={on} label={on ? "Shown on the website" : "Hidden"} onChange={onShow} />
          <button type="button" className={cx(iconBtn, "hover:bg-red-50 hover:text-red-600")} onClick={onRemove} aria-label="Delete this box" title="Delete">
            <Trash2 className="size-4" />
          </button>
        </span>
      </div>
      <Input className="mt-3 font-semibold" value={b.title} placeholder="Heading" aria-label="Heading" onChange={(e) => onEdit({ title: e.target.value })} />
      <Textarea className="mt-2" rows={2} value={b.text} placeholder="Text (optional) - line breaks are kept" aria-label="Text" onChange={(e) => onEdit({ text: e.target.value })} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input value={b.button ?? ""} placeholder="Button text (optional), e.g. Shop now" aria-label="Button text" onChange={(e) => onEdit({ button: e.target.value })} />
        <Input value={b.link ?? ""} placeholder="Button link, e.g. /products or https://…" aria-label="Button link" onChange={(e) => onEdit({ link: e.target.value })} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {b.image && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded photo
          <img src={b.image} alt="" className="h-12 w-16 rounded-lg object-cover ring-1 ring-line" />
        )}
        <Button size="sm" onClick={photo.open} disabled={photo.busy}>
          {photo.busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} {b.image ? "Change photo" : "Add a photo"}
        </Button>
        {b.image && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              forget(b.image!);
              onEdit({ image: undefined });
            }}
          >
            Remove photo
          </Button>
        )}
        {photo.input()}
      </div>
    </li>
  );
}

// ---------- partners & work experience ----------

const fromFileName = (f: File) =>
  f.name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A list of names with logos (partners, or places the shop has worked). */
export function LogoListEditor({
  kind,
  title,
  items,
  cloud,
  onTitle,
  update,
}: {
  kind: "partners" | "experience";
  title: string;
  items: LogoItem[];
  cloud: boolean;
  onTitle: (t: string) => void;
  update: (fn: (items: LogoItem[]) => LogoItem[]) => void;
}) {
  const word = kind === "partners" ? "partner" : "workplace";
  // several logos at once: one entry each, named after the file (rename it after)
  const bulk = usePhotoPicker(cloud, (url, f) => update((list) => [...list, { id: uid(), name: fromFileName(f), logo: url }]));
  const edit = (id: string, p: Partial<LogoItem>) => update((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const [added, setAdded] = useState(""); // the entry just added by hand: its name box takes the cursor
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">Section heading</span>
        <Input value={title} placeholder={kind === "partners" ? "Our partners" : "Where we have worked"} onChange={(e) => onTitle(e.target.value)} />
      </label>
      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((x, i) => (
            <LogoRow
              key={x.id}
              x={x}
              focus={x.id === added}
              kind={kind}
              cloud={cloud}
              first={i === 0}
              last={i === items.length - 1}
              onEdit={(p) => edit(x.id, p)}
              onMove={(d) => update((list) => moveIn(list, list.findIndex((y) => y.id === x.id), d))}
              onRemove={() => {
                if (x.logo) forget(x.logo);
                update((list) => list.filter((y) => y.id !== x.id));
              }}
            />
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="dark" onClick={bulk.open} disabled={bulk.busy}>
          {bulk.busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} Upload logos
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const id = uid();
            setAdded(id);
            update((list) => [...list, { id, name: "", logo: "" }]);
          }}
        >
          <Plus className="size-3.5" /> Add a {word} without a logo
        </Button>
        {bulk.input(true)}
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {items.length ? `${items.length} ${word}${items.length === 1 ? "" : "s"}. ` : "Nothing yet - the section stays hidden until you add one. "}
        You can pick several logo files at once; each becomes an entry named after its file. Logos look best on a white or clear background.
      </p>
    </div>
  );
}

function LogoRow({ x, focus, kind, cloud, first, last, onEdit, onMove, onRemove }: { x: LogoItem; focus: boolean; kind: "partners" | "experience"; cloud: boolean; first: boolean; last: boolean; onEdit: (p: Partial<LogoItem>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const photo = usePhotoPicker(cloud, (url) => {
    if (x.logo) forget(x.logo);
    onEdit({ logo: url });
  });
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-line bg-white p-2.5">
      <button type="button" onClick={photo.open} disabled={photo.busy} className="group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-line" aria-label={x.logo ? `Change ${x.name || "the"} logo` : "Upload a logo"} title={x.logo ? "Change logo" : "Upload logo"}>
        {photo.busy ? (
          <Loader2 className="size-5 animate-spin text-muted" />
        ) : x.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded logo
          <img src={x.logo} alt="" className="size-full bg-white object-contain p-1" />
        ) : (
          <ImagePlus className="size-5 text-faint" />
        )}
        {x.logo && !photo.busy && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">Change</span>}
      </button>
      {photo.input()}
      <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
        <Input autoFocus={focus} className="!h-9 font-semibold sm:col-span-2" value={x.name} placeholder={kind === "partners" ? "Partner name" : "Company / project name"} aria-label="Name" onChange={(e) => onEdit({ name: e.target.value })} />
        <Input className="!h-9 text-[13px]" value={x.note ?? ""} placeholder={kind === "partners" ? "Short line (optional)" : "What you did, e.g. Aquascape setup · 2024"} aria-label="Short line" onChange={(e) => onEdit({ note: e.target.value })} />
        <Input className="!h-9 text-[13px]" value={x.link ?? ""} placeholder="Website (optional)" aria-label="Website" onChange={(e) => onEdit({ link: e.target.value })} />
      </div>
      <span className="flex shrink-0 flex-col items-center sm:flex-row">
        <button type="button" className={iconBtn} disabled={first} onClick={() => onMove(-1)} aria-label="Move up" title="Move up">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" className={iconBtn} disabled={last} onClick={() => onMove(1)} aria-label="Move down" title="Move down">
          <ArrowDown className="size-4" />
        </button>
        <button type="button" className={cx(iconBtn, "hover:bg-red-50 hover:text-red-600")} onClick={onRemove} aria-label={`Remove ${x.name || "this entry"}`} title="Remove">
          <X className="size-4" />
        </button>
      </span>
    </li>
  );
}

// ---------- page layout ----------

/** Every part of the home page, top to bottom: move it, or switch it off. */
export function LayoutEditor({ home, update }: { home: HomeSettings; update: (fn: (h: HomeSettings) => HomeSettings) => void }) {
  const describe = (id: string) => {
    if (id.startsWith("block:")) {
      const b = home.blocks.find((x) => blockKey(x.id) === id);
      const st = HOME_BLOCK_STYLES.find((x) => x.id === b?.style);
      return { label: `${st?.label ?? "Text box"}: ${b?.title.trim() || "(no heading)"}`, hint: b?.text.trim() || "Your text box", Icon: BLOCK_ICONS[b?.style ?? "plain"] ?? Type, own: true };
    }
    const meta = HOME_SECTIONS.find((m) => m.id === id);
    const empty = (id === "partners" && !home.partners.length) || (id === "experience" && !home.experience.length);
    return { label: meta?.label ?? id, hint: empty ? "Hidden until you add logos" : (meta?.hint ?? ""), Icon: id === "partners" ? Handshake : id === "experience" ? BriefcaseBusiness : null, own: false };
  };
  return (
    <ul className="flex flex-col gap-1.5">
      <li className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-[13px] text-muted">
        <span className="w-5 text-[12px] font-bold text-faint">·</span> Big title, search box and photos (always at the top)
      </li>
      {home.sections.map((x, i) => {
        const d = describe(x.id);
        return (
          <li key={x.id} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2", d.own ? "border-aqua-deep/30 bg-white" : "border-line", !x.on && "bg-canvas opacity-70")}>
            <span className="w-5 text-[12px] font-bold text-faint">{i + 1}</span>
            {d.Icon && <d.Icon className="size-4 shrink-0 text-aqua-deep" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{d.label}</span>
              <span className="block truncate text-[12px] text-muted">{d.hint}</span>
            </span>
            <button type="button" className={iconBtn} disabled={i === 0} onClick={() => update((h) => ({ ...h, sections: moveIn(h.sections, h.sections.findIndex((y) => y.id === x.id), -1) }))} aria-label={`Move ${d.label} up`}>
              <ArrowUp className="size-4" />
            </button>
            <button type="button" className={iconBtn} disabled={i === home.sections.length - 1} onClick={() => update((h) => ({ ...h, sections: moveIn(h.sections, h.sections.findIndex((y) => y.id === x.id), 1) }))} aria-label={`Move ${d.label} down`}>
              <ArrowDown className="size-4" />
            </button>
            <Switch checked={x.on} label={`Show ${d.label}`} onChange={(on) => update((h) => ({ ...h, sections: h.sections.map((y) => (y.id === x.id ? { ...y, on } : y)) }))} />
          </li>
        );
      })}
    </ul>
  );
}

// ---------- live preview ----------

const DEVICES = { desktop: { w: 1280, label: "Computer", Icon: Monitor }, phone: { w: 390, label: "Phone", Icon: Smartphone } } as const;

/**
 * The store's home page in a frame, fed the settings being edited (not yet saved ones too), scaled to fit. The frame
 * loads the store's /preview page, which only accepts settings from the admin panel.
 */
export function PreviewPanel({ site }: { site: SiteSettings }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(site);
  const [where, setWhere] = useState<{ src: string; origin: string; live: string } | null>(null);
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState(false); // small screens: the preview folds away
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      const links = publicLinks(window.location.host);
      const src = absolute(links.store("/preview"), window.location.origin);
      setWhere({ src, origin: new URL(src).origin, live: links.store() });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const send = useCallback(() => {
    if (where) frame.current?.contentWindow?.postMessage({ type: PREVIEW_SITE, site: latest.current }, where.origin);
  }, [where]);

  useEffect(() => {
    latest.current = site;
    send();
  }, [site, send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || (e.data as { type?: string } | null)?.type !== PREVIEW_READY) return;
      send();
      setLoading(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = DEVICES[device].w;
  const scale = size.w ? Math.min(1, size.w / w) : 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
          </span>
          <span className="text-[15px] font-bold">Live preview</span>
        </span>
        <div className="flex rounded-xl border border-line bg-white p-0.5" role="radiogroup" aria-label="Screen size">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((k) => {
            const D = DEVICES[k];
            return (
              <button key={k} type="button" role="radio" aria-checked={device === k} onClick={() => setDevice(k)} className={cx("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-bold transition", device === k ? "bg-deep text-lime" : "text-muted hover:text-ink")}>
                <D.Icon className="size-3.5" /> {D.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={cx(iconBtn, "size-9 border border-line bg-white")}
          onClick={() => {
            setLoading(true);
            setReload((r) => r + 1);
          }}
          aria-label="Reload the preview (new products and reviews)"
          title="Reload (new products and reviews)"
        >
          <RotateCw className="size-4" />
        </button>
        {where && (
          <a href={where.live} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-deep px-3 text-[12.5px] font-semibold text-white hover:bg-ink">
            Open live page <ExternalLink className="size-3.5" />
          </a>
        )}
        <Button size="sm" className="!h-9 xl:hidden" onClick={() => setOpen((o) => !o)}>
          {open ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {open ? "Hide" : "Show"}
        </Button>
      </div>
      <div ref={box} className={cx("relative h-[72vh] overflow-hidden rounded-2xl border border-line bg-canvas xl:block xl:h-[calc(100dvh-var(--nav-h,0px)-9.5rem)]", open ? "block" : "hidden")}>
        {where && (
          <div className={cx("absolute top-0 h-full", device === "phone" && "border-x border-line shadow-xl")} style={{ width: w * scale, left: Math.max(0, (size.w - w * scale) / 2) }}>
            <iframe
              key={reload}
              ref={frame}
              src={where.src}
              title="Home page preview"
              className="origin-top-left border-0 bg-white"
              style={{ width: w, height: scale ? size.h / scale : size.h, transform: `scale(${scale})` }}
            />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-canvas/70">
            <Loader2 className="size-6 animate-spin text-muted" />
          </div>
        )}
      </div>
      <p className="text-[12px] text-muted">Changes save automatically and go live at once - the preview shows them as you type. Links don&apos;t open inside the preview. Products and reviews come from the live website.</p>
    </div>
  );
}
