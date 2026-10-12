# MetaCare

MetaCare is a hospital management system with a Flask web dashboard and an Expo/React Native mobile client. It helps staff manage patients, doctors, appointments, and medical records from one shared MySQL database.

## Features

- Patient and doctor registration, search, editing, and deletion
- Appointment booking, scheduling status, and printable/downloadable receipts
- Medical-record management
- Dashboard statistics for appointments, specialties, demographics, schedules, and busy doctors
- JSON API consumed by the companion mobile application
- Mobile dashboards and management views for patients, doctors, appointments, and records

## Tech stack

- Backend: Python, Flask, MySQL Connector/Python
- Database: MySQL 8+
- Web: Jinja templates, CSS, and vanilla JavaScript
- Mobile: Expo, React Native, React Navigation

## Prerequisites

- Python 3.10 or later
- MySQL 8 or later
- Node.js 18 or later and npm (only for the mobile app)

## Run the web application

1. Create the database and tables:

   ```sql
   mysql -u root -p < schema.sql
   ```

2. Create and activate a virtual environment, then install dependencies:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. Set your database credentials. The defaults are `localhost`, `root`, port `3306`, and database `hospital_db`.

   ```powershell
   $env:DB_PASSWORD = "your_mysql_password"
   # Optional: DB_HOST, DB_USER, DB_NAME, DB_PORT, SECRET_KEY
   ```

4. Start the server:

   ```powershell
   python app.py
   ```

   Open `http://127.0.0.1:5000` in a browser.

## Run the mobile app

1. Start the Flask server and ensure your phone and computer are on the same Wi-Fi network.
2. Install mobile dependencies and start Expo:

   ```powershell
   cd mobile
   npm install
   $env:EXPO_PUBLIC_API_URL = "http://YOUR_COMPUTER_LAN_IP:5000"
   npm start
   ```

   Alternatively, `npm start` runs `start-mobile.ps1`, which detects the active local-network address and configures `EXPO_PUBLIC_API_URL` automatically.

3. Scan the Expo QR code using Expo Go, or run the Android/iOS target from the Expo developer tools.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | empty | MySQL password |
| `DB_NAME` | `hospital_db` | MySQL database |
| `SECRET_KEY` | `change-me` | Flask session-signing key |
| `EXPO_PUBLIC_API_URL` | local development address | Web API URL used by the mobile app |

## API

The Flask app exposes REST-style endpoints under `/api`, including `/api/health`, `/api/dashboard`, `/api/patients`, `/api/doctors`, `/api/appointments`, and `/api/records`.

## Security note

Keep credentials in environment variables or an untracked `.env` file. Do not commit database passwords or production secret keys.
