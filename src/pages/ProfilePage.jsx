import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, LoadingBlock, StatusBadge } from "../components/Status";

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ fullName: "", profileData: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({ fullName: profile?.fullName || "", profileData: profile?.profileData || "" });
  }, [profile]);

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.users.updateProfile(form);
      await refreshProfile();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err.message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  }

  if (!profile) return <LoadingBlock label="Loading profile..." />;

  return (
    <section className="grid two">
      <div className="card stack">
        <div className="card-header">
          <h3>My profile</h3>
          <StatusBadge value={profile.isActive === false ? "Inactive" : "Active"} />
        </div>
        <div className="profile-card">
          <div className="avatar huge">{(profile.username || "U").slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>{profile.fullName || profile.username}</h2>
            <p>{profile.email || "No email"}</p>
            <div className="meta-row"><StatusBadge value={profile.roleName} /><span>ID: {profile.id}</span></div>
          </div>
        </div>
      </div>

      <form className="card form stack" onSubmit={save}>
        <h3>Edit profile</h3>
        <Alert type="success">{message}</Alert>
        <Alert type="danger">{error}</Alert>
        <label>
          Full name
          <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </label>
        <label>
          Profile data JSON/text
          <textarea rows="8" value={form.profileData} onChange={(event) => setForm({ ...form, profileData: event.target.value })} placeholder='{"bio":"...","avatar":"..."}' />
        </label>
        <button className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Save profile"}</button>
      </form>
    </section>
  );
}
