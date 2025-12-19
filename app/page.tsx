"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type SlotStatus = "AVAILABLE" | "PENDING" | "CONFIRMED";

// ====== Time range config (10:00 -> 20:00) ======
const START_HOUR = 10; // 10AM
const END_HOUR = 20;   // 8PM (20:00)
const TIMES: string[] = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
  const h = START_HOUR + i;
  return `${String(h).padStart(2, "0")}:00`;
});

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

function fmtTimeLabel(t: string) {
  const [hh, mm] = t.split(":").map(Number);
  const ap = hh >= 12 ? "PM" : "AM";
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return `${h}:${String(mm).padStart(2, "0")}${ap}`;
}

export default function HomePage() {
  const todayIso = toISODate(new Date());
  const [startDate, setStartDate] = useState(() => todayIso);
  const [days, setDays] = useState(7);

  const [dates, setDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, Record<string, string>>>({});

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string>("");

  // modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ date: string; time: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // track if user manually changed start date
  const userPinnedStartDate = useRef(false);

  async function load() {
    setLoading(true);
    setBanner("");
    try {
      const res = await fetch(
        `/api/bookings/slots?start=${encodeURIComponent(startDate)}&days=${days}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load slots");
      setDates(data.dates || []);
      setSlots(data.slots || {});
    } catch (e: any) {
      setBanner(`❌ ${e?.message || "Failed to load"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, days]);

  // Auto-advance startDate when day changes ONLY if user hasn't pinned it manually
  useEffect(() => {
    let last = toISODate(new Date());

    const timer = setInterval(() => {
      const now = toISODate(new Date());
      if (now !== last) {
        last = now;
        if (!userPinnedStartDate.current) {
          setStartDate(now);
        }
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  const gridStatus = useMemo(() => {
    const map: Record<string, Record<string, SlotStatus>> = {};
    for (const d of dates) {
      map[d] = {};
      for (const t of TIMES) {
        const s = slots?.[d]?.[t];
        if (s === "PENDING") map[d][t] = "PENDING";
        else if (s === "CONFIRMED") map[d][t] = "CONFIRMED";
        else map[d][t] = "AVAILABLE";
      }
    }
    return map;
  }, [dates, slots]);

  function openModal(date: string, time: string) {
    setSelected({ date, time });
    setName("");
    setPhone("");
    setEmail("");
    setBanner("");
    setOpen(true);
  }

  async function submitBooking() {
    if (!selected) return;

    // Only Gmail
    const gmailOk = email.trim().toLowerCase().endsWith("@gmail.com");
    if (!gmailOk) {
      setBanner("❌ Only Gmail is allowed (must end with @gmail.com).");
      return;
    }
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setBanner("❌ Please fill Name / Phone / Gmail.");
      return;
    }

    setLoading(true);
    setBanner("");
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selected.date,
          time: selected.time,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Submit failed");

      setOpen(false);
      setBanner("✅ Submitted! Waiting for admin confirmation.");
      await load();
    } catch (e: any) {
      setBanner(`❌ ${e?.message || "Submit failed"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="title">Massage Booking</div>
          <div className="subtitle">Select a green slot, submit your info, wait for confirmation.</div>
        </div>

        <div className="controls">
          <div className="control">
            <div className="label">Start Date</div>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => {
                userPinnedStartDate.current = true;
                setStartDate(e.target.value);
              }}
            />
          </div>

          <div className="control">
            <div className="label">Days</div>
            <select
              className="input"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7</option>
              <option value={10}>10</option>
              <option value={14}>14</option>
            </select>
          </div>

          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            className="btn"
            onClick={() => {
              userPinnedStartDate.current = false;
              setStartDate(toISODate(new Date()));
            }}
            disabled={loading}
            title="Follow today's date automatically"
          >
            Today
          </button>
        </div>
      </div>

      <div className="legend">
        <div className="pill">
          <span className="dot green" /> Available
        </div>
        <div className="pill">
          <span className="dot yellow" /> Pending
        </div>
        <div className="pill">
          <span className="dot red" /> Confirmed
        </div>
      </div>

      {banner ? <div className="banner">{banner}</div> : null}

      <div className="boardWrap">
        <div className="board">
          {/* header row */}
          <div className="row header">
            <div className="cell dateCell headerCell">Date</div>
            {TIMES.map((t) => (
              <div key={t} className="cell headerCell timeCell">
                {fmtTimeLabel(t)}
              </div>
            ))}
          </div>

          {/* date rows */}
          {dates.map((d) => (
            <div key={d} className="row">
              <div className="cell dateCell">{fmtDateShort(d)}</div>
              {TIMES.map((t) => {
                const st = gridStatus?.[d]?.[t] ?? "AVAILABLE";
                const disabled = st !== "AVAILABLE";
                const cls =
                  st === "AVAILABLE" ? "slot green" : st === "PENDING" ? "slot yellow" : "slot red";

                return (
                  <button
                    key={t}
                    className={`cell ${cls}`}
                    onClick={() => openModal(d, t)}
                    disabled={disabled}
                    title={
                      st === "AVAILABLE"
                        ? "Click to book"
                        : st === "PENDING"
                        ? "Pending approval"
                        : "Confirmed"
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* modal */}
      {open && selected ? (
        <div className="modalBack" onMouseDown={() => setOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalTitle">
              Book {fmtDateShort(selected.date)} — {fmtTimeLabel(selected.time)}
            </div>

            <div className="form">
              <div className="field">
                <div className="label">Name</div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Phone</div>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Gmail</div>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                />
                <div className="hint">Only Gmail is allowed.</div>
              </div>
            </div>

            <div className="modalBtns">
              <button className="btn ghost" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </button>
              <button className="btn primary" onClick={submitBooking} disabled={loading}>
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        :root {
          --bg: #0b0f17;
          --card: rgba(255, 255, 255, 0.06);
          --card2: rgba(255, 255, 255, 0.08);
          --border: rgba(255, 255, 255, 0.10);
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.65);
          --green: #21c55d;
          --yellow: #fbbf24;
          --red: #ef4444;
        }
        body {
          margin: 0;
          background: radial-gradient(1200px 500px at 50% -20%, rgba(99,102,241,0.35), transparent 60%),
            radial-gradient(900px 450px at 15% 0%, rgba(34,197,94,0.18), transparent 60%),
            var(--bg);
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
            "Segoe UI Emoji";
        }
        .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 18px 60px;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .title {
          font-size: 28px;
          font-weight: 750;
          letter-spacing: 0.2px;
        }
        .subtitle {
          margin-top: 6px;
          color: var(--muted);
          font-size: 14px;
        }
        .controls {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .control .label {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .input {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          color: var(--text);
          outline: none;
          min-width: 160px;
        }
        select.input { min-width: 90px; }
        .btn {
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.08);
          color: var(--text);
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 650;
        }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn.primary {
          background: rgba(99,102,241,0.30);
          border-color: rgba(99,102,241,0.45);
        }
        .btn.ghost { background: transparent; }

        .legend {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 10px 0 12px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.05);
          color: var(--muted);
          font-size: 12px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-block;
        }
        .dot.green { background: var(--green); }
        .dot.yellow { background: var(--yellow); }
        .dot.red { background: var(--red); }

        .banner {
          margin: 10px 0 14px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.06);
          padding: 12px 14px;
          border-radius: 14px;
          color: var(--text);
        }

        .boardWrap {
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          border-radius: 18px;
          padding: 14px;
          overflow: auto;
        }
        .board {
          min-width: 900px;
        }
        .row {
          display: grid;
          grid-template-columns: 110px repeat(${TIMES.length}, 1fr);
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }
        .header {
          position: sticky;
          top: 0;
          z-index: 5;
          padding-top: 4px;
          background: rgba(11,15,23,0.70);
          backdrop-filter: blur(10px);
        }
        .cell {
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
        }
        .headerCell {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .dateCell {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          color: var(--text);
          font-weight: 750;
          letter-spacing: 0.2px;
        }

        button.cell.slot {
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.10);
          transition: transform 120ms ease, filter 120ms ease;
        }
        button.cell.slot:hover { transform: translateY(-1px); filter: brightness(1.08); }
        button.cell.slot:disabled { cursor: not-allowed; opacity: 0.95; }

        .slot.green { background: rgba(34,197,94,0.35); border-color: rgba(34,197,94,0.55); }
        .slot.yellow { background: rgba(251,191,36,0.35); border-color: rgba(251,191,36,0.55); }
        .slot.red { background: rgba(239,68,68,0.35); border-color: rgba(239,68,68,0.55); }

        .modalBack {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 50;
        }
        .modal {
          width: 520px;
          max-width: 100%;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: rgba(15, 20, 32, 0.95);
          backdrop-filter: blur(12px);
          padding: 16px;
        }
        .modalTitle {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .form {
          display: grid;
          gap: 10px;
        }
        .field .label {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .hint {
          margin-top: 6px;
          color: var(--muted);
          font-size: 12px;
        }
        .modalBtns {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
      `}</style>
    </div>
  );
}
