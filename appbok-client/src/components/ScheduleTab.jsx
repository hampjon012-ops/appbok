import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApiHeaders as authHeaders } from '../lib/adminApiHeaders.js';
import './ScheduleTab.css';

const WD_LABELS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

function defaultWeek() {
  return [
    { weekday: 0, enabled: true, from: '09:00', to: '18:00' },
    { weekday: 1, enabled: true, from: '09:00', to: '18:00' },
    { weekday: 2, enabled: true, from: '09:00', to: '18:00' },
    { weekday: 3, enabled: true, from: '09:00', to: '18:00' },
    { weekday: 4, enabled: true, from: '09:00', to: '17:00' },
    { weekday: 5, enabled: true, from: '10:00', to: '15:00' },
    { weekday: 6, enabled: false, from: '09:00', to: '18:00' },
  ];
}

function defaultLunch() {
  return {
    enabled: true,
    days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      enabled: weekday < 5,
      from: '12:00',
      to: '13:00',
    })),
  };
}

function normalizeSchedule(ws) {
  if (!ws || typeof ws !== 'object') {
    return { mode: 'salon', days: defaultWeek(), lunch: defaultLunch() };
  }
  const mode = ws.mode === 'custom' ? 'custom' : 'salon';
  const days =
    mode === 'custom' && Array.isArray(ws.days) && ws.days.length === 7
      ? ws.days.map((d, i) => ({
          weekday: typeof d.weekday === 'number' ? d.weekday : i,
          enabled: Boolean(d.enabled),
          from: d.from || '09:00',
          to: d.to || '18:00',
        }))
      : defaultWeek();
  const lunch =
    ws.lunch && typeof ws.lunch === 'object'
      ? {
          enabled: ws.lunch.enabled !== false,
          days:
            Array.isArray(ws.lunch.days) && ws.lunch.days.length === 7
              ? ws.lunch.days.map((d, i) => ({
                  weekday: typeof d.weekday === 'number' ? d.weekday : i,
                  enabled: Boolean(d.enabled),
                  from: d.from || '12:00',
                  to: d.to || '13:00',
                }))
              : defaultLunch().days,
        }
      : defaultLunch();
  return { mode, days, lunch };
}

function blockTypeLabel(t) {
  if (t === 'sick') return 'Sjuk';
  if (t === 'vacation') return 'Semester';
  return 'Annat';
}

function fmtRange(d) {
  const a = d.start_date === d.end_date ? d.start_date : `${d.start_date} – ${d.end_date}`;
  if (d.time_mode === 'range' && d.time_from && d.time_to) {
    return `${a} (${String(d.time_from).slice(0, 5)}–${String(d.time_to).slice(0, 5)})`;
  }
  return `${a} (hela dagen)`;
}

/** Lokalt YYYY-MM-DD (undvik UTC-fel vid toISOString). */
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  let day = 1 - startPad;
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let c = 0; c < 7; c++) {
      if (day < 1 || day > daysInMonth) {
        row.push(null);
      } else {
        row.push(new Date(year, month, day));
      }
      day++;
    }
    cells.push(row);
    if (day > daysInMonth + 7) break;
  }
  return cells;
}

