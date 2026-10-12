import os
from datetime import datetime, timedelta
from flask import Flask, abort, render_template, request, redirect, url_for, flash, jsonify
import mysql.connector

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-me")

# ---- Edit these (or set environment variables) ----
DB_CONFIG = dict(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "hospital_db"),
    port=int(os.getenv("DB_PORT", "3306")),
)


def get_conn():
    return mysql.connector.connect(**DB_CONFIG)


def query(sql, params=(), one=False):
    conn = get_conn()
    cur = conn.cursor(dictionary=True)
    cur.execute(sql, params)
    result = cur.fetchone() if one else cur.fetchall()
    cur.close()
    conn.close()
    return result


def run(sql, params=(), ok="Saved successfully."):
    """INSERT / UPDATE / DELETE - commits so data is stored automatically."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(sql, params)
        conn.commit()
        flash(ok, "success")
        return True
    except mysql.connector.Error as e:
        conn.rollback()
        flash(f"Database error: {e.msg}", "error")
        return False
    finally:
        cur.close()
        conn.close()


def json_serialize(value):
    if isinstance(value, (list, tuple)):
        return [json_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: json_serialize(val) for key, val in value.items()}
    if isinstance(value, timedelta):
        seconds = int(value.total_seconds())
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02}:{minutes:02}:{seconds:02}"
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


GENDERS = ["Male", "Female", "Other"]
STATUSES = ["Scheduled", "Completed", "Cancelled"]

PATIENT_FIELDS = [
    dict(name="name", label="Full name", type="text", required=True),
    dict(name="age", label="Age", type="number", required=True),
    dict(name="gender", label="Gender", type="select", options=GENDERS, required=True),
    dict(name="phone", label="Phone", type="text", required=True),
    dict(name="email", label="Email", type="email"),
    dict(name="address", label="Address", type="textarea"),
]
DOCTOR_FIELDS = [
    dict(name="name", label="Full name", type="text", required=True),
    dict(name="specialization", label="Specialization", type="text", required=True),
    dict(name="phone", label="Phone", type="text", required=True),
    dict(name="email", label="Email", type="email"),
]


def form_values(fields):
    return {f["name"]: (request.form.get(f["name"], "").strip() or None) for f in fields}


# ------------------------- Dashboard -------------------------
@app.route("/")
def index():
    counts = query(
        "SELECT (SELECT COUNT(*) FROM patient) AS patients,"
        " (SELECT COUNT(*) FROM doctor) AS doctors,"
        " (SELECT COUNT(*) FROM appointment WHERE status='Scheduled') AS scheduled,"
        " (SELECT COUNT(*) FROM medical_record) AS records",
        one=True,
    )
    upcoming = query(
        "SELECT a.*, p.name AS patient, d.name AS doctor FROM appointment a "
        "JOIN patient p ON a.patient_id=p.patient_id JOIN doctor d ON a.doctor_id=d.doctor_id "
        "WHERE a.status='Scheduled' AND a.appointment_date >= CURDATE() "
        "ORDER BY a.appointment_date, a.appointment_time LIMIT 8"
    )
    return render_template("index.html", c=counts, upcoming=upcoming)


@app.route("/api/health")
def api_health():
    return jsonify({"ok": True, "service": "Hospital Management System"})


@app.route("/api/dashboard")
def api_dashboard():
    counts = query(
        "SELECT (SELECT COUNT(*) FROM patient) AS patients,"
        " (SELECT COUNT(*) FROM doctor) AS doctors,"
        " (SELECT COUNT(*) FROM appointment WHERE status='Scheduled') AS scheduled,"
        " (SELECT COUNT(*) FROM medical_record) AS records",
        one=True,
    )
    upcoming = query(
        "SELECT a.*, p.name AS patient, d.name AS doctor FROM appointment a "
        "JOIN patient p ON a.patient_id=p.patient_id JOIN doctor d ON a.doctor_id=d.doctor_id "
        "WHERE a.status='Scheduled' AND a.appointment_date >= CURDATE() "
        "ORDER BY a.appointment_date, a.appointment_time LIMIT 8"
    )
    statuses = query("SELECT status, COUNT(*) AS total FROM appointment GROUP BY status")
    specialties = query(
        "SELECT specialization AS name, COUNT(*) AS total FROM doctor "
        "GROUP BY specialization ORDER BY total DESC, name LIMIT 6"
    )
    demographics = query(
        "SELECT gender, COUNT(*) AS total, ROUND(AVG(age)) AS average_age "
        "FROM patient GROUP BY gender ORDER BY gender"
    )
    busiest = query(
        "SELECT d.name, COUNT(a.appointment_id) AS total FROM doctor d "
        "LEFT JOIN appointment a ON a.doctor_id=d.doctor_id AND a.status='Scheduled' "
        "GROUP BY d.doctor_id, d.name ORDER BY total DESC, d.name LIMIT 5"
    )
    today = query(
        "SELECT a.appointment_id, a.appointment_time, a.status, p.name AS patient, d.name AS doctor "
        "FROM appointment a JOIN patient p ON a.patient_id=p.patient_id "
        "JOIN doctor d ON a.doctor_id=d.doctor_id "
        "WHERE a.appointment_date=CURDATE() ORDER BY a.appointment_time LIMIT 10"
    )
    return jsonify({
        "counts": json_serialize(counts),
        "upcoming": json_serialize(upcoming),
        "statuses": json_serialize(statuses),
        "specialties": json_serialize(specialties),
        "demographics": json_serialize(demographics),
        "busiest": json_serialize(busiest),
        "today": json_serialize(today),
    })


def api_error(message, status=400):
    return jsonify({"error": message}), status


def api_body():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None
    return payload


def api_fields(payload, required, optional=()):
    values = {}
    for name in required:
        value = payload.get(name)
        if value is None or not str(value).strip():
            return None, f"{name.replace('_', ' ').capitalize()} is required."
        values[name] = str(value).strip()
    for name in optional:
        value = payload.get(name)
        values[name] = str(value).strip() or None if value is not None else None
    return values, None


def api_write(sql, params, success, status=200):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(sql, params)
        conn.commit()
        return jsonify({"ok": True, "message": success}), status
    except mysql.connector.Error as error:
        conn.rollback()
        app.logger.exception("Mobile API database write failed")
        if error.errno == 1062:
            return api_error("A record with that email already exists.", 409)
        if error.errno == 1452:
            return api_error("Choose an existing patient and doctor.", 400)
        return api_error("The database could not save this change. Check the submitted values.", 500)
    finally:
        cur.close()
        conn.close()


def api_row_exists(table, id_column, row_id):
    return query(f"SELECT 1 AS found FROM {table} WHERE {id_column}=%s", (row_id,), one=True) is not None


@app.route("/api/patients", methods=["GET", "POST"])
def api_patients():
    if request.method == "POST":
        payload = api_body()
        if payload is None:
            return api_error("Send patient details as JSON.")
        values, error = api_fields(
            payload,
            ("name", "age", "gender", "phone"),
            ("email", "address"),
        )
        if error:
            return api_error(error)
        try:
            age = int(values["age"])
        except ValueError:
            return api_error("Age must be a whole number.")
        if not 0 < age < 130:
            return api_error("Age must be between 1 and 129.")
        if values["gender"] not in GENDERS:
            return api_error("Choose a valid gender.")
        return api_write(
            "INSERT INTO patient (name, age, gender, phone, email, address) VALUES (%s,%s,%s,%s,%s,%s)",
            (values["name"], age, values["gender"], values["phone"], values["email"], values["address"]),
            "Patient registered.",
            201,
        )

    search = request.args.get("q", "").strip()
    if search:
        like = f"%{search}%"
        rows = query(
            "SELECT * FROM patient WHERE name LIKE %s OR phone LIKE %s OR email LIKE %s ORDER BY patient_id DESC",
            (like, like, like),
        )
    else:
        rows = query("SELECT * FROM patient ORDER BY patient_id DESC")
    return jsonify({"patients": json_serialize(rows)})


@app.route("/api/patients/<int:pid>", methods=["PUT", "DELETE"])
def api_patient_detail(pid):
    if not api_row_exists("patient", "patient_id", pid):
        return api_error("Patient not found.", 404)
    if request.method == "DELETE":
        return api_write("DELETE FROM patient WHERE patient_id=%s", (pid,), "Patient and related data deleted.")

    payload = api_body()
    if payload is None:
        return api_error("Send patient details as JSON.")
    values, error = api_fields(payload, ("name", "age", "gender", "phone"), ("email", "address"))
    if error:
        return api_error(error)
    try:
        age = int(values["age"])
    except ValueError:
        return api_error("Age must be a whole number.")
    if not 0 < age < 130:
        return api_error("Age must be between 1 and 129.")
    if values["gender"] not in GENDERS:
        return api_error("Choose a valid gender.")
    return api_write(
        "UPDATE patient SET name=%s, age=%s, gender=%s, phone=%s, email=%s, address=%s WHERE patient_id=%s",
        (values["name"], age, values["gender"], values["phone"], values["email"], values["address"], pid),
        "Patient updated.",
    )


@app.route("/api/doctors", methods=["GET", "POST"])
def api_doctors():
    if request.method == "POST":
        payload = api_body()
        if payload is None:
            return api_error("Send doctor details as JSON.")
        values, error = api_fields(payload, ("name", "specialization", "phone"), ("email",))
        if error:
            return api_error(error)
        return api_write(
            "INSERT INTO doctor (name, specialization, phone, email) VALUES (%s,%s,%s,%s)",
            (values["name"], values["specialization"], values["phone"], values["email"]),
            "Doctor added.",
            201,
        )
    rows = query("SELECT * FROM doctor ORDER BY doctor_id DESC")
    return jsonify({"doctors": json_serialize(rows)})


@app.route("/api/doctors/<int:did>", methods=["PUT", "DELETE"])
def api_doctor_detail(did):
    if not api_row_exists("doctor", "doctor_id", did):
        return api_error("Doctor not found.", 404)
    if request.method == "DELETE":
        return api_write("DELETE FROM doctor WHERE doctor_id=%s", (did,), "Doctor and related data deleted.")

    payload = api_body()
    if payload is None:
        return api_error("Send doctor details as JSON.")
    values, error = api_fields(payload, ("name", "specialization", "phone"), ("email",))
    if error:
        return api_error(error)
    return api_write(
        "UPDATE doctor SET name=%s, specialization=%s, phone=%s, email=%s WHERE doctor_id=%s",
        (values["name"], values["specialization"], values["phone"], values["email"], did),
        "Doctor updated.",
    )


@app.route("/api/appointments", methods=["GET", "POST"])
def api_appointments():
    if request.method == "POST":
        payload = api_body()
        if payload is None:
            return api_error("Send appointment details as JSON.")
        values, error = api_fields(
            payload,
            ("patient_id", "doctor_id", "appointment_date", "appointment_time"),
            ("reason",),
        )
        if error:
            return api_error(error)
        try:
            patient_id = int(values["patient_id"])
            doctor_id = int(values["doctor_id"])
            datetime.strptime(values["appointment_date"], "%Y-%m-%d")
            datetime.strptime(values["appointment_time"], "%H:%M")
        except ValueError:
            return api_error("Choose a valid patient, doctor, date, and time.")
        clash = query(
            "SELECT 1 AS found FROM appointment WHERE doctor_id=%s AND appointment_date=%s "
            "AND appointment_time=%s AND status='Scheduled'",
            (doctor_id, values["appointment_date"], values["appointment_time"]),
            one=True,
        )
        if clash:
            return api_error("That doctor already has an appointment at this date and time.", 409)
        return api_write(
            "INSERT INTO appointment (patient_id, doctor_id, appointment_date, appointment_time, reason) "
            "VALUES (%s,%s,%s,%s,%s)",
            (patient_id, doctor_id, values["appointment_date"], values["appointment_time"], values["reason"]),
            "Appointment booked.",
            201,
        )

    rows = query(
        "SELECT a.*, p.name AS patient, d.name AS doctor, d.specialization FROM appointment a "
        "JOIN patient p ON a.patient_id=p.patient_id JOIN doctor d ON a.doctor_id=d.doctor_id "
        "ORDER BY a.appointment_date DESC, a.appointment_time DESC"
    )
    return jsonify({"appointments": json_serialize(rows)})


@app.route("/api/appointments/<int:aid>", methods=["PUT", "DELETE"])
def api_appointment_detail(aid):
    if not api_row_exists("appointment", "appointment_id", aid):
        return api_error("Appointment not found.", 404)
    if request.method == "DELETE":
        return api_write("DELETE FROM appointment WHERE appointment_id=%s", (aid,), "Appointment deleted.")

    payload = api_body()
    if payload is None or payload.get("status") not in STATUSES:
        return api_error("Choose Scheduled, Completed, or Cancelled.")
    return api_write(
        "UPDATE appointment SET status=%s WHERE appointment_id=%s",
        (payload["status"], aid),
        "Appointment status updated.",
    )


@app.route("/api/records", methods=["GET", "POST"])
def api_records():
    if request.method == "POST":
        payload = api_body()
        if payload is None:
            return api_error("Send medical record details as JSON.")
        values, error = api_fields(
            payload,
            ("patient_id", "doctor_id", "diagnosis", "record_date"),
            ("prescription",),
        )
        if error:
            return api_error(error)
        try:
            patient_id = int(values["patient_id"])
            doctor_id = int(values["doctor_id"])
            datetime.strptime(values["record_date"], "%Y-%m-%d")
        except ValueError:
            return api_error("Choose a valid patient, doctor, and record date.")
        return api_write(
            "INSERT INTO medical_record (patient_id, doctor_id, diagnosis, prescription, record_date) "
            "VALUES (%s,%s,%s,%s,%s)",
            (patient_id, doctor_id, values["diagnosis"], values["prescription"], values["record_date"]),
            "Medical record added.",
            201,
        )

    patient_id = request.args.get("patient_id", "").strip()
    sql = (
        "SELECT r.*, p.name AS patient, d.name AS doctor FROM medical_record r "
        "JOIN patient p ON r.patient_id=p.patient_id JOIN doctor d ON r.doctor_id=d.doctor_id "
    )
    if patient_id:
        try:
            patient_id = int(patient_id)
        except ValueError:
            return api_error("Patient ID must be a whole number.")
        rows = query(sql + "WHERE r.patient_id=%s ORDER BY r.record_date DESC", (patient_id,))
    else:
        rows = query(sql + "ORDER BY r.record_date DESC")
    return jsonify({"records": json_serialize(rows)})


@app.route("/api/records/<int:rid>", methods=["DELETE"])
def api_record_detail(rid):
    if not api_row_exists("medical_record", "record_id", rid):
        return api_error("Medical record not found.", 404)
    return api_write("DELETE FROM medical_record WHERE record_id=%s", (rid,), "Medical record deleted.")


# ------------------------- Patients -------------------------
@app.route("/patients")
def patients():
    q = request.args.get("q", "").strip()
    if q:
        like = f"%{q}%"
        rows = query(
            "SELECT * FROM patient WHERE name LIKE %s OR phone LIKE %s OR email LIKE %s ORDER BY patient_id DESC",
            (like, like, like),
        )
    else:
        rows = query("SELECT * FROM patient ORDER BY patient_id DESC")
    return render_template("patients.html", rows=rows, q=q)


@app.route("/patients/add", methods=["GET", "POST"])
def add_patient():
    if request.method == "POST":
        v = form_values(PATIENT_FIELDS)
        if run(
            "INSERT INTO patient (name, age, gender, phone, email, address) VALUES (%s,%s,%s,%s,%s,%s)",
            (v["name"], v["age"], v["gender"], v["phone"], v["email"], v["address"]),
            "Patient registered.",
        ):
            return redirect(url_for("patients"))
        return render_template("form.html", title="Add Patient", fields=PATIENT_FIELDS, values=v, back="patients")
    return render_template("form.html", title="Add Patient", fields=PATIENT_FIELDS, values={}, back="patients")


@app.route("/patients/edit/<int:pid>", methods=["GET", "POST"])
def edit_patient(pid):
    if request.method == "POST":
        v = form_values(PATIENT_FIELDS)
        if run(
            "UPDATE patient SET name=%s, age=%s, gender=%s, phone=%s, email=%s, address=%s WHERE patient_id=%s",
            (v["name"], v["age"], v["gender"], v["phone"], v["email"], v["address"], pid),
            "Patient updated.",
        ):
            return redirect(url_for("patients"))
        return render_template("form.html", title="Edit Patient", fields=PATIENT_FIELDS, values=v, back="patients")
    row = query("SELECT * FROM patient WHERE patient_id=%s", (pid,), one=True)
    if not row:
        return redirect(url_for("patients"))
    return render_template("form.html", title="Edit Patient", fields=PATIENT_FIELDS, values=row, back="patients")


@app.route("/patients/delete/<int:pid>", methods=["POST"])
def delete_patient(pid):
    run("DELETE FROM patient WHERE patient_id=%s", (pid,), "Patient deleted.")
    return redirect(url_for("patients"))


# ------------------------- Doctors -------------------------
@app.route("/doctors")
def doctors():
    rows = query("SELECT * FROM doctor ORDER BY doctor_id DESC")
    return render_template("doctors.html", rows=rows)


@app.route("/doctors/add", methods=["GET", "POST"])
def add_doctor():
    if request.method == "POST":
        v = form_values(DOCTOR_FIELDS)
        if run(
            "INSERT INTO doctor (name, specialization, phone, email) VALUES (%s,%s,%s,%s)",
            (v["name"], v["specialization"], v["phone"], v["email"]),
            "Doctor added.",
        ):
            return redirect(url_for("doctors"))
        return render_template("form.html", title="Add Doctor", fields=DOCTOR_FIELDS, values=v, back="doctors")
    return render_template("form.html", title="Add Doctor", fields=DOCTOR_FIELDS, values={}, back="doctors")


@app.route("/doctors/edit/<int:did>", methods=["GET", "POST"])
def edit_doctor(did):
    if request.method == "POST":
        v = form_values(DOCTOR_FIELDS)
        if run(
            "UPDATE doctor SET name=%s, specialization=%s, phone=%s, email=%s WHERE doctor_id=%s",
            (v["name"], v["specialization"], v["phone"], v["email"], did),
            "Doctor updated.",
        ):
            return redirect(url_for("doctors"))
        return render_template("form.html", title="Edit Doctor", fields=DOCTOR_FIELDS, values=v, back="doctors")
    row = query("SELECT * FROM doctor WHERE doctor_id=%s", (did,), one=True)
    if not row:
        return redirect(url_for("doctors"))
    return render_template("form.html", title="Edit Doctor", fields=DOCTOR_FIELDS, values=row, back="doctors")


@app.route("/doctors/delete/<int:did>", methods=["POST"])
def delete_doctor(did):
    run("DELETE FROM doctor WHERE doctor_id=%s", (did,), "Doctor deleted.")
    return redirect(url_for("doctors"))


# ------------------------- Appointments -------------------------
@app.route("/appointments", methods=["GET", "POST"])
def appointments():
    if request.method == "POST":
        pid = request.form["patient_id"]
        did = request.form["doctor_id"]
        date = request.form["appointment_date"]
        time = request.form["appointment_time"]
        reason = request.form.get("reason", "").strip() or None
        clash = query(
            "SELECT 1 AS x FROM appointment WHERE doctor_id=%s AND appointment_date=%s "
            "AND appointment_time=%s AND status='Scheduled'",
            (did, date, time),
            one=True,
        )
        if clash:
            flash("That doctor already has an appointment at this date and time.", "error")
        else:
            run(
                "INSERT INTO appointment (patient_id, doctor_id, appointment_date, appointment_time, reason) "
                "VALUES (%s,%s,%s,%s,%s)",
                (pid, did, date, time, reason),
                "Appointment booked.",
            )
        return redirect(url_for("appointments"))

    rows = query(
        "SELECT a.*, p.name AS patient, d.name AS doctor, d.specialization FROM appointment a "
        "JOIN patient p ON a.patient_id=p.patient_id JOIN doctor d ON a.doctor_id=d.doctor_id "
        "ORDER BY a.appointment_date DESC, a.appointment_time DESC"
    )
    return render_template(
        "appointments.html",
        rows=rows,
        patients=query("SELECT patient_id, name FROM patient ORDER BY name"),
        doctors=query("SELECT doctor_id, name, specialization FROM doctor ORDER BY name"),
        statuses=STATUSES,
    )


@app.route("/appointments/<int:aid>/receipt")
def appointment_receipt(aid):
    appointment = query(
        "SELECT a.appointment_id, a.reason, a.status, "
        "DATE_FORMAT(a.appointment_date, '%M %d, %Y') AS appointment_date_display, "
        "DATE_FORMAT(a.appointment_time, '%h:%i %p') AS appointment_time_display, "
        "p.name AS patient, p.phone AS patient_phone, p.email AS patient_email, "
        "d.name AS doctor, d.specialization "
        "FROM appointment a JOIN patient p ON a.patient_id=p.patient_id "
        "JOIN doctor d ON a.doctor_id=d.doctor_id WHERE a.appointment_id=%s",
        (aid,),
        one=True,
    )
    if not appointment:
        abort(404)
    return render_template("appointment_receipt.html", appointment=appointment)


@app.route("/appointments/status/<int:aid>", methods=["POST"])
def update_status(aid):
    status = request.form.get("status")
    if status in STATUSES:
        run("UPDATE appointment SET status=%s WHERE appointment_id=%s", (status, aid), "Status updated.")
    return redirect(url_for("appointments"))


@app.route("/appointments/delete/<int:aid>", methods=["POST"])
def delete_appointment(aid):
    run("DELETE FROM appointment WHERE appointment_id=%s", (aid,), "Appointment deleted.")
    return redirect(url_for("appointments"))


# ------------------------- Medical records -------------------------
@app.route("/records", methods=["GET", "POST"])
def records():
    if request.method == "POST":
        run(
            "INSERT INTO medical_record (patient_id, doctor_id, diagnosis, prescription, record_date) "
            "VALUES (%s,%s,%s,%s,%s)",
            (
                request.form["patient_id"],
                request.form["doctor_id"],
                request.form["diagnosis"].strip(),
                request.form.get("prescription", "").strip() or None,
                request.form["record_date"],
            ),
            "Record added.",
        )
        return redirect(url_for("records"))

    pid = request.args.get("patient_id", "")
    sql = (
        "SELECT r.*, p.name AS patient, d.name AS doctor FROM medical_record r "
        "JOIN patient p ON r.patient_id=p.patient_id JOIN doctor d ON r.doctor_id=d.doctor_id "
    )
    if pid:
        rows = query(sql + "WHERE r.patient_id=%s ORDER BY r.record_date DESC", (pid,))
    else:
        rows = query(sql + "ORDER BY r.record_date DESC")
    return render_template(
        "records.html",
        rows=rows,
        sel=pid,
        patients=query("SELECT patient_id, name FROM patient ORDER BY name"),
        doctors=query("SELECT doctor_id, name FROM doctor ORDER BY name"),
    )


@app.route("/records/delete/<int:rid>", methods=["POST"])
def delete_record(rid):
    run("DELETE FROM medical_record WHERE record_id=%s", (rid,), "Record deleted.")
    return redirect(url_for("records"))


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
