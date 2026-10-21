
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

// Uses the deployed backend when VITE_API_BASE_URL is configured.
// Falls back to localhost for local development.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const OBJECTS = ["Account", "Opportunity", "Lead", "Contact", "Case"];

const OBJECT_DESCRIPTIONS = {
  Account: "Manage companies and customer accounts.",
  Opportunity: "Track potential deals and sales progress.",
  Lead: "Organize and qualify potential customers.",
  Contact: "Keep customer and business contact details.",
  Case: "Manage customer issues and support requests.",
};

const FIELD_LABELS = {
  Id: "ID",
  Name: "Name",
  Type: "Type",
  Industry: "Industry",
  Phone: "Phone",
  Website: "Website",
  StageName: "Stage",
  Amount: "Amount",
  CloseDate: "Close Date",
  FirstName: "First Name",
  LastName: "Last Name",
  Company: "Company",
  Email: "Email",
  Status: "Status",
  Title: "Title",
  CaseNumber: "Case Number",
  Subject: "Subject",
  Priority: "Priority",
  Origin: "Origin",
};

const FORM_FIELDS = {
  Account: [
    { name: "Name", required: true },
    {
      name: "Type",
      options: [
        "Prospect",
        "Customer - Direct",
        "Customer - Channel Partner",
        "Other",
      ],
    },
    {
      name: "Industry",
      options: [
        "Agriculture",
        "Banking",
        "Education",
        "Finance",
        "Healthcare",
        "Manufacturing",
        "Technology",
        "Other",
      ],
    },
    { name: "Phone" },
    { name: "Website" },
  ],
  Opportunity: [
    { name: "Name", required: true },
    {
      name: "StageName",
      required: true,
      options: [
        "Prospecting",
        "Qualification",
        "Needs Analysis",
        "Value Proposition",
        "Id. Decision Makers",
        "Perception Analysis",
        "Proposal/Price Quote",
        "Negotiation/Review",
        "Closed Won",
        "Closed Lost",
      ],
    },
    { name: "Amount", type: "number" },
    { name: "CloseDate", type: "date", required: true },
  ],
  Lead: [
    { name: "FirstName" },
    { name: "LastName", required: true },
    { name: "Company", required: true },
    { name: "Email", type: "email" },
    {
      name: "Status",
      required: true,
      options: ["New", "Working", "Nurturing", "Qualified", "Unqualified"],
    },
  ],
  Contact: [
    { name: "FirstName" },
    { name: "LastName", required: true },
    { name: "Email", type: "email" },
    { name: "Phone" },
    { name: "Title" },
  ],
  Case: [
    { name: "Subject" },
    {
      name: "Status",
      required: true,
      options: ["New", "Working", "Escalated", "Closed"],
    },
    { name: "Priority", options: ["High", "Medium", "Low"] },
    {
      name: "Origin",
      required: true,
      options: ["Phone", "Email", "Web"],
    },
  ],
};

function emptyForm(objectType) {
  return Object.fromEntries(
    FORM_FIELDS[objectType].map((field) => [field.name, ""])
  );
}

