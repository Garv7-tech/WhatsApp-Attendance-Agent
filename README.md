# WhatsApp Attendance Agent

This project is a comprehensive attendance system that uses a WhatsApp bot to automate the process of marking attendance and includes a powerful web dashboard for visualization and control. It now also features a **College Portal Automator** to mark attendance directly on a college website.

## ✨ Features

  * **WhatsApp Integration**: Captures attendance from messages sent in WhatsApp groups.
  * **Intelligent Message Parsing**: Automatically extracts student names and roll numbers from various message formats.
  * **MongoDB Database**: Stores all student and attendance data in a robust and scalable NoSQL database.
  * **Web Dashboard**: A modern, responsive web interface to:
      * Visualize attendance statistics (total, today, per group).
      * Filter, sort, and search all attendance records.
      * Upload student data in bulk via CSV files.
      * Monitor the status of the WhatsApp agent and connect by scanning a QR code.
  * **College Portal Automator**: An agent that can be launched from the dashboard to:
      * Open a browser and allow for manual or automated login to a college web portal.
      * Automatically mark attendance on the portal based on the data collected from WhatsApp.
      * Provide visual feedback (highlighting) as it works.

## 🚀 Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

  * [Node.js](https://nodejs.org/) (version 18.0.0 or higher)
  * npm (comes with Node.js)
  * A MongoDB Atlas account and a connection string.

### 1\. Installing

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/whatsapp-attendance-agent.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd whatsapp-attendance-agent
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```

### 2\. Environment Setup

Before running the application, you must create a `.env` file in the root directory of the project. This file will store your secret credentials.

1.  Create a new file named `.env`.

2.  Add the following content to it, replacing the placeholder values with your actual credentials:

    ```env
    # --- Database Configuration ---
    # Your MongoDB Atlas connection string
    MONGODB_URI="mongodb+srv://<user>:<password>@<cluster-url>/<dbname>?retryWrites=true&w=majority"

    # --- Server Port ---
    # The port the web server will run on (default is 8081)
    PORT=8081

    # --- College Portal Automation (Optional) ---
    # The full URL of the college's login page
    COLLEGE_WEBSITE_URL="https://example-college.com/login"

    # Your login credentials for the college portal
    COLLEGE_USERNAME="your_portal_username"
    COLLEGE_PASSWORD="your_portal_password"
    ```

### 3\. Running the Application

To start the application, run the following command in your terminal:

```bash
node src/index.js
```

This will start the web server and the WhatsApp agent.

  * Open your browser and go to **`http://localhost:8081`** (or the port you specified) to see the dashboard.
  * The first time you run it, you'll need to scan the QR code on the dashboard with your WhatsApp mobile app to link the agent.

## ⚙️ How to Use

### WhatsApp Attendance

1.  Start the **WhatsApp Agent** from the dashboard.
2.  Scan the QR code that appears.
3.  Once connected, any messages sent in groups that the linked WhatsApp account is a part of will be processed for attendance.

### College Portal Automator

1.  Click **"Launch College Portal"** on the dashboard. This will open a new browser window.
2.  The agent will attempt to log in automatically using the credentials from your `.env` file. If you prefer to log in manually, you can adjust the code in `src/agent/CollegeWebsiteAgent.js`.
3.  Once logged in, return to the dashboard.
4.  Use the **"Filters"** section to select the `Date` and `Group` for which you want to mark attendance.
5.  Click the **"Mark Attendance on Portal"** button.
6.  The agent will take control of the browser window, navigate to the correct page, and begin marking attendance, highlighting each student as it goes.

## 📂 Project Structure

The project has been updated to include the new agents and a more robust database structure.

```
.
├── .env                  # Stores secret credentials
├── .gitignore
├── package.json
├── public/               # Frontend files (HTML, CSS, JS)
│   ├── css/style.css
│   ├── index.html
│   └── js/
│       ├── app.js
│       └── qrcode.min.js
└── src/
    ├── agent/
    │   ├── CollegeWebsiteAgent.js  # Agent for manual portal login
    │   ├── CollegeWebsiteAgentAutomated.js # Agent for automated portal login
    │   ├── MessageParser.js      # Extracts attendance from messages
    │   └── WhatsAppAgent.js        # Connects to WhatsApp
    ├── database/
    │   ├── Database.js           # Handles MongoDB connection and queries
    │   └── Database.sqlite.js    # (Legacy) SQLite implementation
    ├── server/
    │   └── WebServer.js          # Runs the Express.js server and APIs
    └── index.js                # Main entry point to start the application
