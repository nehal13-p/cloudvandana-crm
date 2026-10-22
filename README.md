# CloudVandana CRM

A web-based Customer Relationship Management (CRM) application that integrates with Salesforce to manage records through a simple, responsive interface.

## 🌐 Live Demo

**Application:** https://cloudvandana-crm.vercel.app/

**Backend Health Check:** https://cloudvandana-crm-api-uv0c.onrender.com/api/health

## 📌 Project Overview

CloudVandana CRM is a full-stack web application built to demonstrate Salesforce integration and CRUD (Create, Read, Update, Delete) operations.

Users can connect their Salesforce account and manage records for five Salesforce objects through a single dashboard.

## ✨ Features

- **Salesforce OAuth 2.0 Authentication:** Connect to Salesforce securely through its authorization flow.
- **Multi-Object Management:** Work with the following Salesforce objects:
  - Account
  - Opportunity
  - Lead
  - Contact
  - Case
- **CRUD Operations:** Create, view, edit, and delete Salesforce records.
- **Pagination:** Load records in batches of 20 to support browsing larger record sets.
- **Object-Specific Forms:** Display relevant fields for each selected Salesforce object.
- **Responsive UI:** Access the CRM through desktop and mobile-sized screens.
- **Session Isolation:** Keep Salesforce connections associated with individual browser sessions.

## 🛠️ Tech Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS

**Backend**
- Node.js
- Express.js
- REST APIs

**Integration**
- Salesforce REST API
- Salesforce OAuth 2.0

**Deployment**
- Vercel — Frontend
- Render — Backend

## 🚀 How to Access the Application

1. Open the [CloudVandana CRM application](https://cloudvandana-crm.vercel.app/).
2. Click **Connect Salesforce**.
3. Sign in to Salesforce when prompted and authorize the application as required.
4. After returning to the CRM dashboard, confirm that the connection status shows **Salesforce Connected**.
5. Select an object from the Salesforce object dropdown.
6. View existing records or use **Add**, **Edit**, and **Delete** to manage records.
7. Browse additional records using the **Load More Records** option when available.

**Note:** Access to Salesforce data requires a valid Salesforce account, appropriate permissions, and successful authorization. Available records and operations depend on the Salesforce org's configuration and permissions.

## 💻 Run Locally

### Prerequisites

- Node.js and npm
- A Salesforce account and Salesforce External Client App configuration
- The required Salesforce OAuth credentials

### 1. Clone the repository

```bash
git clone https://github.com/nehal13-p/cloudvandana-crm.git
cd cloudvandana-crm
```

### 2. Configure the backend

Navigate to the backend directory:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory with the following variables:

```env
PORT=5000
SALESFORCE_CLIENT_ID=your_salesforce_client_id
SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
SALESFORCE_CALLBACK_URL=your_registered_salesforce_callback_url
```

Use the exact callback URL registered in your Salesforce External Client App. For the deployed configuration, the callback is:

`https://cloudvandana-crm-api-uv0c.onrender.com/auth/callback`

### 3. Start the backend

From the `server` directory, run:

```bash
npm start
```

If the project does not define a `start` script, use the start command specified in `server/package.json`.

The backend should run at:

`http://localhost:5000`

### 4. Configure the frontend

Open a second terminal and navigate to the frontend directory:

```bash
cd client
npm install
```

Create a `.env` file in the `client` directory containing:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 5. Start the frontend

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

`http://localhost:5173`

**OAuth configuration note:** The Salesforce callback URL must match the URL registered in Salesforce. The current Salesforce configuration uses the deployed Render callback, so a fully independent local OAuth flow may require a separate Salesforce app configuration or coordinated callback setup.

## 🔐 Security Notes

- Keep Salesforce client secrets in backend environment variables.
- Never commit `.env` files or expose Salesforce client secrets in frontend code.
- Use HTTPS for deployed authentication and API communication.
- OAuth state, PKCE, and one-time handoff codes are used in the authentication flow.
- Salesforce access is subject to the authenticated user's permissions.

## 📁 Project Structure

```text
cloudvandana-crm/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express backend
├── .gitignore
└── README.md
```

## 👩‍💻 Author

Developed as a Salesforce CRUD application project.

## 📄 License

No license has been specified for this repository.
