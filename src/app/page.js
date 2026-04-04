"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ── CONFIG ──────────────────────────────────────────────────────────────
const PLAYERS = [
  "Patrick", "Spieler 2", "Spieler 3", "Spieler 4",
  "Spieler 5", "Spieler 6", "Spieler 7",
];

// Par pro Loch (Par 72 gesamt) — an euren Platz anpassen!
const PAR_DATA = [
  4, 3, 5, 4, 4, 3, 4, 5, 4, // Front 9 (Par 36)
  4, 4, 3, 5, 4, 4, 3, 4, 5, // Back 9 (Par 36)
];
const TOTAL_PAR = PAR_DATA.reduce((a, b) => a + b, 0);
const DAYS = [1, 2, 3, 4];

// Punkte-Berechnung
function calcPoints(strokes, par) {
  if (strokes <= par - 1) return 2; // Birdie oder besser
  if (strokes === par) return 1;     // Par
  return 0;                           // Bogey+
}

function strokeLabel(strokes, par) {
  const d = strokes - par;
  if (d <= -3) return "Albatross";
  if (d === -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Dbl Bogey";
  return `+${d}`;
}

function pointColor(pts) {
  return pts === 2 ? "var(--green)" : pts === 1 ? "var(--blue)" : "#636e72";
}

const MEDALS = ["🥇", "🥈", "🥉"];

// ── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function GolfLiveScoring() {
  const [scores, setScores] = useState([]);
  const [tab, setTab] = useState("live");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);

  // Live scoring
  const [day, setDay] = useState(1);
  const [player, setPlayer] = useState(PLAYERS[0]);
  const [hole, setHole] = useState(1);
  const [strokes, setStrokes] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Leaderboard & Scorecard
  const [lbDay, setLbDay] = useState(1);
  const [scPlayer, setScPlayer] = useState(PLAYERS[0]);
  const [scDay, setScDay] = useState(0);

  const toastTimer = useRef(null);

  // ── TOAST ─────────────────────────────────────────────────────────────
  const flash = useCallback((msg, type = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ── INITIAL LOAD ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data, error } = await supabase
        .from("scores")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Load error:", error);
        setOnline(false);
      } else {
        setScores(data || []);
      }
      setLoading(false);
    }
    init();
  }, []);

  // ── REALTIME SUBSCRIPTION ─────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("scores-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setScores((prev) => {
              // Vermeidung von Duplikaten
              if (prev.find((s) => s.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "UPDATE") {
            setScores((prev) =>
              prev.map((s) => (s.id === payload.new.id ? payload.new : s))
            );
          } else if (payload.eventType === "DELETE") {
            setScores((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setOnline(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── NEXT HOLE HELPER ──────────────────────────────────────────────────
  const nextHole = useCallback(
    (d, p, sc) => {
      for (let h = 1; h <= 18; h++) {
        if (!sc.find((s) => s.day === d && s.player === p && s.hole === h))
          return h;
      }
      return null;
    },
    []
  );

  useEffect(() => {
    const n = nextHole(day, player, scores);
    if (n) setHole(n);
    setStrokes(null);
    setShowConfirm(false);
  }, [day, player, scores, nextHole]);

  // ── SUBMIT SCORE ──────────────────────────────────────────────────────
  const existing = scores.find(
    (s) => s.day === day && s.player === player && s.hole === hole
  );
  const par = PAR_DATA[hole - 1];
  const preview =
    strokes !== null
      ? { pts: calcPoints(strokes, par), label: strokeLabel(strokes, par) }
      : null;

  const submitScore = useCallback(async () => {
    if (strokes === null || saving) return;
    setSaving(true);
    const pts = calcPoints(strokes, par);
    const entry = { player, day, hole, strokes, par, points: pts };

    if (existing) {
      // UPDATE
      const { error } = await supabase
        .from("scores")
        .update({ strokes, points: pts })
        .eq("id", existing.id);
      if (error) {
        flash("Fehler beim Aktualisieren", "err");
        console.error(error);
      } else {
        flash(
          `Loch ${hole}: ${strokes} Schläge → ${pts} Pkt (${strokeLabel(strokes, par)})`
        );
      }
    } else {
      // INSERT (UPSERT mit ON CONFLICT)
      const { error } = await supabase.from("scores").upsert(entry, {
        onConflict: "player,day,hole",
      });
      if (error) {
        flash("Fehler beim Speichern", "err");
        console.error(error);
      } else {
        flash(
          `Loch ${hole}: ${strokes} Schläge → ${pts} Pkt (${strokeLabel(strokes, par)})`
        );
      }
    }
    setSaving(false);
    setStrokes(null);
    setShowConfirm(false);
  }, [strokes, par, player, day, hole, existing, saving, flash]);

  // ── DELETE SCORE ──────────────────────────────────────────────────────
  const deleteScore = useCallback(
    async (id) => {
      const { error } = await supabase.from("scores").delete().eq("id", id);
      if (error) {
        flash("Fehler beim Löschen", "err");
      } else {
        flash("Gelöscht", "err");
      }
    },
    [flash]
  );

  const resetAll = useCallback(async () => {
    if (!confirm("Wirklich ALLE Scores löschen? Das kann nicht rückgängig gemacht werden."))
      return;
    const { error } = await supabase.from("scores").delete().gte("id", 0);
    if (error) flash("Fehler", "err");
    else flash("Alle Scores gelöscht", "err");
  }, [flash]);

  // ── LEADERBOARD CALC ──────────────────────────────────────────────────
  const dayBoard = useCallback(
    (d) => {
      const m = {};
      PLAYERS.forEach((p) => {
        m[p] = { player: p, pts: 0, holes: 0, str: 0, parT: 0 };
      });
      scores
        .filter((s) => s.day === d)
        .forEach((s) => {
          m[s.player].pts += s.points;
          m[s.player].holes++;
          m[s.player].str += s.strokes;
          m[s.player].parT += s.par;
        });
      return Object.values(m).sort(
        (a, b) => b.pts - a.pts || a.str - b.str
      );
    },
    [scores]
  );

  const totalBoard = useCallback(() => {
    const m = {};
    PLAYERS.forEach((p) => {
      m[p] = { player: p, pts: 0, holes: 0, str: 0, parT: 0, days: new Set() };
    });
    scores.forEach((s) => {
      m[s.player].pts += s.points;
      m[s.player].holes++;
      m[s.player].str += s.strokes;
      m[s.player].parT += s.par;
      m[s.player].days.add(s.day);
    });
    return Object.values(m)
      .map((p) => ({ ...p, days: p.days.size }))
      .sort((a, b) => b.pts - a.pts || a.str - b.str);
  }, [scores]);

  const played = scores.filter(
    (s) => s.day === day && s.player === player
  ).length;

  // ── LOADING ───────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="loading-screen">
        <div className="loading-spinner">⛳</div>
        <div>Verbinde mit Supabase...</div>
      </div>
    );

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className="toast"
          style={{ background: toast.type === "err" ? "var(--danger)" : "var(--green-dark)" }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="header">
        <span className="header-icon">⛳</span>
        <div>
          <h1>
            Live Scoring
            <span className="live-dot" title={online ? "Verbunden" : "Offline"} />
          </h1>
          <p>4 Tage · 7 Spieler · Par {TOTAL_PAR}</p>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tab-bar">
        {[
          ["live", "⛳", "Live"],
          ["board", "📊", "Tag"],
          ["total", "🏆", "Gesamt"],
          ["card", "📋", "Karte"],
        ].map(([id, ic, lb]) => (
          <button
            key={id}
            className={`tab-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            <span className="icon">{ic}</span>
            <span className="label">{lb}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {/* ═══════════════ LIVE SCORING ═══════════════ */}
        {tab === "live" && (
          <>
            {/* Day + Player */}
            <div className="card">
              <div className="chip-row">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    className={`chip ${day === d ? "active" : ""}`}
                    onClick={() => setDay(d)}
                  >
                    Tag {d}
                  </button>
                ))}
              </div>
              <div className="player-list">
                {PLAYERS.map((p) => {
                  const cnt = scores.filter(
                    (s) => s.day === day && s.player === p
                  ).length;
                  return (
                    <button
                      key={p}
                      className={`player-btn ${player === p ? "active" : ""}`}
                      onClick={() => setPlayer(p)}
                    >
                      <span className="name">{p}</span>
                      <span className="prog">{cnt}/18</span>
                      {cnt === 18 && <span className="done">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hole */}
            <div className="card">
              <div className="hole-card-top">
                <div>
                  <div className="hole-label">Loch</div>
                  <div className="hole-num">{hole}</div>
                </div>
                <div className="hole-par-box">
                  <div className="hole-label">Par</div>
                  <div className="hole-par-val">{par}</div>
                </div>
                <div>
                  <div className="hole-label">Gespielt</div>
                  <div className="hole-prog-val">{played}/18</div>
                </div>
              </div>
              <div className="hole-strip">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => {
                  const done = scores.find(
                    (s) =>
                      s.day === day && s.player === player && s.hole === h
                  );
                  return (
                    <button
                      key={h}
                      className={`h-dot ${hole === h ? "current" : ""} ${done ? "done" : ""}`}
                      onClick={() => {
                        setHole(h);
                        setStrokes(null);
                        setShowConfirm(false);
                      }}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stroke entry */}
            <div className="card">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Bruttoschläge eingeben
                {existing && (
                  <span className="entry-exist">
                    aktuell: {existing.strokes}
                  </span>
                )}
              </div>

              <div className="stroke-grid">
                {(() => {
                  const vals = [];
                  for (let i = Math.max(1, par - 2); i <= par + 5; i++)
                    vals.push(i);
                  return vals.map((v) => {
                    const pts = calcPoints(v, par);
                    const sel = strokes === v;
                    const cat =
                      pts === 2 ? "birdie" : pts === 1 ? "par" : "bogey";
                    return (
                      <button
                        key={v}
                        className={`s-btn ${cat} ${sel ? "selected" : ""}`}
                        onClick={() => {
                          setStrokes(v);
                          setShowConfirm(true);
                        }}
                      >
                        <span className="num">{v}</span>
                        <span className="lbl">{strokeLabel(v, par)}</span>
                        <span
                          className="pts"
                          style={{
                            background: sel
                              ? "rgba(255,255,255,0.25)"
                              : `${pts === 2 ? "#2ecc71" : pts === 1 ? "#3498db" : "#636e72"}22`,
                            color: sel ? "#fff" : undefined,
                          }}
                        >
                          {pts} {pts === 1 ? "Punkt" : "Punkte"}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>

              {showConfirm && strokes !== null && (
                <div className="confirm-box">
                  <div className="confirm-summary">
                    <span className="player">{player}</span>
                    <span className="arrow">→</span>
                    <span>Loch {hole}</span>
                    <span className="arrow">→</span>
                    <span style={{ fontWeight: 800 }}>{strokes} Schläge</span>
                    <span className="arrow">=</span>
                    <span
                      className="pts-badge"
                      style={{ background: preview.pts === 2 ? "#2ecc71" : preview.pts === 1 ? "#3498db" : "#636e72" }}
                    >
                      {preview.pts} Pkt
                    </span>
                  </div>
                  <button
                    className="save-btn"
                    onClick={submitScore}
                    disabled={saving}
                    style={{ opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? "Speichern..." : "✓ Speichern"}
                  </button>
                </div>
              )}
            </div>

            {/* Recent */}
            {(() => {
              const recent = scores
                .filter((s) => s.day === day && s.player === player)
                .sort((a, b) => b.hole - a.hole)
                .slice(0, 5);
              if (!recent.length) return null;
              return (
                <div className="card">
                  <div className="recent-hdr">
                    Letzte Einträge — {player}, Tag {day}
                  </div>
                  {recent.map((s) => (
                    <div className="r-row" key={s.id}>
                      <span className="hole">Loch {s.hole}</span>
                      <span className="muted">Par {s.par}</span>
                      <span className="str">{s.strokes} Schl.</span>
                      <span className="slbl">
                        {strokeLabel(s.strokes, s.par)}
                      </span>
                      <span
                        className="pts-dot"
                        style={{
                          background:
                            s.points === 2
                              ? "#2ecc71"
                              : s.points === 1
                                ? "#3498db"
                                : "#636e72",
                        }}
                      >
                        {s.points}
                      </span>
                      <button
                        className="del"
                        onClick={() => deleteScore(s.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ═══════════════ DAY LEADERBOARD ═══════════════ */}
        {tab === "board" && (
          <div className="card">
            <div className="card-title">Tages-Leaderboard</div>
            <div className="chip-row">
              {DAYS.map((d) => (
                <button
                  key={d}
                  className={`chip ${lbDay === d ? "active" : ""}`}
                  onClick={() => setLbDay(d)}
                >
                  Tag {d}
                </button>
              ))}
            </div>
            <div className="board">
              {dayBoard(lbDay).map((p, i) => (
                <div
                  key={p.player}
                  className={`b-row ${i === 0 && p.holes > 0 ? "gold" : ""}`}
                >
                  <span className="rank">
                    {i < 3 && p.holes > 0 ? MEDALS[i] : `${i + 1}.`}
                  </span>
                  <span className="name">{p.player}</span>
                  <span className="meta">{p.holes}/18</span>
                  <span className="diff">
                    {p.str > 0
                      ? (p.str - p.parT >= 0 ? "+" : "") + (p.str - p.parT)
                      : "–"}
                  </span>
                  <span className="pts">{p.pts}</span>
                </div>
              ))}
            </div>
            <div className="board-legend">
              Sortiert nach Punkten · bei Gleichstand nach Bruttoschlägen
            </div>
          </div>
        )}

        {/* ═══════════════ OVERALL ═══════════════ */}
        {tab === "total" && (
          <>
            <div className="card">
              <div className="card-title">Gesamtwertung 🏆</div>
              <div className="board">
                {totalBoard().map((p, i) => (
                  <div
                    key={p.player}
                    className={`b-row ${i === 0 && p.holes > 0 ? "gold" : ""}`}
                  >
                    <span className="rank">
                      {i < 3 && p.holes > 0 ? MEDALS[i] : `${i + 1}.`}
                    </span>
                    <span className="name">{p.player}</span>
                    <span className="meta">{p.holes}L / {p.days}T</span>
                    <span className="diff">
                      {p.str > 0
                        ? (p.str - p.parT >= 0 ? "+" : "") + (p.str - p.parT)
                        : "–"}
                    </span>
                    <span className="pts">{p.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Tagessieger</div>
              <div className="win-grid">
                {DAYS.map((d) => {
                  const lb = dayBoard(d);
                  const w = lb[0] && lb[0].holes > 0 ? lb[0] : null;
                  return (
                    <div key={d} className="win-card">
                      <div className="day">Tag {d}</div>
                      {w ? (
                        <>
                          <div className="wname">{w.player}</div>
                          <div className="wpts">{w.pts} Punkte</div>
                          <div className="wstr">
                            {w.str} Schläge (
                            {w.str - w.parT >= 0 ? "+" : ""}
                            {w.str - w.parT})
                          </div>
                        </>
                      ) : (
                        <div className="wnone">offen</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ SCORECARD ═══════════════ */}
        {tab === "card" && (
          <div className="card">
            <div className="card-title">Scorecard</div>
            <select
              className="sel"
              value={scPlayer}
              onChange={(e) => setScPlayer(e.target.value)}
            >
              {PLAYERS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <div className="chip-row">
              <button
                className={`chip ${scDay === 0 ? "active" : ""}`}
                onClick={() => setScDay(0)}
              >
                Alle
              </button>
              {DAYS.map((d) => (
                <button
                  key={d}
                  className={`chip ${scDay === d ? "active" : ""}`}
                  onClick={() => setScDay(d)}
                >
                  T{d}
                </button>
              ))}
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Loch</th>
                    <th>Par</th>
                    {scDay === 0 ? (
                      DAYS.map((d) => <th key={d}>T{d}</th>)
                    ) : (
                      <>
                        <th>Schläge</th>
                        <th>Pkt</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 18 }, (_, i) => {
                    const h = i + 1;
                    const p = PAR_DATA[i];
                    return (
                      <tr
                        key={h}
                        className={h === 10 ? "break-row" : ""}
                      >
                        <td>{h}</td>
                        <td className="muted-cell">{p}</td>
                        {scDay === 0
                          ? DAYS.map((d) => {
                              const e = scores.find(
                                (s) =>
                                  s.player === scPlayer &&
                                  s.day === d &&
                                  s.hole === h
                              );
                              const cls = e
                                ? e.points === 2
                                  ? "birdie"
                                  : e.points === 1
                                    ? "par-cell"
                                    : "bogey-cell"
                                : "muted-cell";
                              return (
                                <td key={d} className={cls}>
                                  {e ? e.strokes : "–"}
                                </td>
                              );
                            })
                          : (() => {
                              const e = scores.find(
                                (s) =>
                                  s.player === scPlayer &&
                                  s.day === scDay &&
                                  s.hole === h
                              );
                              const cls = e
                                ? e.points === 2
                                  ? "birdie"
                                  : e.points === 1
                                    ? "par-cell"
                                    : "bogey-cell"
                                : "muted-cell";
                              return (
                                <>
                                  <td className={cls}>
                                    {e ? e.strokes : "–"}
                                  </td>
                                  <td className={cls}>
                                    {e ? e.points : "–"}
                                  </td>
                                </>
                              );
                            })()}
                      </tr>
                    );
                  })}
                  <tr className="total-row">
                    <td>Σ</td>
                    <td>{TOTAL_PAR}</td>
                    {scDay === 0
                      ? DAYS.map((d) => {
                          const ds = scores.filter(
                            (s) => s.player === scPlayer && s.day === d
                          );
                          const tStr = ds.reduce(
                            (a, s) => a + s.strokes,
                            0
                          );
                          const tPts = ds.reduce(
                            (a, s) => a + s.points,
                            0
                          );
                          return (
                            <td key={d}>
                              {ds.length ? `${tStr} (${tPts}P)` : "–"}
                            </td>
                          );
                        })
                      : (() => {
                          const ds = scores.filter(
                            (s) =>
                              s.player === scPlayer && s.day === scDay
                          );
                          return (
                            <>
                              <td>
                                {ds.reduce((a, s) => a + s.strokes, 0) ||
                                  "–"}
                              </td>
                              <td>
                                {ds.reduce((a, s) => a + s.points, 0)}
                              </td>
                            </>
                          );
                        })()}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>
          {scores.length} Scores ·{" "}
          <span style={{ color: online ? "var(--green)" : "var(--danger)" }}>
            {online ? "● Live" : "○ Offline"}
          </span>
        </span>
        <button className="reset-btn" onClick={resetAll}>
          Reset
        </button>
      </footer>
    </>
  );
}
