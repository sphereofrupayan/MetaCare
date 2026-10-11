import os
from flask import Flask, abort, render_template, request, redirect, url_for, flash
import mysql.connector

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-me")

# ---- Edit these (or set environment variables) ----
DB_CONFIG = dict(
    host="localhost",
    user="root",
    password=os.getenv("DB_PASSWORD", ""),
    database="hospital_db",
    port=3306
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
    app.run(debug=True)
