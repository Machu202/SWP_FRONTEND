import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import VersionCompare from "../../components/manga/VersionCompare";
import { mockAnnotations } from "../../data/mockAnnotations";

export default function RevisionTrackingPage() {
  const { chapterId } = useParams();
  const [version, setVersion] = useState(2);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Revision Tracking</h1>
          <p>Compare page versions and check whether Tantou feedback was fixed.</p>
        </div>

        <Link to={`/app/tantou/chapters/${chapterId}/report`} className="btn link-button">
          Approve for Report
        </Link>
      </div>

      <section className="card">
        <label className="form-label">Version Slider: Version {version}</label>
        <input
          className="range"
          type="range"
          min="1"
          max="3"
          value={version}
          onChange={(event) => setVersion(Number(event.target.value))}
        />

        <VersionCompare version={version} />
      </section>

      <section className="card">
        <h3>Feedback Resolution Checklist</h3>

        {mockAnnotations.map((item) => (
          <div key={item.id} className="revision-row">
            <div>
              <strong>{item.type}</strong>
              <p>{item.comment}</p>
            </div>
            <span className={item.status === "Fixed" ? "status fixed" : "status"}>
              {item.status}
            </span>
          </div>
        ))}

        <div className="action-row">
          <button className="btn">Approve Revision</button>
          <button className="btn secondary">Request More Changes</button>
        </div>
      </section>
    </div>
  );
}
