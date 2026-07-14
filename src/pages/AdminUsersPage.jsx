import { useEffect, useMemo, useState } from "react";
import { api, unwrapList } from "../api/client";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const ROLES = ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board", "Admin"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setUsers(unwrapList(await api.users.all()));
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
      setUsers((old) => old.map((user) => String(user.id) === String(id) ? { ...user, ...(updated || {}) } : user));
      setMessage("User updated.");
    } catch (err) {
      setError(err.message || "User update failed");
    }
  }

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const role = String(user.roleName || user.role || "");
      const active = user.isActive !== false;
      const matchesText = !needle || [user.id, user.username, user.fullName, user.email, user.phoneNumber]
        .some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesRole = !roleFilter || role === roleFilter;
      const matchesStatus = !statusFilter || (statusFilter === "ACTIVE" ? active : !active);
      return matchesText && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  if (loading) return <LoadingBlock label="Loading users..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card admin-user-filters" role="search" aria-label="Filter users">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, username, email, phone, or ID" aria-label="Search users" />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button className="btn btn-small" type="button" onClick={() => { setQuery(""); setRoleFilter(""); setStatusFilter(""); }}>Clear</button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>All users</h3>
          <div className="button-row"><span>{filteredUsers.length} / {users.length}</span><button className="btn btn-small" onClick={load}>Refresh</button></div>
        </div>
        {filteredUsers.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td><strong>{user.fullName || user.username}</strong><br /><small>{user.username}</small></td>
                    <td>{user.email || "-"}</td>
                    <td>
                      <select value={user.roleName || user.role || ""} onChange={(event) => updateUser(user.id, () => api.users.assignRole(user.id, event.target.value))}>
                        <option value="">Choose role</option>
                        {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td><StatusBadge value={user.isActive === false ? "Inactive" : "Active"} /></td>
                    <td>
                      <button className="btn btn-small" onClick={() => updateUser(user.id, () => api.users.lock(user.id, user.isActive === false))}>
                        {user.isActive === false ? "Unlock" : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No users match the filters" body="Clear the filters or try again." />}
      </div>
    </section>
  );
}
