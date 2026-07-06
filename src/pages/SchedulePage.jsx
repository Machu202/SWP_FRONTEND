import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Alert, EmptyState, LoadingBlock } from "../components/Status";

export default function SchedulePage() {
  const [series, setSeries] = useState([]);
  const [seriesId, setSeriesId] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ publishDate: "", frequency: "Weekly" });
  const [deadlineForm, setDeadlineForm] = useState({ eventName: "", deadlineDateStr: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSeries() {
    setLoading(true);
    setError("");
    try {
      const data = await api.series.mine().catch(() => api.series.list({ size: 50 }));
      setSeries(data || []);
      if (!seriesId && data?.length) setSeriesId(String(data[0].id));
    } catch (err) {
      setError(err.message || "Could not load series list");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedule(id = seriesId) {
    if (!id) return;
    setError("");
    try {
      const [scheduleData, deadlineData] = await Promise.all([
        api.schedules.bySeries(id).catch(() => []),
        api.deadlines.bySeries(id).catch(() => [])
      ]);
      setSchedules(scheduleData || []);
      setDeadlines(deadlineData || []);
    } catch (err) {
      setError(err.message || "Could not load schedule data");
    }
  }

  useEffect(() => { loadSeries(); }, []);
  useEffect(() => { loadSchedule(seriesId); }, [seriesId]);

  async function createSchedule(event) {
    event.preventDefault();
    if (!seriesId) return;
    setError("");
    setMessage("");
    try {
      await api.schedules.create({
        seriesId: Number(seriesId),
        publishDate: scheduleForm.publishDate,
        frequency: scheduleForm.frequency
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
    if (!seriesId) return;
    setError("");
    setMessage("");
    try {
      await api.deadlines.create(seriesId, deadlineForm.eventName, deadlineForm.deadlineDateStr);
      setMessage("Deadline created.");
      setDeadlineForm({ eventName: "", deadlineDateStr: "" });
      await loadSchedule(seriesId);
    } catch (err) {
      setError(err.message || "Could not create deadline");
    }
  }

  if (loading) return <LoadingBlock label="Loading schedule..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card toolbar">
        <div>
          <p className="eyebrow">Schedule and deadlines</p>
          <h3>Series calendar</h3>
        </div>
        <select value={seriesId} onChange={(event) => setSeriesId(event.target.value)}>
          <option value="">Choose series</option>
          {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>

      <div className="grid two">
        <form className="card form stack" onSubmit={createSchedule}>
          <h3>Create publishing schedule</h3>
          <label>
            Publish date/time
            <input type="datetime-local" value={scheduleForm.publishDate} onChange={(event) => setScheduleForm({ ...scheduleForm, publishDate: event.target.value })} />
          </label>
          <label>
            Frequency
            <input value={scheduleForm.frequency} onChange={(event) => setScheduleForm({ ...scheduleForm, frequency: event.target.value })} />
          </label>
          <button className="btn btn-primary" disabled={!seriesId || !scheduleForm.publishDate || !scheduleForm.frequency}>Create schedule</button>
        </form>

        <form className="card form stack" onSubmit={createDeadline}>
          <h3>Create deadline</h3>
          <label>
            Event name
            <input value={deadlineForm.eventName} onChange={(event) => setDeadlineForm({ ...deadlineForm, eventName: event.target.value })} />
          </label>
          <label>
            Deadline date/time string
            <input type="datetime-local" value={deadlineForm.deadlineDateStr} onChange={(event) => setDeadlineForm({ ...deadlineForm, deadlineDateStr: event.target.value })} />
          </label>
          <button className="btn btn-primary" disabled={!seriesId || !deadlineForm.eventName || !deadlineForm.deadlineDateStr}>Create deadline</button>
        </form>
      </div>

      <div className="grid two">
        <DataList title="Publishing schedules" items={schedules} empty="No publishing schedules." />
        <DataList title="Deadlines" items={deadlines} empty="No deadlines." />
      </div>
    </section>
  );
}

function DataList({ title, items, empty }) {
  return (
    <div className="card">
      <div className="card-header"><h3>{title}</h3><span>{items.length}</span></div>
      {items.length ? (
        <div className="list">
          {items.map((item, index) => (
            <div className="list-row" key={item.id || item.eventId || index}>
              <div>
                <strong>{item.eventName || item.frequency || item.title || `Item ${index + 1}`}</strong>
                <small>{item.publishDate || item.deadlineDate || item.deadlineDateStr || item.createdAt || "No date"}</small>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title={empty} body="Create one with the form above." />}
    </div>
  );
}
