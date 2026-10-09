import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EvidenceFileActions from "../components/EvidenceFileActions";
import EvidenceLibraryPicker from "../components/EvidenceLibraryPicker";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import {
  evidenceSourceLabel,
  fileNameFromPath,
  formatEvidenceTypeLabel,
  formatViolationLabel,
} from "../config/casePresentation";
import {
  EVIDENCE_UPLOAD_ROLES,
  EVIDENCE_VIEW_ROLES,
  roleIn,
} from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import {
  fetchCases,
  fetchEvidence,
  linkEvidenceToCase,
  loadEvidenceObjectUrl,
  uploadEvidence,
} from "../services/api";

const EVIDENCE_TYPES = ["SNAPSHOT", "VIDEO_CLIP", "DOCUMENT"];

export default function EvidencePage() {
  const { user } = useAuth();
  const canView = roleIn(user?.role, EVIDENCE_VIEW_ROLES);
  const canUpload = roleIn(user?.role, EVIDENCE_UPLOAD_ROLES);
  const [searchParams, setSearchParams] = useSearchParams();
  const presetCaseId = searchParams.get("case_id") || "";
  const presetDetectionId = searchParams.get("detection_id") || "";

  const [items, setItems] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [libraryEvidence, setLibraryEvidence] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null); // { url, mime, filename } | null | 'loading' | 'unsupported'
  const previewRef = useRef(null);
  const [form, setForm] = useState({
    case_id: presetCaseId,
    evidence_type: "SNAPSHOT",
    file: null,
  });

  const casesById = useMemo(() => {
    const map = {};
    for (const c of cases) map[c.id] = c;
    return map;
  }, [cases]);

  const caseLabel = (caseId) => {
    const c = casesById[caseId];
    if (!c) return caseId != null ? `Case #${caseId}` : "—";
    return c.case_number || `Case #${caseId}`;
  };

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [evidence, caseList] = await Promise.all([
        fetchEvidence(presetCaseId || null, presetDetectionId || null),
        fetchCases(),
      ]);
      const evidenceRows = Array.isArray(evidence) ? evidence : [];
      setItems(evidenceRows);
      setCases(Array.isArray(caseList) ? caseList : []);
      setForm((prev) => ({
        ...prev,
        case_id:
          prev.case_id ||
          presetCaseId ||
          (caseList?.[0]?.id ? String(caseList[0].id) : ""),
      }));
      if (presetDetectionId && evidenceRows.length > 0) {
        await showPreview(evidenceRows[0].id);
      }
    } catch {
      setError("Unable to load evidence. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    load();
  }, [presetCaseId, presetDetectionId, canView]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  useEffect(() => {
    if (selectedId != null && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [selectedId]);

  const typeOptions = useMemo(() => {
    const set = new Set(items.map((e) => e.evidence_type).filter(Boolean));
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!typeFilter) return items;
    return items.filter((e) => e.evidence_type === typeFilter);
  }, [items, typeFilter]);

  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) || null,
    [filtered, selectedId]
  );

  const presetCase = presetCaseId ? casesById[Number(presetCaseId)] : null;

  async function showPreview(evidenceId) {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setSelectedId(evidenceId);
    setPreview("loading");
    try {
      const loaded = await loadEvidenceObjectUrl(evidenceId, { preview: true });
      const mime = loaded.mime || "";
      if (
        mime.startsWith("image/") ||
        mime.startsWith("video/") ||
        mime === "application/pdf"
      ) {
        setPreview(loaded);
      } else {
        URL.revokeObjectURL(loaded.url);
        setPreview("unsupported");
      }
    } catch {
      setPreview("unsupported");
    }
  }

  function onCaseFilterChange(value) {
    if (!value) setSearchParams({});
    else setSearchParams({ case_id: value });
  }

  async function onSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!canUpload) {
      setError("Your role is not authorized to upload evidence.");
      return;
    }
    if (!form.file && libraryEvidence.length === 0) {
      setError("Choose a file from your device or select evidence from the library.");
      return;
    }
    if (!form.case_id) {
      setError("Select the UFM case this evidence belongs to.");
      return;
    }
    setSubmitting(true);
    try {
      if (libraryEvidence.length > 0) {
        await linkEvidenceToCase(
          Number(form.case_id),
          libraryEvidence.map((evidence) => evidence.id)
        );
        setMessage(
          `${libraryEvidence.length} evidence record${libraryEvidence.length === 1 ? "" : "s"} attached to ${caseLabel(Number(form.case_id))}.`
        );
        setLibraryEvidence([]);
      } else {
        const body = new FormData();
        body.append("case_id", form.case_id);
        body.append("evidence_type", form.evidence_type);
        body.append("file", form.file);
        await uploadEvidence(body);
        setMessage(
          `Evidence uploaded successfully for ${caseLabel(Number(form.case_id))}.`
        );
      }
      setForm((prev) => ({
        ...prev,
        file: null,
      }));
      const fileInput = document.getElementById("evidence-file-input");
      if (fileInput) fileInput.value = "";
      await load();
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Evidence library is not available</p>
        <p className="mt-1">
          The institutional evidence library is limited to authorized staff.
          Evidence for your own cases appears on the case detail page when
          provided.
        </p>
        <Link
          to="/app/cases"
          className="mt-3 inline-flex text-sm font-semibold text-au-blue"
        >
          ← My Cases
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        breadcrumb={
          presetDetectionId
            ? "Home / Detections / Evidence"
            : "Home / Cases / Evidence"
        }
        title="Evidence Library"
        description={
          presetDetectionId
            ? `Evidence captured for detection #${presetDetectionId}.`
            : presetCase
            ? `Evidence associated with UFM case ${presetCase.case_number}.`
            : "Case-linked files used in UFM review. Each record belongs to a specific case."
        }
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-600">
              Case
              <select
                value={presetCaseId}
                onChange={(e) => onCaseFilterChange(e.target.value)}
                className="portal-select w-auto max-w-[14rem]"
              >
                <option value="">All cases</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-600">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="portal-select w-auto max-w-[12rem]"
              >
                <option value="">All types</option>
                {(typeOptions.length ? typeOptions : EVIDENCE_TYPES).map((t) => (
                  <option key={t} value={t}>
                    {formatEvidenceTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Unable to complete evidence action.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {canUpload ? (
        <form
          onSubmit={onSubmit}
          className="space-y-4 portal-card p-5"
        >
          <div>
            <h2 className="font-semibold text-au-navy">Upload evidence</h2>
            <p className="mt-1 text-sm text-slate-600">
              Attach a file to an existing UFM case. The upload is stored against
              that case only.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                UFM case
              </span>
              <select
                required
                value={form.case_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, case_id: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5"
              >
                {cases.length === 0 ? (
                  <option value="">No cases available</option>
                ) : (
                  cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {formatViolationLabel(c.violation_type)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Evidence type
              </span>
              <select
                required
                value={form.evidence_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, evidence_type: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5"
              >
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatEvidenceTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <div className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">
                Evidence file
              </span>
              <label
                htmlFor="evidence-file-input"
                className="btn-secondary flex w-full cursor-pointer justify-start gap-2 overflow-hidden"
              >
                <input
                  id="evidence-file-input"
                  type="file"
                  className="sr-only"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.mov,.avi,.webm,.mkv,.pdf,.txt,.csv,.doc,.docx"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] || null;
                    if (picked && picked.size > 50 * 1024 * 1024) {
                      setError("File is too large. Maximum size is 50 MB.");
                      e.target.value = "";
                      setForm((p) => ({ ...p, file: null }));
                      return;
                    }
                    setError("");
                    setLibraryEvidence([]);
                    setForm((p) => ({ ...p, file: picked }));
                  }}
                />
                <span className="shrink-0 rounded bg-sky-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-au-navy">
                  Choose file
                </span>
                <span className="truncate font-medium text-slate-700">
                  {form.file
                    ? form.file.name
                    : "No file chosen — click to browse"}
                </span>
              </label>
              {form.file ? (
                <span className="mt-1 block text-xs text-slate-600">
                  Selected: {form.file.name} (
                  {Math.max(1, Math.round(form.file.size / 1024))} KB)
                </span>
              ) : (
                <span className="mt-1 block text-xs text-slate-500">
                  No file selected.
                </span>
              )}
              <button
                type="button"
                onClick={() => setLibraryPickerOpen(true)}
                className="mt-3 text-sm font-semibold text-au-blue hover:underline"
              >
                Choose from Evidence Library
              </button>
              {libraryEvidence.length > 0 ? (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-700">
                    Selected from Evidence Library ({libraryEvidence.length})
                  </p>
                  <ul className="space-y-1">
                    {libraryEvidence.map((evidence) => (
                      <li
                        key={evidence.id}
                        className="flex items-center justify-between gap-2 text-xs text-slate-600"
                      >
                        <span className="min-w-0 truncate">
                          #{evidence.id} · {evidence.evidence_type} ·{" "}
                          {fileNameFromPath(evidence.file_path) || "Evidence file"}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 font-semibold text-rose-700 hover:underline"
                          onClick={() =>
                            setLibraryEvidence((current) =>
                              current.filter((item) => item.id !== evidence.id)
                            )
                          }
                          aria-label={`Remove evidence ${evidence.id}`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="submit"
            disabled={
              submitting ||
              !cases.length ||
              (!form.file && libraryEvidence.length === 0)
            }
            className="btn-primary"
          >
            {submitting
              ? libraryEvidence.length
                ? "Attaching…"
                : "Uploading…"
              : libraryEvidence.length
                ? "Attach evidence"
                : "Upload evidence"}
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Your role can view case evidence. Uploading new evidence is limited to
          Invigilator accounts that file UFM incidents.
        </div>
      )}

      <div>
        <section className="portal-card overflow-hidden">
          {selected && preview ? (
            <div
              ref={previewRef}
              className="border-b border-slate-100 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-au-navy">
                  Preview · Evidence #{selected.id}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (preview?.url) URL.revokeObjectURL(preview.url);
                    setPreview(null);
                    setSelectedId(null);
                  }}
                  className="text-sm font-medium text-slate-600 hover:underline"
                  aria-label="Close evidence preview"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(16rem,1fr)]">
                <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {preview === "loading" ? (
                    <p className="px-3 py-8 text-center text-sm text-slate-500">
                      Loading preview…
                    </p>
                  ) : preview === "unsupported" ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-600">
                      In-browser preview is not available for this file type.
                      Use Open or Download.
                    </p>
                  ) : preview?.mime?.startsWith("image/") ? (
                    <img
                      src={preview.url}
                      alt={`Evidence #${selected.id}`}
                      className="max-h-72 w-full object-contain"
                    />
                  ) : preview?.mime?.startsWith("video/") ? (
                    <video
                      src={preview.url}
                      controls
                      className="max-h-72 w-full bg-black"
                    />
                  ) : preview?.mime === "application/pdf" ? (
                    <iframe
                      title={`Evidence #${selected.id}`}
                      src={preview.url}
                      className="h-72 w-full"
                    />
                  ) : (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      No preview loaded.
                    </p>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Evidence ID
                      </dt>
                      <dd className="font-medium">#{selected.id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Case
                      </dt>
                      <dd className="font-medium">
                        {selected.case_id != null ? (
                          <Link
                            to={`/app/cases/${selected.case_id}`}
                            className="text-au-blue hover:underline"
                          >
                            {caseLabel(selected.case_id)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Type
                      </dt>
                      <dd>{formatEvidenceTypeLabel(selected.evidence_type)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Uploaded by
                      </dt>
                      <dd className="text-slate-700">
                        {selected.uploaded_by != null
                          ? `User #${selected.uploaded_by}`
                          : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Source
                      </dt>
                      <dd className="break-words text-slate-700">
                        {evidenceSourceLabel(selected)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        File name
                      </dt>
                      <dd className="break-all text-slate-700">
                        {fileNameFromPath(selected.file_path) || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Captured
                      </dt>
                      <dd className="text-slate-700">
                        {selected.timestamp
                          ? new Date(selected.timestamp).toLocaleString()
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Uploaded
                      </dt>
                      <dd className="text-slate-700">
                        {selected.created_at
                          ? new Date(selected.created_at).toLocaleString()
                          : "—"}
                      </dd>
                    </div>
                    {selected.seat_location ? (
                      <div className="col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Seat
                        </dt>
                        <dd>{selected.seat_location}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <EvidenceFileActions
                    evidenceId={selected.id}
                    onError={(msg) => setError(msg)}
                  />
                </div>
                {canUpload ? (
                  <EvidenceLibraryPicker
                    open={libraryPickerOpen}
                    onClose={() => setLibraryPickerOpen(false)}
                    selectedIds={libraryEvidence.map((evidence) => evidence.id)}
                    onApply={(rows) => {
                      setLibraryEvidence(rows);
                      if (rows.length > 0) {
                        setForm((current) => ({ ...current, file: null }));
                        const fileInput = document.getElementById("evidence-file-input");
                        if (fileInput) fileInput.value = "";
                      }
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-au-navy">Evidence records</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {loading
                ? "Loading…"
                : `${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
              <span className="text-slate-400">
                {" "}
                · File name and upload metadata appear in Evidence detail
              </span>
            </p>
          </div>
          {loading ? (
            <div className="px-6 py-10 text-center">
              <p className="font-medium text-au-navy">Loading evidence…</p>
              <p className="mt-1 text-sm text-slate-500">
                Retrieving case-linked files.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-semibold text-au-navy">No evidence to show</p>
              <p className="mt-1 text-sm text-slate-600">
                {presetDetectionId
                  ? `No evidence is available for detection #${presetDetectionId}.`
                  : presetCaseId
                  ? "No evidence is attached to this UFM case yet."
                  : typeFilter
                    ? "No evidence matches this type filter."
                    : "No evidence has been uploaded yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="portal-data-cards">
                {filtered.map((e) => {
                  const active = selectedId === e.id;
                  return (
                    <div
                      key={e.id}
                      className={[
                        "portal-case-card",
                        active ? "ring-2 ring-au-blue/30" : "",
                      ].join(" ")}
                      data-affordance="static"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="portal-case-card-title">#{e.id}</p>
                        <span className="text-xs font-semibold text-slate-600">
                          {formatEvidenceTypeLabel(e.evidence_type)}
                        </span>
                      </div>
                      <p className="portal-case-card-meta">
                        {e.case_id != null ? (
                          <Link
                            to={`/app/cases/${e.case_id}`}
                            className="font-medium text-au-blue hover:underline"
                          >
                            {caseLabel(e.case_id)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </p>
                      <p className="portal-case-card-meta cell-wrap">
                        {evidenceSourceLabel(e)}
                      </p>
                      <p className="portal-case-card-meta">
                        {e.timestamp
                          ? new Date(e.timestamp).toLocaleString()
                          : "—"}
                      </p>
                      <div className="mt-3">
                        <EvidenceFileActions
                          evidenceId={e.id}
                          showPreview
                          activePreview={active}
                          onPreview={showPreview}
                          onError={(msg) => setError(msg)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="portal-table-wrap portal-table-desktop">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Case</th>
                      <th>Type</th>
                      <th>Source</th>
                      <th className="col-hide-md">Captured</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => {
                      const active = selectedId === e.id;
                      return (
                        <tr
                          key={e.id}
                          className={active ? "bg-slate-50" : undefined}
                        >
                          <td className="font-semibold text-au-navy">#{e.id}</td>
                          <td>
                            {e.case_id != null ? (
                              <Link
                                to={`/app/cases/${e.case_id}`}
                                className="font-medium text-au-blue hover:underline"
                              >
                                {caseLabel(e.case_id)}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{formatEvidenceTypeLabel(e.evidence_type)}</td>
                          <td className="cell-wrap text-xs text-slate-600">
                            {evidenceSourceLabel(e)}
                          </td>
                          <td className="col-hide-md text-xs text-slate-500">
                            {e.timestamp
                              ? new Date(e.timestamp).toLocaleString()
                              : "—"}
                          </td>
                          <td>
                            <EvidenceFileActions
                              evidenceId={e.id}
                              showPreview
                              activePreview={active}
                              onPreview={showPreview}
                              onError={(msg) => setError(msg)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