export default function ScheduleTab({ user }) {
  /** Personal-vy: riktig staff eller superadmin som tittar som stylist (samma UI, rätt id). */
  const isStaffView = user?.role === 'staff';

  const [staffList, setStaffList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState('salon');
  const [days, setDays] = useState(() => defaultWeek());
  const [lunch, setLunch] = useState(() => defaultLunch());
  const [blockedDays, setBlockedDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [modal, setModal] = useState(null);
  const [listError, setListError] = useState('');
  const [smsSummary, setSmsSummary] = useState('');
  /** Flerval av kalenderdagar (ISO-datum) innan gemensam blockering */
  const [pickedBlockDates, setPickedBlockDates] = useState([]);

  const loadStaff = useCallback(() => {
    setListError('');
    fetch('/api/staff/list', { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const err =
            typeof data.error === 'string'
              ? data.error
              : r.status === 403
                ? 'Du saknar behörighet (endast administratör). Om du är superadmin: välj salong så att rätt salong-ID skickas.'
                : `Kunde inte hämta personal (HTTP ${r.status}).`;
          setListError(err);
          setStaffList([]);
          return;
        }
        const list = Array.isArray(data) ? data : [];
        setStaffList(list);
        setSelectedId((cur) => {
          if (cur && list.some((s) => s.id === cur)) return cur;
          return list[0]?.id || '';
        });
      })
      .catch(() => {
        setListError('Nätverksfel vid hämtning av personal.');
        setStaffList([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user?.role === 'staff') {
      setListError('');
      const sid = user?.impersonatedStaffId || user?.id;
      if (!sid) {
        setListError('Saknar stylist-ID.');
        setStaffList([]);
        setSelectedId('');
        setLoading(false);
        return;
      }
      setStaffList([
        {
          id: sid,
          name: user?.impersonatedName || user?.name || 'Du',
        },
      ]);
      setSelectedId(sid);
      setLoading(false);
      return;
    }
    loadStaff();
  }, [user?.role, user?.id, user?.impersonatedStaffId, user?.impersonatedName, user?.name, loadStaff]);

  const loadSchedule = useCallback((staffId) => {
    if (!staffId || staffId === 'all') {
      setLoading(false);
      setBlockedDays([]);
      return;
    }
    setLoading(true);
    fetch(`/api/staff/${staffId}/schedule`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const n = normalizeSchedule(data.work_schedule);
        setMode(n.mode);
        setDays(n.days);
        setLunch(n.lunch);
        setBlockedDays(Array.isArray(data.blocked_days) ? data.blocked_days : []);
        setMsg('');
      })
      .catch(() => setMsg('Kunde inte hämta schema.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId && selectedId !== 'all') loadSchedule(selectedId);
    setPickedBlockDates([]);
    setSmsSummary('');
  }, [selectedId, loadSchedule]);

  const loadAllBlocks = useCallback(() => {
    if (selectedId !== 'all') return;
    setLoading(true);
    Promise.all(
      staffList.map((s) =>
        fetch(`/api/staff/${s.id}/schedule`, { headers: authHeaders() }).then((r) => r.json()),
      ),
    )
      .then((rows) => {
        const merged = [];
        rows.forEach((row, i) => {
          const sid = staffList[i]?.id;
          (row.blocked_days || []).forEach((b) => merged.push({ ...b, _staffName: staffList[i]?.name, _staffId: sid }));
        });
        merged.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
        setBlockedDays(merged);
      })
      .catch(() => setMsg('Kunde inte hämta blockeringar.'))
      .finally(() => setLoading(false));
  }, [selectedId, staffList]);

  useEffect(() => {
    if (selectedId === 'all' && staffList.length) loadAllBlocks();
  }, [selectedId, staffList, loadAllBlocks]);

  const saveSchedule = async (e) => {
    e.preventDefault();
    if (!selectedId || selectedId === 'all') return;
    setSaving(true);
    setMsg('');
    try {
      const body =
        mode === 'custom'
          ? { mode: 'custom', days, lunch }
          : { mode: 'salon', days: [], lunch };
      const res = await fetch(`/api/staff/${selectedId}/schedule`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg(err.message || 'Fel');
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (id) => {
    if (!selectedId || selectedId === 'all') return;
    try {
      const res = await fetch(`/api/staff/${selectedId}/blocked-days`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'remove', id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Fel');
      }
      loadSchedule(selectedId);
    } catch (err) {
      setMsg(err.message || 'Fel');
    }
  };

  const addBlock = async () => {
    if (!modal || !selectedId || selectedId === 'all') return;
    const dayList = Array.isArray(modal.days) && modal.days.length ? modal.days : [];
    if (!dayList.length) return;
    const { blockType, timeMode, timeFrom, timeTo, notifySms } = modal;
    setSmsSummary('');
    try {
      for (const day of dayList) {
        const ds = toLocalISODate(day);
        const res = await fetch(`/api/staff/${selectedId}/blocked-days`, {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'add',
            start_date: ds,
            end_date: ds,
            block_type: blockType,
            time_mode: timeMode,
            time_from: timeMode === 'range' ? timeFrom : null,
            time_to: timeMode === 'range' ? timeTo : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fel');
      }
      setModal(null);
      setPickedBlockDates([]);
      loadSchedule(selectedId);

      if (notifySms) {
        try {
          let totalSent = 0;
          let anyResponse = false;
          for (const day of dayList) {
            const ds = toLocalISODate(day);
            const smsRes = await fetch(`/api/staff/${selectedId}/notify-blocked-day`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: ds, block_type: blockType }),
            });
            const smsData = await smsRes.json().catch(() => ({}));
            if (smsRes.ok && typeof smsData.sent === 'number') {
              anyResponse = true;
              totalSent += smsData.sent;
            }
          }
          if (anyResponse) {
            if (totalSent === 0) {
              setSmsSummary('Inga kunder behöver informeras.');
            } else {
              setSmsSummary(`SMS skickat till ${totalSent} kund${totalSent !== 1 ? 'er' : ''} totalt.`);
            }
          }
        } catch {
          /* SMS sekundärt */
        }
      }
    } catch (err) {
      setMsg(err.message || 'Fel');
    }
  };

  const matrix = useMemo(() => monthMatrix(calMonth.y, calMonth.m), [calMonth]);

  const dayMeta = useCallback(
    (d) => {
      if (!d) return { muted: true };
      const iso = toLocalISODate(d);
      const wd = (d.getDay() + 6) % 7;
      const weekend = wd >= 5;
      let blocked = false;
      let workHint = false;
      if (selectedId && selectedId !== 'all') {
        const hit = blockedDays.some((b) => iso >= b.start_date && iso <= b.end_date);
        blocked = hit;
        const row = days.find((x) => x.weekday === wd);
        workHint = Boolean(row?.enabled);
      } else {
        blocked = blockedDays.some((b) => iso >= b.start_date && iso <= b.end_date);
      }
      return { iso, muted: false, weekend, blocked, workHint };
    },
    [blockedDays, days, selectedId],
  );

  const dayCellClass = (meta, picked) => {
    const c = ['schedule-cal-cell'];
    if (meta.muted) return [...c, 'schedule-cal-cell--muted'].join(' ');
    if (picked) c.push('schedule-cal-cell--picked');
    if (meta.weekend) c.push('schedule-cal-cell--weekend');
    if (meta.blocked) c.push('schedule-cal-cell--blocked');
    else if (meta.workHint) c.push('schedule-cal-cell--work');
    return c.join(' ');
  };

  const togglePickBlockDate = (cell, meta) => {
    if (!cell || meta.muted || meta.blocked) return;
    const iso = toLocalISODate(cell);
    setPickedBlockDates((prev) => {
      if (prev.includes(iso)) return prev.filter((x) => x !== iso);
      return [...prev, iso].sort();
    });
  };

  const openBlockModalFromPick = () => {
    if (pickedBlockDates.length === 0 || !selectedId || selectedId === 'all') return;
    const dates = pickedBlockDates.map((iso) => {
      const [y, mo, da] = iso.split('-').map(Number);
      return new Date(y, mo - 1, da);
    });
    setSmsSummary('');
    setModal({
      days: dates,
      blockType: 'other',
      timeMode: 'full_day',
      timeFrom: '09:00',
      timeTo: '17:00',
      notifySms: true,
    });
  };

  return (
    <div className="admin-section schedule-tab">
      <h2 className="admin-section-title">{isStaffView ? 'Ditt schema' : 'Schema'}</h2>
      <p className="admin-hint" style={{ marginBottom: '1rem' }}>
        {isStaffView ? (
          <>
            Ställ in dina arbetstider, återkommande lunch och engångsblockeringar (sjukskrivning, semester, m.m.).
            När du väljer &quot;Följ salongens öppettider&quot; används samma standardvecka som i kundbokningen (mån–fre 09–18, lör 10–15, sön stängt) tills du sätter en egen tidsplan.
          </>
        ) : (
          <>
            Ställ in arbetstider per stylist, återkommande lunch och engångsblockeringar (sjukskrivning, semester, m.m.).
            När du väljer &quot;Följ salongens öppettider&quot; används samma standardvecka som i kundbokningen (mån–fre 09–18, lör 10–15, sön stängt) tills du sätter en egen tidsplan.
          </>
        )}
      </p>

      {listError ? (
        <p className="superadmin-error" style={{ marginBottom: '1rem' }}>
          {listError}
        </p>
      ) : null}

      {!isStaffView ? (
        <div className="schedule-tab-toolbar">
          <label>
            Välj stylist
            <select
              className="schedule-tab-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="all">Alla (översikt blockeringar)</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {loading && !staffList.length ? (
        <p className="admin-hint">Laddar personal…</p>
      ) : null}

      {selectedId === 'all' ? (
        <div className="admin-card">
          <h3 className="admin-card-title">Blockeringar (alla stylister)</h3>
          <p className="admin-hint">Välj en enskild stylist ovan för att redigera arbetstider och lägga till blockeringar.</p>
          {blockedDays.length === 0 ? (
            <p className="admin-hint">Inga blockeringar registrerade.</p>
          ) : (
            <ul className="schedule-block-list">
              {blockedDays.map((b) => (
                <li key={b.id}>
                  <span>
                    {fmtRange(b)} — {blockTypeLabel(b.block_type)}
                    {b._staffName ? ` · ${b._staffName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {selectedId && selectedId !== 'all' && !loading ? (
        <form onSubmit={saveSchedule}>
          <div className="schedule-mode-toggle">
            <button
              type="button"
              className={mode === 'salon' ? 'active' : ''}
              onClick={() => setMode('salon')}
            >
              Följ salongens öppettider
            </button>
            <button
              type="button"
              className={mode === 'custom' ? 'active' : ''}
              onClick={() => setMode('custom')}
            >
              Egen tidsplan
            </button>
          </div>

          {mode === 'custom' ? (
            <table className="schedule-week-table">
              <thead>
                <tr>
                  <th>Dag</th>
                  <th>Arbetar</th>
                  <th>Från</th>
                  <th>Till</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, idx) => (
                  <tr key={d.weekday}>
                    <td>{WD_LABELS[idx]}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => {
                          const v = [...days];
                          v[idx] = { ...v[idx], enabled: e.target.checked };
                          setDays(v);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={d.from}
                        disabled={!d.enabled}
                        onChange={(e) => {
                          const v = [...days];
                          v[idx] = { ...v[idx], from: e.target.value };
                          setDays(v);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={d.to}
                        disabled={!d.enabled}
                        onChange={(e) => {
                          const v = [...days];
                          v[idx] = { ...v[idx], to: e.target.value };
                          setDays(v);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-hint">
              Samma standard som kundbokningen: mån–fre 09–18, lördag 10–15, söndag stängd. Byt till &quot;Egen tidsplan&quot; för att ändra per dag.
            </p>
          )}

          <div className="admin-card" style={{ marginTop: '1rem' }}>
            <h3 className="admin-card-title">Lunch (upprepande)</h3>
            <p className="admin-hint">Tider som inte går att boka varje vecka.</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="checkbox"
                checked={lunch.enabled}
                onChange={(e) => setLunch({ ...lunch, enabled: e.target.checked })}
              />
              Aktivera lunchblock
            </label>
            <table className="schedule-week-table">
              <thead>
                <tr>
                  <th>Dag</th>
                  <th>Lunch</th>
                  <th>Från</th>
                  <th>Till</th>
                </tr>
              </thead>
              <tbody>
                {lunch.days.map((d, idx) => (
                  <tr key={d.weekday}>
                    <td>{WD_LABELS[idx]}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        disabled={!lunch.enabled}
                        onChange={(e) => {
                          const v = { ...lunch, days: [...lunch.days] };
                          v.days[idx] = { ...v.days[idx], enabled: e.target.checked };
                          setLunch(v);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={d.from}
                        disabled={!lunch.enabled || !d.enabled}
                        onChange={(e) => {
                          const v = { ...lunch, days: [...lunch.days] };
                          v.days[idx] = { ...v.days[idx], from: e.target.value };
                          setLunch(v);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={d.to}
                        disabled={!lunch.enabled || !d.enabled}
                        onChange={(e) => {
                          const v = { ...lunch, days: [...lunch.days] };
                          v.days[idx] = { ...v.days[idx], to: e.target.value };
                          setLunch(v);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="superadmin-modal-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn-admin-primary" disabled={saving}>
              {saving ? 'Sparar…' : 'Spara arbetstider & lunch'}
            </button>
          </div>
          {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
        </form>
      ) : null}

      {selectedId && selectedId !== 'all' ? (
        <div className="admin-card schedule-cal-wrap">
          <h3 className="admin-card-title">Blockera dagar (sjukskrivning, semester, …)</h3>
          <p className="admin-hint" style={{ marginBottom: '0.75rem' }}>
            Klicka på lediga dagar i kalendern för att markera flera. Välj sedan typ (sjuk, semester …) och spara alla på en gång — du slipper öppna varje dag för sig.
          </p>
          <div className="schedule-cal-pick-actions">
            <button
              type="button"
              className="btn-admin-primary"
              disabled={pickedBlockDates.length === 0}
              onClick={openBlockModalFromPick}
            >
              Välj typ och spara
              {pickedBlockDates.length > 0 ? ` (${pickedBlockDates.length})` : ''}
            </button>
            {pickedBlockDates.length > 0 ? (
              <button type="button" className="btn-sm btn-ghost" onClick={() => setPickedBlockDates([])}>
                Rensa val
              </button>
            ) : null}
          </div>
          <div className="schedule-cal-nav">
            <button
              type="button"
              onClick={() =>
                setCalMonth((c) => {
                  const nm = c.m - 1;
                  if (nm < 0) return { y: c.y - 1, m: 11 };
                  return { y: c.y, m: nm };
                })
              }
            >
              ←
            </button>
            <strong>
              {new Date(calMonth.y, calMonth.m, 1).toLocaleDateString('sv-SE', {
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            <button
              type="button"
              onClick={() =>
                setCalMonth((c) => {
                  const nm = c.m + 1;
                  if (nm > 11) return { y: c.y + 1, m: 0 };
                  return { y: c.y, m: nm };
                })
              }
            >
              →
            </button>
          </div>
          <div className="schedule-cal-grid" style={{ marginBottom: '0.25rem' }}>
            {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((w) => (
              <div key={w} className="schedule-cal-dow">
                {w}
              </div>
            ))}
          </div>
          {matrix.map((row, ri) => (
            <div className="schedule-cal-grid" key={ri}>
              {row.map((cell, ci) => {
                const meta = dayMeta(cell);
                const iso = cell ? toLocalISODate(cell) : '';
                const picked = Boolean(iso && pickedBlockDates.includes(iso));
                return (
                  <button
                    key={ci}
                    type="button"
                    className={dayCellClass(meta, picked)}
                    disabled={meta.muted}
                    onClick={() => {
                      if (!cell) return;
                      togglePickBlockDate(cell, meta);
                    }}
                  >
                    {cell ? <span>{cell.getDate()}</span> : ''}
                  </button>
                );
              })}
            </div>
          ))}

          <h4 className="admin-card-title" style={{ marginTop: '1rem', fontSize: '1rem' }}>
            Blockerade dagar
          </h4>
          {blockedDays.length === 0 ? (
            <p className="admin-hint">Inga blockeringar ännu.</p>
          ) : (
            <ul className="schedule-block-list">
              {blockedDays.map((b) => (
                <li key={b.id}>
                  <span>
                    {fmtRange(b)} — {blockTypeLabel(b.block_type)}
                  </span>
                  <button type="button" className="btn-sm btn-ghost" onClick={() => removeBlock(b.id)}>
                    Ta bort
                  </button>
                </li>
              ))}
            </ul>
          )}
          {smsSummary && !modal ? (
            <p className="superadmin-success" style={{ marginTop: '0.75rem' }}>
              {smsSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      {modal ? (
        <div
          className="schedule-modal-backdrop"
          onClick={() => {
            setModal(null);
            setSmsSummary('');
          }}
        >
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <h4>
              {modal.days?.length > 1
                ? `Blockera ${modal.days.length} dagar`
                : modal.days?.[0]
                  ? `Blockera ${modal.days[0].toLocaleDateString('sv-SE', { dateStyle: 'long' })}`
                  : 'Blockera dagar'}
            </h4>
            {modal.days?.length > 1 ? (
              <p className="admin-hint" style={{ marginBottom: '0.75rem' }}>
                {modal.days
                  .map((d) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }))
                  .join(', ')}
              </p>
            ) : null}
            <label>
              Typ
              <select
                className="admin-input"
                value={modal.blockType}
                onChange={(e) => setModal({ ...modal, blockType: e.target.value })}
              >
                <option value="sick">Sjuk</option>
                <option value="vacation">Semester</option>
                <option value="other">Annat</option>
              </select>
            </label>
            <label>
              Tid
              <select
                className="admin-input"
                value={modal.timeMode}
                onChange={(e) => setModal({ ...modal, timeMode: e.target.value })}
              >
                <option value="full_day">Hela dagen</option>
                <option value="range">Eget intervall</option>
              </select>
            </label>
            {modal.timeMode === 'range' ? (
              <>
                <label>
                  Från
                  <input
                    type="time"
                    className="admin-input"
                    value={modal.timeFrom}
                    onChange={(e) => setModal({ ...modal, timeFrom: e.target.value })}
                  />
                </label>
                <label>
                  Till
                  <input
                    type="time"
                    className="admin-input"
                    value={modal.timeTo}
                    onChange={(e) => setModal({ ...modal, timeTo: e.target.value })}
                  />
                </label>
              </>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                checked={modal.notifySms !== false}
                onChange={(e) => setModal({ ...modal, notifySms: e.target.checked })}
              />
              Skicka SMS till berörda kunder
            </label>
            <div className="schedule-modal-actions">
              <button type="button" className="btn-sm btn-ghost" onClick={() => { setModal(null); setSmsSummary(''); }}>
                Avbryt
              </button>
              <button type="button" className="btn-admin-primary" onClick={addBlock}>
                Spara blockering{modal.days?.length > 1 ? ` (${modal.days.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