function App() {
  const [objectType, setObjectType] = useState("Account");
  const [records, setRecords] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextRecordsUrl, setNextRecordsUrl] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm("Account"));

  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (connected) {
      fetchRecords();
    } else {
      setRecords([]);
      setHasMore(false);
      setNextRecordsUrl(null);
    }
  }, [objectType, connected]);

  async function checkConnection() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/salesforce/status`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to check Salesforce connection.");
      }

      setConnected(data.connected);
      setError(
        data.connected
          ? ""
          : "Connect your Salesforce account to manage records."
      );
    } catch {
      setConnected(false);
      setError("Cannot reach the backend. Check the backend URL and server status.");
    }
  }

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setRecords([]);
    setHasMore(false);
    setNextRecordsUrl(null);
    loadingMoreRef.current = false;
    setLoadingMore(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/salesforce/${objectType}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to fetch records.");
      }

      setRecords(data.records || []);
      setNextRecordsUrl(data.nextRecordsUrl || null);
      setHasMore(Boolean(data.nextRecordsUrl));
    } catch (err) {
      setRecords([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [objectType]);

  const loadMoreRecords = useCallback(async () => {
    if (!connected || !nextRecordsUrl || loadingMoreRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/salesforce/${objectType}/next?cursor=${encodeURIComponent(
          nextRecordsUrl
        )}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load more records.");
      }

      setRecords((previous) => {
        const existingIds = new Set(previous.map((record) => record.Id));
        const newRecords = (data.records || []).filter(
          (record) => !existingIds.has(record.Id)
        );

        return [...previous, ...newRecords];
      });

      setNextRecordsUrl(data.nextRecordsUrl || null);
      setHasMore(Boolean(data.nextRecordsUrl));
    } catch (err) {
      setError(err.message);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [connected, nextRecordsUrl, objectType]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (
      !sentinel ||
      !connected ||
      !hasMore ||
      loading ||
      loadingMore
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRecords();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    connected,
    hasMore,
    loading,
    loadingMore,
    loadMoreRecords,
    records.length,
  ]);

  function connectSalesforce() {
    window.location.href = '${API_BASE_URL}/auth/login';
  }

  function openCreateForm() {
    setEditingId(null);
    setFormData(emptyForm(objectType));
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditForm(record) {
    const values = emptyForm(objectType);

    for (const field of FORM_FIELDS[objectType]) {
      values[field.name] = record[field.name] ?? "";
    }

    setEditingId(record.Id);
    setFormData(values);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormData(emptyForm(objectType));
  }

  function updateField(fieldName, value) {
    setFormData((previous) => ({
      ...previous,
      [fieldName]: value,
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const payload = {};

    for (const field of FORM_FIELDS[objectType]) {
      const value = formData[field.name];

      if (value !== "") {
        payload[field.name] =
          field.type === "number" ? Number(value) : value;
      }
    }

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/salesforce/${objectType}/${editingId}`
        : `${API_BASE_URL}/api/salesforce/${objectType}`;

      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const missing = data.missingFields?.length
          ? ` Missing fields: ${data.missingFields.join(", ")}.`
          : "";

        throw new Error((data.error || "Unable to save record.") + missing);
      }

      closeForm();
      setNotice(data.message || "Record saved successfully.");
      await fetchRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(record) {
    const displayName =
      record.Name ||
      [record.FirstName, record.LastName].filter(Boolean).join(" ") ||
      record.Subject ||
      record.CaseNumber ||
      record.Id;

    if (!window.confirm(`Delete "${displayName}"? This cannot be undone.`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/salesforce/${objectType}/${record.Id}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete record.");
      }

      setNotice(data.message || "Record deleted successfully.");
      await fetchRecords();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="brand-mark" aria-hidden="true">
            CV
          </div>
          <div>
            <p className="brand-eyebrow">WORKSPACE</p>
            <h1>CloudVandana CRM</h1>
            <p className="header-subtitle">
              Salesforce record management, made simpler.
            </p>
          </div>
        </div>

        <div className="header-right">
          <div
            className={`connection ${
              connected ? "connection-online" : "connection-offline"
            }`}
            role="status"
          >
            <span
              className={connected ? "status-dot online" : "status-dot"}
            />
            <span>
              {connected ? "Salesforce Connected" : "Not Connected"}
            </span>
          </div>

          {!connected && (
            <button
              className="header-connect-button"
              onClick={connectSalesforce}
            >
              Connect Salesforce
            </button>
          )}
        </div>
      </header>

      <main className="container">
        <section className="welcome-section">
          <div>
            <p className="section-eyebrow">YOUR WORKSPACE</p>
            <h2>CRM Dashboard</h2>
            <p className="welcome-description">
              View, organize, and manage your Salesforce records in one place.
            </p>
          </div>
          <div className="workspace-badge">
            <span className="workspace-badge-dot" />
            {connected ? "Workspace active" : "Awaiting connection"}
          </div>
        </section>

        <section className="toolbar">
          <div className="toolbar-main">
            <div className="field-group object-selector">
              <label htmlFor="objectType">Salesforce object</label>
              <select
                id="objectType"
                value={objectType}
                onChange={(event) => {
                  setObjectType(event.target.value);
                  setFormOpen(false);
                  setError("");
                  setNotice("");
                }}
              >
                {OBJECTS.map((object) => (
                  <option key={object} value={object}>
                    {object}
                  </option>
                ))}
              </select>
            </div>

            <div className="object-description">
              <span className="object-description-label">CURRENT VIEW</span>
              <span>{OBJECT_DESCRIPTIONS[objectType]}</span>
            </div>
          </div>

          <div className="toolbar-actions">
            <button
              className="secondary-button"
              onClick={fetchRecords}
              disabled={!connected || loading || loadingMore}
            >
              <span aria-hidden="true">↻</span> Refresh
            </button>

            <button
              className="primary-button"
              onClick={openCreateForm}
              disabled={!connected}
            >
              <span aria-hidden="true">＋</span> Add {objectType}
            </button>
          </div>
        </section>

        {notice && (
          <div className="success-message" role="status">
            <span className="message-icon" aria-hidden="true">✓</span>
            {notice}
            <button
              className="message-dismiss"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            <span className="message-icon" aria-hidden="true">!</span>
            {error}
            <button
              className="message-dismiss"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {formOpen && (
          <section className="record-form">
            <div className="form-heading">
              <div className="form-title-group">
                <span className="form-icon" aria-hidden="true">
                  {editingId ? "✎" : "＋"}
                </span>
                <div>
                  <p className="section-eyebrow">
                    {editingId ? "UPDATE RECORD" : "NEW RECORD"}
                  </p>
                  <h2>
                    {editingId ? `Edit ${objectType}` : `Add ${objectType}`}
                  </h2>
                </div>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeForm}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div className="form-grid">
                {FORM_FIELDS[objectType].map((field) => (
                  <div className="field-group" key={field.name}>
                    <label htmlFor={field.name}>
                      {FIELD_LABELS[field.name] || field.name}
                      {field.required ? " *" : ""}
                    </label>

                    {field.options ? (
                      <select
                        id={field.name}
                        value={formData[field.name]}
                        required={field.required}
                        onChange={(event) =>
                          updateField(field.name, event.target.value)
                        }
                      >
                        <option value="">
                          Select {FIELD_LABELS[field.name] || field.name}
                        </option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={field.name}
                        type={field.type || "text"}
                        value={formData[field.name]}
                        required={field.required}
                        step={field.type === "number" ? "any" : undefined}
                        onChange={(event) =>
                          updateField(field.name, event.target.value)
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              <p className="form-hint">
                Fields marked * are required. Your Salesforce org may enforce
                additional rules.
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={loading}
                >
                  {loading
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Record"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="records">
          <div className="records-heading">
            <div>
              <p className="section-eyebrow">RECORD MANAGEMENT</p>
              <h2>{objectType} Records</h2>
              <p className="records-subtitle">
                Browse and manage your {objectType.toLowerCase()} data.
              </p>
            </div>

            <div className="record-count" aria-live="polite">
              <span className="record-count-number">{records.length}</span>
              <span>
                {records.length === 1 ? "record loaded" : "records loaded"}
              </span>
            </div>
          </div>

          {loading && (
            <div className="loading-state" role="status">
              <span className="spinner" />
              <span>Loading {objectType.toLowerCase()} records...</span>
            </div>
          )}

          {!loading && connected && records.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">▤</div>
              <h3>No {objectType} records yet</h3>
              <p>
                When records are available, they will appear here. You can also
                create a new record to get started.
              </p>
              <button
                className="primary-button"
                onClick={openCreateForm}
              >
                <span aria-hidden="true">＋</span> Add {objectType}
              </button>
            </div>
          )}

          {!loading && records.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    {Object.keys(records[0])
                      .filter((key) => key !== "attributes")
                      .map((key) => (
                        <th key={key}>{FIELD_LABELS[key] || key}</th>
                      ))}
                    <th className="actions-heading">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => (
                    <tr key={record.Id}>
                      {Object.keys(record)
                        .filter((key) => key !== "attributes")
                        .map((key) => (
                          <td key={key}>
                            <span className="cell-value">
                              {record[key] == null || record[key] === ""
                                ? "—"
                                : String(record[key])}
                            </span>
                          </td>
                        ))}

                      <td className="actions-cell">
                        <div className="row-actions">
                          <button
                            className="edit-button"
                            onClick={() => openEditForm(record)}
                            aria-label={`Edit ${
                              record.Name || record.Subject || record.Id
                            }`}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-button"
                            onClick={() => deleteRecord(record)}
                            aria-label={`Delete ${
                              record.Name || record.Subject || record.Id
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && (
            <div className="pagination-area">
              <div
                ref={sentinelRef}
                className="scroll-sentinel"
                aria-hidden="true"
              />
              <button
                className="secondary-button load-more-button"
                onClick={loadMoreRecords}
                disabled={loadingMore || loading}
              >
                {loadingMore ? (
                  <>
                    <span className="button-spinner" />
                    Loading more records...
                  </>
                ) : (
                  <>Load More Records <span aria-hidden="true">↓</span></>
                )}
              </button>
              <p className="pagination-hint">
                More records will be added below the existing records.
              </p>
            </div>
          )}

          {loadingMore && (
            <p className="message loading-more-message" role="status">
              Fetching the next batch of records...
            </p>
          )}

          {!hasMore && records.length > 0 && !loading && (
            <p className="message end-message">
              <span aria-hidden="true">✓</span> You've reached the end of the records.
            </p>
          )}
        </section>

        <footer className="app-footer">
          <span>CloudVandana CRM</span>
          <span>Salesforce record management</span>
        </footer>
      </main>
    </div>
  );
}

export default App;