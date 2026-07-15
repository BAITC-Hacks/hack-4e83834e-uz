import { useState } from "react";
import { api } from "../api";
import { ACTION_META } from "../constants";
import { useLang } from "../i18n.jsx";

export default function ReviewActions({ defect, onReviewed }) {
  const { t, pick } = useLang();
  const [reviewerName, setReviewerName] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const alreadyDecided = defect.status !== "open";

  async function act(action) {
    setError("");
    if (!reviewerName.trim()) {
      setError(t("review_name_required"));
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
      setError(e?.response?.data?.detail || t("review_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyDecided) {
    const last = defect.approval_logs[defect.approval_logs.length - 1];
    return (
      <div className="callout callout-success">
        {t("review_already_decided")}
        {last ? ` ${t("review_by")} ${last.reviewer_name} (${pick(ACTION_META[last.action]?.label) || last.action})` : ""}.{" "}
        {t("review_already_decided_suffix")}
      </div>
    );
  }

  return (
    <div>
      <div className="form-field">
        <label>{t("review_name_label")}</label>
        <input
          type="text"
          placeholder={t("review_name_placeholder")}
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label>{t("review_comment_label")}</label>
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {error && <div className="callout callout-error">{error}</div>}
      <div className="btn-row">
        <button className="btn btn-approve" disabled={submitting} onClick={() => act("approve")}>
          {t("review_approve")}
        </button>
        <button className="btn btn-reject" disabled={submitting} onClick={() => act("reject")}>
          {t("review_reject")}
        </button>
        <button className="btn btn-defer" disabled={submitting} onClick={() => act("defer")}>
          {t("review_defer")}
        </button>
      </div>
    </div>
  );
}
