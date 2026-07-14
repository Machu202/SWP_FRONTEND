import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, LoadingBlock, StatusBadge } from "../components/Status";

function formatCreatedAt(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function ProfilePage() {
  const { profile, profileLoading, refreshProfile } = useAuth();
  const [form, setForm] = useState({ fullName: "", phoneNumber: "", profileData: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      fullName: profile?.fullName || "",
      phoneNumber: profile?.phoneNumber || profile?.phone_number || "",
      profileData: profile?.profileData || profile?.profile_data || ""
    });
  }, [profile]);

  useEffect(() => {
    if (!profile && !profileLoading) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.users.updateProfile({
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        profileData: form.profileData
      });
      const updated = await refreshProfile();
      if (!updated) throw new Error("Profile was saved, but the latest information could not be displayed.");
      setMessage("Profile saved successfully.");
    } catch (err) {
      setError(err.message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  }

  if (!profile && profileLoading) return <LoadingBlock label="Loading profile..." />;

  if (!profile) {
    return (
      <section className="card stack">
        <Alert type="danger">The profile could not be loaded.</Alert>
        <button className="btn btn-primary" type="button" onClick={refreshProfile}>Try again</button>
      </section>
    );
  }

  return (
    <section className="grid two" data-testid="profile-supabase-sync">
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
        <div className="upload-log" data-testid="profile-database-values">
          <div><strong>Username:</strong> {profile.username || "-"}</div>
          <div><strong>Email:</strong> {profile.email || "-"}</div>
          <div><strong>Phone:</strong> {profile.phoneNumber || profile.phone_number || "-"}</div>
          <div><strong>Created:</strong> {formatCreatedAt(profile.createdAt || profile.created_at)}</div>
        </div>
      </div>

      <form className="card form stack" onSubmit={save}>
        <div className="card-header">
          <div>
            <h3>Edit profile</h3>
            <small>Update the information shown on your profile.</small>
          </div>
        </div>
        <Alert type="success">{message}</Alert>
        <Alert type="danger">{error}</Alert>
        <label>
          Username
          <input value={profile.username || ""} readOnly disabled />
        </label>
        <label>
          Email
          <input type="email" value={profile.email || ""} readOnly disabled />
        </label>
        <label>
          Full name
          <input data-testid="profile-full-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Full name" />
        </label>
        <label>
          Phone number
          <input data-testid="profile-phone-number" type="tel" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="Optional phone number" />
        </label>
        <label>
          About me / notes
          <textarea data-testid="profile-data" rows="8" value={form.profileData} onChange={(event) => setForm({ ...form, profileData: event.target.value })} placeholder="Add profile notes" />
        </label>
        <button className="btn btn-primary" data-testid="save-profile" disabled={loading}>{loading ? "Saving..." : "Save profile"}</button>
      </form>
    </section>
  );
}
