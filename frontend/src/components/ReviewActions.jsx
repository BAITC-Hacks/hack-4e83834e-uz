import { useState } from "react";
import { api } from "../api";

export default function ReviewActions({ defect, onReviewed }) {
  const [reviewerName, setReviewerName] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const alreadyDecided = defect.status !== "open";

  async function act(action) {
    setError("");
    if (!reviewerName.trim()) {
      setError("Reviewer name is required before you can approve, reject, or defer.");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.reviewDefect(defect.id, {
        action,
        reviewer_name: reviewerName.trim(),
        comment: comment.trim() || null,
      });
      onReviewed(updated);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyDecided) {
    const last = defect.approval_logs[defect.approval_logs.length - 1];
    return (
      <div className="callout callout-success">
        Already reviewed{last ? ` by ${last.reviewer_name} (${last.action})` : ""}. No further action needed — the
        AI never re-decides once a human has ruled.
      </div>
    );
  }

  return (
    <div>
      <div className="form-field">
        <label>Reviewer name (required)</label>
        <input
          type="text"
          placeholder="e.g. A. Zhaksybekov"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label>Comment (optional)</label>
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {error && <div className="callout callout-error">{error}</div>}
      <div className="btn-row">
        <button className="btn btn-approve" disabled={submitting} onClick={() => act("approve")}>
          Approve
        </button>
        <button className="btn btn-reject" disabled={submitting} onClick={() => act("reject")}>
          Reject
        </button>
        <button className="btn btn-defer" disabled={submitting} onClick={() => act("defer")}>
          Defer
        </button>
      </div>
    </div>
  );
}
