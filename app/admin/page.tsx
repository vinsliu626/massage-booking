"use client";

import { useMemo, useState } from "react";

type Booking = {
  id: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}/${y}`;
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/bookings?key=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed");
      setList(data.list || []);
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, action: "confirm" | "reject") {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/bookings/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, id, action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Failed"}`);
    } finally {
      setLoading(false);
    }
  }

  const pending = useMemo(() => list.filter((x) => x.status === "PENDING"), [list]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>Admin Dashboard</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Pending: <b>{pending.length}</b>
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="ADMIN key"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
            minWidth: 240,
          }}
        />
        <button onClick={load} disabled={!key || loading} style={{ padding: "10px 12px", borderRadius: 10 }}>
          {loading ? "Loading..." : "Load Bookings"}
        </button>
      </div>

      {msg ? <div style={{ marginBottom: 12 }}>{msg}</div> : null}

      <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.05)" }}>
              <th style={th}>Date</th>
              <th style={th}>Time</th>
              <th style={th}>Name</th>
              <th style={th}>Phone</th>
              <th style={th}>Email</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                <td style={td}>{fmtDate(b.date)}</td>
                <td style={td}>{b.time}</td>
                <td style={td}>{b.name}</td>
                <td style={td}>{b.phone}</td>
                <td style={td}>{b.email}</td>
                <td style={td}>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      background:
                        b.status === "PENDING" ? "#fbbf24" : b.status === "CONFIRMED" ? "#ef4444" : "#9ca3af",
                      color: "#111",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {b.status}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => decide(b.id, "confirm")}
                      disabled={loading || b.status !== "PENDING"}
                      style={{ padding: "8px 10px", borderRadius: 10 }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => decide(b.id, "reject")}
                      disabled={loading || b.status !== "PENDING"}
                      style={{ padding: "8px 10px", borderRadius: 10 }}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {list.length === 0 ? (
              <tr>
                <td style={{ padding: 14, opacity: 0.7 }} colSpan={7}>
                  No bookings yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 12, fontSize: 12, opacity: 0.8 };
const td: React.CSSProperties = { padding: 12, fontSize: 14 };
