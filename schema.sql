CREATE DATABASE IF NOT EXISTS hospital_db;
USE hospital_db;

CREATE TABLE IF NOT EXISTS patient (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    age        INT NOT NULL CHECK (age > 0 AND age < 130),
    gender     ENUM('Male','Female','Other') NOT NULL,
    phone      VARCHAR(15) NOT NULL,
    email      VARCHAR(100) UNIQUE,
    address    VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS doctor (
    doctor_id      INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    phone          VARCHAR(15) NOT NULL,
    email          VARCHAR(100) UNIQUE
);

CREATE TABLE IF NOT EXISTS appointment (
    appointment_id   INT AUTO_INCREMENT PRIMARY KEY,
    patient_id       INT NOT NULL,
    doctor_id        INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason           VARCHAR(255),
    status           ENUM('Scheduled','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)  REFERENCES doctor(doctor_id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_record (
    record_id    INT AUTO_INCREMENT PRIMARY KEY,
    patient_id   INT NOT NULL,
    doctor_id    INT NOT NULL,
    diagnosis    VARCHAR(255) NOT NULL,
    prescription VARCHAR(255),
    record_date  DATE NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)  REFERENCES doctor(doctor_id)  ON DELETE CASCADE
);

-- Optional sample data
INSERT INTO doctor (name, specialization, phone, email) VALUES
 ('Dr. Anita Rao', 'Cardiology', '9876500001', 'anita@hospital.com'),
 ('Dr. Vikram Shah', 'Orthopedics', '9876500002', 'vikram@hospital.com');
INSERT INTO patient (name, age, gender, phone, email, address) VALUES
 ('Rahul Kumar', 32, 'Male', '9123400001', 'rahul@example.com', 'Chennai'),
 ('Priya Das', 27, 'Female', '9123400002', 'priya@example.com', 'Vellore');
INSERT INTO appointment (patient_id, doctor_id, appointment_date, appointment_time, reason)
 VALUES (1, 1, CURDATE(), '10:30:00', 'Chest pain checkup');
INSERT INTO medical_record (patient_id, doctor_id, diagnosis, prescription, record_date)
 VALUES (1, 1, 'Mild hypertension', 'Amlodipine 5mg daily', CURDATE());

-- Useful queries (joins)
-- SELECT a.appointment_id, p.name AS patient, d.name AS doctor, a.appointment_date, a.status
-- FROM appointment a JOIN patient p ON a.patient_id=p.patient_id JOIN doctor d ON a.doctor_id=d.doctor_id;
