export default function VersionCompare({ version }) {
  return (
    <div className="version-compare">
      <div className="version-box">
        <p className="small-label">Previous Version</p>
        <div className="mini-manga-page old-version">Version {Math.max(1, version - 1)}</div>
      </div>

      <div className="version-box">
        <p className="small-label">Selected Version</p>
        <div className="mini-manga-page new-version">Version {version}</div>
      </div>
    </div>
  );
}
