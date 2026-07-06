import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const ROLES = ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board", "Admin"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setUsers(await api.users.all());
    } catch (err) {
      setError(err.message || "Could not load users. Admin role is required.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateUser(id, action) {
    setError("");
    setMessage("");
    try {
      const updated = await action();
      setUsers((old) => old.map((user) => String(user.id) === String(id) ? updated : user));
      setMessage("User updated.");
    } catch (err) {
      setError(err.message || "User update failed");
    }
  }

  if (loading) return <LoadingBlock label="Loading users..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>
      <div className="card">
        <div className="card-header">
          <h3>All users</h3>
          <button className="btn btn-small" onClick={load}>Refresh</button>
        </div>
        {users.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td><strong>{user.fullName || user.username}</strong><br /><small>{user.username}</small></td>
                    <td>{user.email || "-"}</td>
                    <td>
                      <select value={user.roleName || ""} onChange={(event) => updateUser(user.id, () => api.users.assignRole(user.id, event.target.value))}>
                        <option value="">Choose role</option>
                        {ROLES.map((role) => <option key={role}>{role}</option>)}
                      </select>
                    </td>
                    <td><StatusBadge value={user.isActive === false ? "Inactive" : "Active"} /></td>
                    <td>
                      <button className="btn btn-small" onClick={() => updateUser(user.id, () => api.users.lock(user.id, !(user.isActive === false)))}>
                        {user.isActive === false ? "Unlock" : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No users returned" body="Check admin permission and backend data." />}
      </div>
    </section>
  );
}
