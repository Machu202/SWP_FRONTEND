import { useEffect, useMemo, useState } from "react";
import { api, getWorkspaceSelection, hasRole, setWorkspaceSelection, unwrapList } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, EmptyState, LoadingBlock } from "../components/Status";

function itemDate(item) {
  return item?.publishDate || item?.publish_date || item?.deadlineDate || item?.deadline_date || item?.deadlineDateStr || item?.date || "";
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = validDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function warningLevel(value) {
  const due = validDate(value);
  if (!due) return "muted";
  const hours = (due.getTime() - Date.now()) / 36e5;
  if (hours < 0) return "overdue";
  if (hours <= 48) return "danger";
  if (hours <= 168) return "warning";
  return "success";
}

function warningLabel(value) {
  const level = warningLevel(value);
  return { overdue: "Overdue", danger: "Due within 48h", warning: "Due this week", success: "On track", muted: "No valid date" }[level];
}

export default function SchedulePage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canManage = hasRole(role, ["mangaka"]);
  const [series, setSeries] = useState([]);
  const [seriesId, setSeriesId] = useState(() => String(getWorkspaceSelection().seriesId || ""));
  const [schedules, setSchedules] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [scheduleForm, setScheduleForm] = useState({ publishDate: "", frequency: "Weekly" });
  const [deadlineForm, setDeadlineForm] = useState({ eventName: "", deadlineDateStr: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSeries() {
    setLoading(true);
    setError("");
    try {
      const data = canManage ? await api.series.mine() : await api.series.list({ size: 100 });
      const list = unwrapList(data);
      setSeries(list);
      setSeriesId((current) => {
        const preferred = String(current || getWorkspaceSelection().seriesId || "");
        const preferredExists = list.some((item) => String(item.id) === preferred);
        return String(preferredExists ? preferred : list[0]?.id || "");
      });
    } catch (err) {
      setError(err.message || "Could not load series list");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedule(id = seriesId) {
    if (!id) {
      setSchedules([]);
      setDeadlines([]);
      return;
    }
    setError("");
    try {
      const [scheduleData, deadlineData] = await Promise.all([
        api.schedules.bySeries(id).catch(() => []),
        api.deadlines.bySeries(id).catch(() => [])
      ]);
      setSchedules(unwrapList(scheduleData));
      setDeadlines(unwrapList(deadlineData));
    } catch (err) {
      setError(err.message || "Could not load schedule data");
    }
  }

  useEffect(() => { loadSeries(); }, [canManage]);
  useEffect(() => {
    setWorkspaceSelection({ seriesId });
    loadSchedule(seriesId);
  }, [seriesId]);

  async function createSchedule(event) {
    event.preventDefault();
    if (!seriesId || !canManage) return;
    setError("");
    setMessage("");
    try {
      await api.schedules.create({
        seriesId: Number(seriesId),
        publishDate: scheduleForm.publishDate,
        frequency: scheduleForm.frequency.trim()
      });
      setMessage("Publishing schedule created.");
      setScheduleForm({ publishDate: "", frequency: "Weekly" });
      await loadSchedule(seriesId);
    } catch (err) {
      setError(err.message || "Could not create schedule");
    }
  }

  async function createDeadline(event) {
    event.preventDefault();
    if (!seriesId || !canManage) return;
    setError("");
    setMessage("");
    try {
      await api.deadlines.create(seriesId, deadlineForm.eventName.trim(), deadlineForm.deadlineDateStr);
      setMessage("Deadline created.");
      setDeadlineForm({ eventName: "", deadlineDateStr: "" });
      await loadSchedule(seriesId);
    } catch (err) {
      setError(err.message || "Could not create deadline");
    }
  }

  async function removeSchedule(item) {
    if (!canManage || !item?.id || !window.confirm("Delete this publishing schedule?")) return;
    try {
      await api.schedules.remove(item.id);
      setSchedules((old) => old.filter((entry) => String(entry.id) !== String(item.id)));
      setMessage("Publishing schedule deleted.");
    } catch (err) {
      setError(err.message || "Could not delete schedule");
    }
  }

  async function removeDeadline(item) {
    const id = item?.id || item?.eventId;
    if (!canManage || !id || !window.confirm("Delete this deadline?")) return;
    try {
      await api.deadlines.remove(id);
      setDeadlines((old) => old.filter((entry) => String(entry.id || entry.eventId) !== String(id)));
      setMessage("Deadline deleted.");
    } catch (err) {
      setError(err.message || "Could not delete deadline");
    }
  }

  const calendarItems = useMemo(() => [
    ...schedules.map((item) => ({ ...item, kind: "Publish", title: item.frequency || item.title || "Publishing schedule", date: itemDate(item) })),
    ...deadlines.map((item) => ({ ...item, kind: "Deadline", title: item.eventName || item.event_name || "Deadline", date: itemDate(item) }))
  ].filter((item) => item.date), [schedules, deadlines]);

  if (loading) return <LoadingBlock label="Loading schedule..." />;

  return (
    <section className="stack schedule-page">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card toolbar">
        <div><p className="eyebrow">Schedule and deadlines</p><h3>Series calendar</h3></div>
        <select value={seriesId} onChange={(event) => setSeriesId(event.target.value)}>
          <option value="">Choose series</option>
          {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>

      {canManage ? (
        <div className="grid two">
          <form className="card form stack" onSubmit={createSchedule}>
            <h3>Create publishing schedule</h3>
            <label>Publish date/time<input type="datetime-local" value={scheduleForm.publishDate} onChange={(event) => setScheduleForm({ ...scheduleForm, publishDate: event.target.value })} /></label>
            <label>Frequency<select value={scheduleForm.frequency} onChange={(event) => setScheduleForm({ ...scheduleForm, frequency: event.target.value })}><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>One-time</option></select></label>
            <button className="btn btn-primary" disabled={!seriesId || !scheduleForm.publishDate || !scheduleForm.frequency}>Create schedule</button>
          </form>

          <form className="card form stack" onSubmit={createDeadline}>
            <h3>Create deadline</h3>
            <label>Event name<input value={deadlineForm.eventName} onChange={(event) => setDeadlineForm({ ...deadlineForm, eventName: event.target.value })} /></label>
            <label>Deadline date/time<input type="datetime-local" value={deadlineForm.deadlineDateStr} onChange={(event) => setDeadlineForm({ ...deadlineForm, deadlineDateStr: event.target.value })} /></label>
            <button className="btn btn-primary" disabled={!seriesId || !deadlineForm.eventName.trim() || !deadlineForm.deadlineDateStr}>Create deadline</button>
          </form>
        </div>
      ) : (
        <div className="card read-only-note">This role has read-only schedule access. Publishing schedules are managed by the Mangaka who owns the series.</div>
      )}

      <MonthCalendar items={calendarItems} cursor={monthCursor} onChange={setMonthCursor} />
      <DeadlineMonitoringTable deadlines={deadlines} canManage={canManage} onDelete={removeDeadline} />

      <div className="grid two">
        <DataList title="Publishing schedules" items={schedules} empty="No publishing schedules." canManage={canManage} onDelete={removeSchedule} />
        <DataList title="Deadline events" items={deadlines} empty="No deadlines." canManage={canManage} onDelete={removeDeadline} />
      </div>
    </section>
  );
}

function MonthCalendar({ items, cursor, onChange }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const byDay = items.reduce((map, item) => {
    const key = dateKey(item.date);
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
  const title = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="card month-calendar-card">
      <div className="card-header calendar-header">
        <button className="btn btn-small" onClick={() => onChange(new Date(year, month - 1, 1))}>←</button>
        <h3>{title}</h3>
        <div className="button-row"><button className="btn btn-small" onClick={() => onChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button><button className="btn btn-small" onClick={() => onChange(new Date(year, month + 1, 1))}>→</button></div>
      </div>
      <div className="month-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="month-grid">
        {cells.map((day, index) => {
          const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : `empty-${index}`;
          const dayItems = day ? (byDay[key] || []) : [];
          const isToday = day && dateKey(new Date()) === key;
          return (
            <div className={`month-cell ${!day ? "empty" : ""} ${isToday ? "today" : ""}`} key={key}>
              {day && <strong>{day}</strong>}
              {dayItems.slice(0, 3).map((item, itemIndex) => <button type="button" title={`${item.kind}: ${item.title}`} className={`calendar-chip warning-${warningLevel(item.date)}`} key={`${item.kind}-${item.id || itemIndex}`}>{item.kind === "Deadline" ? "D" : "P"} · {item.title}</button>)}
              {dayItems.length > 3 && <small>+{dayItems.length - 3} more</small>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeadlineMonitoringTable({ deadlines, canManage, onDelete }) {
  const sorted = [...deadlines].sort((a, b) => String(itemDate(a)).localeCompare(String(itemDate(b))));
  return (
    <div className="card deadline-monitor-card">
      <div className="card-header"><div><h3>Upcoming deadline monitoring</h3><small>Warnings are calculated from the current browser time.</small></div><span>{sorted.length}</span></div>
      {sorted.length ? (
        <div className="table-wrap"><table><thead><tr><th>Deadline</th><th>Date</th><th>Warning</th>{canManage && <th>Action</th>}</tr></thead><tbody>
          {sorted.map((item, index) => {
            const date = itemDate(item);
            const level = warningLevel(date);
            return <tr className={`deadline-row warning-${level}`} key={item.id || item.eventId || index}><td><strong>{item.eventName || item.event_name || `Deadline ${index + 1}`}</strong></td><td>{validDate(date)?.toLocaleString() || date || "-"}</td><td><span className={`deadline-warning warning-${level}`}>{warningLabel(date)}</span></td>{canManage && <td><button className="btn btn-small btn-danger" onClick={() => onDelete(item)}>Delete</button></td>}</tr>;
          })}
        </tbody></table></div>
      ) : <EmptyState title="No monitored deadlines" body="Create a deadline to see color-coded warnings." />}
    </div>
  );
}

function DataList({ title, items, empty, canManage, onDelete }) {
  return (
    <div className="card">
      <div className="card-header"><h3>{title}</h3><span>{items.length}</span></div>
      {items.length ? <div className="list">{items.map((item, index) => (
        <div className="list-row" key={item.id || item.eventId || index}><div><strong>{item.eventName || item.frequency || item.title || `Item ${index + 1}`}</strong><small>{itemDate(item) || item.createdAt || "No date"}</small></div>{canManage && <button className="btn btn-small btn-danger" onClick={() => onDelete(item)}>Delete</button>}</div>
      ))}</div> : <EmptyState title={empty} body="No schedule entries are available." />}
    </div>
  );
}
