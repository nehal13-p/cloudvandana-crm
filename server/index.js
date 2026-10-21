
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = "v60.0";

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

const {
  SALESFORCE_CLIENT_ID,
  SALESFORCE_CLIENT_SECRET,
  SALESFORCE_CALLBACK_URL,
} = process.env;

const pendingLogins = new Map();
let salesforceConnection = null;

const OBJECT_FIELDS = {
  Account: ["Id", "Name", "Type", "Industry", "Phone", "Website"],
  Opportunity: ["Id", "Name", "StageName", "Amount", "CloseDate"],
  Lead: ["Id", "FirstName", "LastName", "Company", "Email", "Status"],
  Contact: ["Id", "FirstName", "LastName", "Email", "Phone", "Title"],
  Case: ["Id", "CaseNumber", "Subject", "Status", "Priority", "Origin"],
};

const WRITABLE_FIELDS = {
  Account: ["Name", "Type", "Industry", "Phone", "Website"],
  Opportunity: ["Name", "StageName", "Amount", "CloseDate"],
  Lead: ["FirstName", "LastName", "Company", "Email", "Status"],
  Contact: ["FirstName", "LastName", "Email", "Phone", "Title"],
  Case: ["Subject", "Status", "Priority", "Origin"],
};

const REQUIRED_FIELDS = {
  Account: ["Name"],
  Opportunity: ["Name", "StageName", "CloseDate"],
  Lead: ["LastName", "Company"],
  Contact: ["LastName"],
  Case: ["Status", "Origin"],
};

function getObjectName(req, res) {
  const objectName = req.params.objectName;

  if (!OBJECT_FIELDS[objectName]) {
    res.status(400).json({
      error: "Unsupported Salesforce object.",
      supportedObjects: Object.keys(OBJECT_FIELDS),
    });
    return null;
  }

  return objectName;
}

function getWritableData(objectName, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const data = {};
  const rejectedFields = [];

  for (const [key, value] of Object.entries(body)) {
    if (!WRITABLE_FIELDS[objectName].includes(key)) {
      rejectedFields.push(key);
    } else if (value !== "" && value !== null && value !== undefined) {
      data[key] = value;
    }
  }

  if (rejectedFields.length) {
    return {
      error: "One or more fields cannot be written.",
      rejectedFields,
    };
  }

  return { data };
}

async function salesforceRequest(path, options = {}) {
  if (!salesforceConnection) {
    const error = new Error(
      "Salesforce is not connected. Please connect your account first."
    );
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    `${salesforceConnection.instanceUrl}/services/data/${API_VERSION}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${salesforceConnection.accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    }
  );

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = Array.isArray(data)
      ? data.map((item) => item.message).filter(Boolean).join("; ")
      : data?.message ||
        data?.error_description ||
        "Salesforce API request failed.";

    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function sendApiError(res, error) {
  console.error("Salesforce API error:", error.message);

  res.status(error.status || 500).json({
    error: error.message || "An unexpected server error occurred.",
    ...(error.details ? { details: error.details } : {}),
  });
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "CloudVandana CRM backend is running!",
  });
});

// Salesforce OAuth with PKCE.
app.get("/auth/login", (req, res) => {
  if (!SALESFORCE_CLIENT_ID || !SALESFORCE_CALLBACK_URL) {
    return res.status(500).send(
      "Salesforce OAuth configuration is missing. Check server/.env."
    );
  }

  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  const state = crypto.randomBytes(32).toString("hex");

  pendingLogins.set(state, { verifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SALESFORCE_CLIENT_ID,
    redirect_uri: SALESFORCE_CALLBACK_URL,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  res.redirect(
    `https://login.salesforce.com/services/oauth2/authorize?${params}`
  );
});

app.get("/auth/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(
      `Salesforce authorization failed: ${error_description || error}`
    );
  }

  if (!code || !state || typeof state !== "string") {
    return res.status(400).send("Missing authorization code or state.");
  }

  const login = pendingLogins.get(state);
  pendingLogins.delete(state);

  if (!login || Date.now() - login.createdAt > 10 * 60 * 1000) {
    return res.status(400).send(
      "Login session expired or invalid. Please connect again."
    );
  }

  try {
    const tokenResponse = await fetch(
      "https://login.salesforce.com/services/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: SALESFORCE_CLIENT_ID,
          client_secret: SALESFORCE_CLIENT_SECRET || "",
          redirect_uri: SALESFORCE_CALLBACK_URL,
          code_verifier: login.verifier,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Salesforce token exchange failed:", tokenData);
      return res.status(400).send(
        "Could not connect Salesforce. Check the backend terminal."
      );
    }

    salesforceConnection = {
      accessToken: tokenData.access_token,
      instanceUrl: tokenData.instance_url,
      refreshToken: tokenData.refresh_token || null,
    };

    console.log("Salesforce OAuth succeeded.");
    res.send("Salesforce connected successfully! Return to your CRM.");
  } catch (error) {
    console.error("OAuth error:", error.message);
    res.status(500).send(
      "An error occurred during Salesforce authentication."
    );
  }
});

