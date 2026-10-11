import os
import mysql.connector

DB_CONFIG = dict(
    host="localhost",
    user="root",
    password=os.getenv("DB_PASSWORD", ""),
    database="hospital_db",
    port=3306
)

try:
    conn = mysql.connector.connect(**DB_CONFIG)
    print("Database connected successfully!")

    cursor = conn.cursor()
    cursor.execute("SELECT DATABASE()")
    print("Database:", cursor.fetchone()[0])

    cursor.execute("SHOW TABLES")
    print("Tables:")
    for table in cursor:
        print(table[0])

    cursor.close()
    conn.close()

except mysql.connector.Error as e:
    print("Database connection failed!")
    print(e)