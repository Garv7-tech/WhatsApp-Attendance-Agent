# WhatsApp Attendance Agent

This project is a WhatsApp-based attendance system. It uses a WhatsApp bot to automate the process of marking attendance.

## Features

*   **QR Code Generation**: Generates a QR code for session authentication.
*   **WhatsApp Integration**: Interacts with users via WhatsApp messages.
*   **Attendance Tracking**: Records attendance in a local database.
*   **Web Interface**: Provides a simple web interface to display the QR code.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   [Node.js](https://nodejs.org/)
*   npm (comes with Node.js)

### Installing

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

### Running the Application

To start the application, run the following command:

```bash
npm start
```

This will start the server and the WhatsApp agent. Open your browser and go to `http://localhost:8081` to see the QR code for authentication.

## Project Structure

```
.
├── .gitignore
├── attendance.db
├── package.json
├── public
│   ├── css
│   │   └── style.css
│   ├── index.html
│   └── js
│       ├── app.js
│       └── qrcode.min.js
├── src
│   ├── agent
│   │   ├── MessageParser.js
│   │   └── WhatsAppAgent.js
│   ├── database
│   │   ├── Database.js
│   │   └── Database.sqlite.js
│   ├── index.js
│   └── server
│       └── WebServer.js
└── uploads
```