app.get("/api/salesforce/status", (req, res) => {
  res.json({
    connected: Boolean(salesforceConnection),
    instanceUrl: salesforceConnection?.instanceUrl || null,
  });
});

// READ: Return 20 records and check whether more exist.
app.get("/api/salesforce/:objectName", async (req, res) => {
  const objectName = getObjectName(req, res);
  if (!objectName) return;

  try {
    const fields = OBJECT_FIELDS[objectName].join(", ");

    const soql =
      `SELECT ${fields} FROM ${objectName} ` +
      "ORDER BY CreatedDate DESC LIMIT 21";

    const data = await salesforceRequest(
      `/query?q=${encodeURIComponent(soql)}`
    );

    const fetchedRecords = data.records || [];
    const records = fetchedRecords.slice(0, 20);
    const hasMore = fetchedRecords.length > 20;

    res.json({
      totalSize: data.totalSize,
      done: !hasMore,
      records,
      nextRecordsUrl: hasMore ? "offset:20" : null,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

// PAGINATION: Return the next 20 records using an offset cursor.
app.get("/api/salesforce/:objectName/next", async (req, res) => {
  const objectName = getObjectName(req, res);
  if (!objectName) return;

  const cursor = req.query.cursor;
  const match =
    typeof cursor === "string" ? /^offset:(\d+)$/.exec(cursor) : null;

  if (!match) {
    return res.status(400).json({
      error: "Invalid or missing pagination cursor.",
    });
  }

  const offset = Number(match[1]);

  if (
    !Number.isSafeInteger(offset) ||
    offset < 20 ||
    offset > 2000 ||
    offset % 20 !== 0
  ) {
    return res.status(400).json({
      error: "Pagination offset is invalid or exceeds the supported limit.",
    });
  }

  try {
    const fields = OBJECT_FIELDS[objectName].join(", ");

    const soql =
      `SELECT ${fields} FROM ${objectName} ` +
      `ORDER BY CreatedDate DESC LIMIT 21 OFFSET ${offset}`;

    const data = await salesforceRequest(
      `/query?q=${encodeURIComponent(soql)}`
    );

    const fetchedRecords = data.records || [];
    const records = fetchedRecords.slice(0, 20);
    const hasMore = fetchedRecords.length > 20;

    res.json({
      totalSize: data.totalSize,
      done: !hasMore,
      records,
      nextRecordsUrl: hasMore ? `offset:${offset + 20}` : null,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

// CREATE
app.post("/api/salesforce/:objectName", async (req, res) => {
  const objectName = getObjectName(req, res);
  if (!objectName) return;

  const result = getWritableData(objectName, req.body);
  if (result.error) return res.status(400).json(result);

  const missingFields = REQUIRED_FIELDS[objectName].filter(
    (field) =>
      result.data[field] === undefined ||
      result.data[field] === null ||
      result.data[field] === ""
  );

  if (missingFields.length) {
    return res.status(400).json({
      error: "Please provide all required fields.",
      missingFields,
    });
  }

  try {
    const data = await salesforceRequest(`/sobjects/${objectName}`, {
      method: "POST",
      body: JSON.stringify(result.data),
    });

    res.status(201).json({
      message: `${objectName} created successfully.`,
      ...data,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

// UPDATE
app.patch("/api/salesforce/:objectName/:id", async (req, res) => {
  const objectName = getObjectName(req, res);
  if (!objectName) return;

  const { id } = req.params;

  if (!/^[a-zA-Z0-9]{15,18}$/.test(id)) {
    return res.status(400).json({
      error: "Invalid Salesforce record ID.",
    });
  }

  const result = getWritableData(objectName, req.body);
  if (result.error) return res.status(400).json(result);

  if (Object.keys(result.data).length === 0) {
    return res.status(400).json({
      error: "Provide at least one field to update.",
    });
  }

  try {
    await salesforceRequest(
      `/sobjects/${objectName}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(result.data),
      }
    );

    res.json({
      success: true,
      message: `${objectName} updated successfully.`,
      id,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

// DELETE
app.delete("/api/salesforce/:objectName/:id", async (req, res) => {
  const objectName = getObjectName(req, res);
  if (!objectName) return;

  const { id } = req.params;

  if (!/^[a-zA-Z0-9]{15,18}$/.test(id)) {
    return res.status(400).json({
      error: "Invalid Salesforce record ID.",
    });
  }

  try {
    await salesforceRequest(
      `/sobjects/${objectName}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    res.json({
      success: true,
      message: `${objectName} deleted successfully.`,
      id,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
