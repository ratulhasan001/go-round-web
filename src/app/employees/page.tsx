"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, IdCard, Loader2, QrCode, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { todayISO, uid } from "@/lib/calc";
import { makeStaffCode, thumb } from "@/lib/site";
import { forget, storePhoto } from "@/lib/photos";
import { initials } from "@/lib/theme";
import type { Employee } from "@/lib/types";
import { ListEditor } from "@/components/ListEditor";
import { StaffQrDialog } from "@/components/StaffQrDialog";
import { Input, cx, useToast } from "@/components/ui";

const active = (e: Employee) => e.active !== false;
const byName = (a: Employee, b: Employee) => a.name.trim().localeCompare(b.name.trim(), undefined, { numeric: true, sensitivity: "base" });
const updated = (e: Employee) => e.updatedAt ?? 0;

export default function EmployeesPage() {
  const { employees, setEmployees } = useStore();
  const [qrFor, setQrFor] = useState<string | null>(null);
  const staff = employees.filter(active);
  const shown = qrFor ? employees.find((e) => e.id === qrFor) ?? null : null;

  return (
    <>
      <ListEditor<Employee>
        section="employees"
        title="Employees"
        subtitle={
          employees.length
            ? `${staff.length} active · ${staff.filter((e) => e.head).length} team head${staff.filter((e) => e.head).length === 1 ? "" : "s"}. Each person has a QR code that shows customers they really work for you.`
            : "Keep your staff's details here. Everyone gets a QR code that opens a page showing they really work for you."
        }
        icon={<IdCard className="size-5" />}
        noun="Employee"
        rows={employees}
        onChange={setEmployees}
        tableFrom="2xl"
        // a new person gets their verification code (and so their QR) straight away
        blank={() => ({ id: uid(), name: "", phone: "", role: "", joined: todayISO(), notes: "", active: true, code: makeStaffCode(), updatedAt: Date.now() })}
        touch={(e) => ({ ...e, code: e.code || makeStaffCode(), updatedAt: Date.now() })}
        sorts={[
          { label: "Recently updated", compare: (a, b) => updated(b) - updated(a) },
          { label: "Name A → Z", compare: byName },
          { label: "Newest joined", compare: (a, b) => b.joined.localeCompare(a.joined) || byName(a, b) },
          { label: "Longest serving", compare: (a, b) => (a.joined || "9").localeCompare(b.joined || "9") || byName(a, b) },
          { label: "Team heads first", compare: (a, b) => Number(!!b.head) - Number(!!a.head) || byName(a, b) },
        ]}
        filters={[
          { label: "Active", test: active },
          { label: "Former", test: (e) => !active(e) },
          { label: "Team heads", test: (e) => !!e.head },
          { label: "Attendants", test: (e) => !e.head },
        ]}
        lead={(e) =>
          e.head && e.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded staff photo
            <img key={e.photo} src={thumb(e.photo)} alt="" title="Team head" className={cx("animate-lead-pop size-9 rounded-full object-cover ring-2", active(e) ? "ring-lime" : "opacity-50 ring-line")} />
          ) : (
            <span
              key={`${initials(e.name || "?")}-${active(e)}`}
              title={active(e) ? "Works here" : "No longer works here"}
              className={cx("animate-lead-pop grid size-9 place-items-center rounded-full text-[12px] font-extrabold", active(e) ? "bg-rose-50 text-rose-600" : "bg-canvas text-faint")}
            >
              {e.name.trim() ? initials(e.name) : "?"}
            </span>
          )
        }
        rowActions={(e) => (
          <button
            type="button"
            onClick={() => {
              if (!e.code) setEmployees(employees.map((x) => (x.id === e.id ? { ...x, code: makeStaffCode(), updatedAt: Date.now() } : x)));
              setQrFor(e.id);
            }}
            className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-canvas hover:text-ink active:scale-90"
            aria-label={`QR code for ${e.name || "this employee"}`}
            title="QR code & ID card"
          >
            <QrCode className="size-[18px]" />
          </button>
        )}
        columns={[
          { key: "name", label: "Name", placeholder: "Full name", width: "minmax(0,1.3fr)" },
          { key: "phone", label: "Phone", type: "tel", placeholder: "01XXXXXXXXX", width: "150px" },
          { key: "role", label: "Role", placeholder: "e.g. Delivery, Packing", width: "minmax(0,1fr)" },
          {
            key: "joined",
            label: "Joined",
            type: "custom",
            width: "150px",
            render: (e, update) => <Input type="date" aria-label="Joining date" value={e.joined} onChange={(ev) => update({ joined: ev.target.value })} />,
          },
          {
            key: "head",
            label: "Team",
            type: "custom",
            width: "230px",
            render: (e, update) => <TeamCell e={e} update={update} />,
          },
          { key: "active", label: "Status", type: "toggle", on: "Active", off: "Former", width: "140px" },
          { key: "notes", label: "Notes", placeholder: "NID, address, emergency contact…", width: "minmax(0,1.4fr)" },
        ]}
      />
      <StaffQrDialog employee={shown} onClose={() => setQrFor(null)} />
    </>
  );
}

/** Team head or attendant; team heads get a photo (shown on their ID card and verification page). */
function TeamCell({ e, update }: { e: Employee; update: (patch: Partial<Employee>) => void }) {
  const { mode, employees, setEmployees } = useStore();
  const toast = useToast();
  // the newest list: an upload finishes after other edits may have been made
  const latest = useRef(employees);
  useEffect(() => {
    latest.current = employees;
  });
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const seg = (on: boolean) => cx("h-full flex-1 rounded-lg px-2 text-[12.5px] font-bold transition", on ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink");
  return (
    <div className="flex h-10 items-center gap-1.5">
      <div className="flex h-full flex-1 rounded-xl bg-canvas p-1" role="radiogroup" aria-label="Team role">
        <button type="button" role="radio" aria-checked={!!e.head} className={seg(!!e.head)} onClick={() => update({ head: true })}>
          Team head
        </button>
        <button type="button" role="radio" aria-checked={!e.head} className={seg(!e.head)} onClick={() => update({ head: false })}>
          Attendant
        </button>
      </div>
      {e.head && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="grid size-10 place-items-center overflow-hidden rounded-xl border border-dashed border-line text-muted transition hover:border-aqua-deep hover:text-aqua-deep"
            aria-label={e.photo ? "Change photo" : "Add photo"}
            title={e.photo ? "Change photo" : "Add photo"}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : e.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded staff photo
              <img src={thumb(e.photo)} alt="" className="size-full object-cover" />
            ) : (
              <Camera className="size-4" />
            )}
          </button>
          {e.photo && !busy && (
            <button
              type="button"
              onClick={() => {
                forget(e.photo!);
                update({ photo: undefined });
              }}
              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-white text-red-600 shadow ring-1 ring-line"
              aria-label="Remove photo"
              title="Remove photo"
            >
              <X className="size-3" />
            </button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = "";
              if (!f) return;
              if (!f.type.startsWith("image/")) return toast("Choose a photo file", "err");
              setBusy(true);
              try {
                const url = await storePhoto(f, mode === "cloud");
                const old = latest.current.find((x) => x.id === e.id)?.photo;
                if (old) forget(old);
                setEmployees(latest.current.map((x) => (x.id === e.id ? { ...x, photo: url, updatedAt: Date.now() } : x)));
                toast("Photo added");
              } catch {
                toast("The photo couldn't be uploaded", "err");
              }
              setBusy(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
