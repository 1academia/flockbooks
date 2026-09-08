"use client";

import { useMemo, useState } from "react";
import { createServiceRecord } from "../actions";

type Fund = { id: string; name: string };

const DENOMS: { key: string; label: string; value: number }[] = [
  { key: "q1000", label: "₦1000", value: 1000 },
  { key: "q500", label: "₦500", value: 500 },
  { key: "q200", label: "₦200", value: 200 },
  { key: "q100", label: "₦100", value: 100 },
  { key: "q50", label: "₦50", value: 50 },
  { key: "q20", label: "₦20", value: 20 },
  { key: "q10", label: "₦10", value: 10 },
];

const STEPS = ["Service details", "Cash count", "Attendance & evidence", "Review & save"] as const;

export default function NewServiceForm(props: {
  branchId: string;
  funds: Fund[];
  today: string;
  defaultServiceType: "sunday" | "midweek";
}) {
  const { branchId, funds, today, defaultServiceType } = props;
  const [step, setStep] = useState(0);

  const [serviceDate, setServiceDate] = useState(today);
  const [serviceType, setServiceType] = useState<"sunday" | "midweek">(defaultServiceType);
  const [minister, setMinister] = useState("");
  const [sermonTitle, setSermonTitle] = useState("");

  // counts[fundId][denomKey|"coins"] = string
  const [counts, setCounts] = useState<Record<string, Record<string, string>>>({});
  const setCount = (fundId: string, key: string, val: string) =>
    setCounts((prev) => ({ ...prev, [fundId]: { ...prev[fundId], [key]: val } }));

  const [male, setMale] = useState("");
  const [female, setFemale] = useState("");
  const [children, setChildren] = useState("");
  const [teenage, setTeenage] = useState("");
  const [counter1, setCounter1] = useState("");
  const [counter2, setCounter2] = useState("");
  const [counter3, setCounter3] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  function fundTotal(fundId: string) {
    const c = counts[fundId] || {};
    let total = 0;
    for (const d of DENOMS) total += (Number(c[d.key]) || 0) * d.value;
    total += Number(c.coins) || 0;
    return total;
  }
  const grandTotal = useMemo(
    () => funds.reduce((sum, f) => sum + fundTotal(f.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funds, counts]
  );
  const attendanceTotal = (Number(male) || 0) + (Number(female) || 0) + (Number(children) || 0) + (Number(teenage) || 0);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const canAdvance =
    step === 0 ? !!serviceDate :
    step === 2 ? !!photoFile :
    true;

  return (
    <div className="max-w-2xl">
      <ol className="flex items-center gap-2 mb-6 flex-wrap">
        {STEPS.map((label, i) => (
          <li key={label} className={`text-[12px] px-3 py-1.5 rounded-full mono uppercase tracking-wide ${
            i === step ? "bg-[var(--navy)] text-white" : i < step ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--ice)] text-[var(--slate)]"
          }`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <form action={createServiceRecord} className="space-y-6">
        <input type="hidden" name="branch_id" value={branchId} />

        {/* Step 0 — Service details */}
        <section hidden={step !== 0} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
          <Field label="Service date" name="service_date" type="date" value={serviceDate} onChange={setServiceDate} required />
          <div>
            <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Service type</label>
            <div className="flex gap-3">
              {(["sunday", "midweek"] as const).map((t) => (
                <label key={t} className={`flex-1 text-center rounded-lg border px-3 py-2.5 text-[14px] cursor-pointer ${
                  serviceType === t ? "border-[var(--navy)] bg-[var(--ice)] font-semibold" : "border-[var(--line)]"
                }`}>
                  <input type="radio" name="service_type" value={t} checked={serviceType === t}
                    onChange={() => setServiceType(t)} className="sr-only" />
                  {t === "sunday" ? "Sunday" : "Mid-week"}
                </label>
              ))}
            </div>
          </div>
          <Field label="Minister" name="minister" value={minister} onChange={setMinister} placeholder="Who preached" />
          <Field label="Sermon title" name="sermon_title" value={sermonTitle} onChange={setSermonTitle} />
        </section>

        {/* Step 1 — Cash count per fund */}
        <section hidden={step !== 1} className="space-y-4">
          {funds.length === 0 && (
            <p className="text-sm text-[var(--slate)]">
              No active funds yet — a Sub Admin can add some from the branch page.
            </p>
          )}
          {funds.map((f) => (
            <div key={f.id} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14.5px] font-semibold">{f.name}</h3>
                <span className="mono text-[13px] text-[var(--navy)] font-semibold">₦{fundTotal(f.id).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DENOMS.map((d) => (
                  <div key={d.key}>
                    <label className="block text-[11px] text-[var(--slate)] mb-1">{d.label} qty</label>
                    <input type="number" min={0} inputMode="numeric" name={`fund_${f.id}_${d.key}`}
                      value={counts[f.id]?.[d.key] ?? ""} onChange={(e) => setCount(f.id, d.key, e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-2.5 py-2 text-[14px] outline-none focus:border-[var(--navy)]" />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] text-[var(--slate)] mb-1">Coins/Other ₦</label>
                  <input type="number" min={0} inputMode="numeric" name={`fund_${f.id}_coins`}
                    value={counts[f.id]?.coins ?? ""} onChange={(e) => setCount(f.id, "coins", e.target.value)}
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-2.5 py-2 text-[14px] outline-none focus:border-[var(--navy)]" />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-1">
            <span className="text-[14px] font-semibold">Grand total (all funds)</span>
            <span className="mono text-[17px] font-semibold text-[var(--navy)]">₦{grandTotal.toLocaleString()}</span>
          </div>
        </section>

        {/* Step 2 — Attendance, counters, evidence photo */}
        <section hidden={step !== 2} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Male" name="male" type="number" value={male} onChange={setMale} />
            <Field label="Female" name="female" type="number" value={female} onChange={setFemale} />
            <Field label="Children" name="children" type="number" value={children} onChange={setChildren} />
            <Field label="Teenage" name="teenage" type="number" value={teenage} onChange={setTeenage} />
          </div>
          <p className="text-[13px] text-[var(--slate)]">Attendance total: <b className="text-[var(--ink)]">{attendanceTotal}</b></p>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Counter 1" name="counter1_name" value={counter1} onChange={setCounter1} />
            <Field label="Counter 2" name="counter2_name" value={counter2} onChange={setCounter2} />
            <Field label="Counter 3" name="counter3_name" value={counter3} onChange={setCounter3} />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
              Photo of the paper Cash Analysis / Record of Activities sheet
            </label>
            <p className="text-[12px] text-[var(--slate)] mb-2">
              Evidence the hard copy was actually filled in and counted in person — kept alongside these typed
              numbers, never used to fill them in.
            </p>
            <input type="file" name="paper_form_photo" accept="image/*" capture="environment" required onChange={handlePhoto}
              className="w-full text-[13.5px]" />
            {photoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Paper form preview" className="mt-3 max-h-48 rounded-lg border border-[var(--line)]" />
            )}
          </div>
        </section>

        {/* Step 3 — Review */}
        <section hidden={step !== 3} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
          <h3 className="text-[15px] font-semibold">Check everything before saving</h3>
          <ReviewRow label="Date" value={`${serviceDate} (${serviceType === "sunday" ? "Sunday" : "Mid-week"})`} />
          <ReviewRow label="Minister" value={minister || "—"} />
          <ReviewRow label="Sermon" value={sermonTitle || "—"} />
          <div className="border-t border-[var(--line)] pt-3">
            {funds.map((f) => (
              <ReviewRow key={f.id} label={f.name} value={`₦${fundTotal(f.id).toLocaleString()}`} />
            ))}
            <ReviewRow label="Grand total" value={`₦${grandTotal.toLocaleString()}`} bold />
          </div>
          <div className="border-t border-[var(--line)] pt-3">
            <ReviewRow label="Attendance" value={`${attendanceTotal} (M ${male || 0} · F ${female || 0} · Ch ${children || 0} · Tn ${teenage || 0})`} />
            <ReviewRow label="Counters" value={[counter1, counter2, counter3].filter(Boolean).join(", ") || "—"} />
            <ReviewRow label="Evidence photo" value={photoFile ? photoFile.name : "Not attached"} />
          </div>
          <p className="text-[12.5px] text-[var(--slate)]">
            Saving sends this straight to your Accountant for the first sign-off. Double-check the numbers above —
            they match what&apos;s on the paper sheet, not the other way around.
          </p>
        </section>

        <div className="flex items-center justify-between pt-2">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-[13.5px] font-medium disabled:opacity-40">
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!canAdvance} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-lg bg-[var(--navy)] text-white font-semibold px-5 py-2.5 text-[14px] disabled:opacity-40">
              Continue
            </button>
          ) : (
            <button type="submit"
              className="rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold px-5 py-2.5 text-[14px]">
              Save Record
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field(props: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">{props.label}</label>
      <input
        name={props.name}
        type={props.type || "text"}
        min={props.type === "number" ? 0 : undefined}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
      />
    </div>
  );
}

function ReviewRow(props: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13.5px] text-[var(--slate)]">{props.label}</span>
      <span className={`text-[13.5px] ${props.bold ? "font-semibold text-[var(--navy)]" : ""}`}>{props.value}</span>
    </div>
  );
}
