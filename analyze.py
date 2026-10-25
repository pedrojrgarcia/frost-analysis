import sqlite3

DB_FILE = "frost_data.db"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS daily_gdd (
    date             TEXT PRIMARY KEY,
    year             INTEGER,
    gdd_daily        REAL,
    gdd_accumulated  REAL
)
"""

INSERT_SQL = """
INSERT OR REPLACE INTO daily_gdd (date, year, gdd_daily, gdd_accumulated)
VALUES (?, ?, ?, ?)
"""


def compute_gdd_for_year(conn, year):
    rows = conn.execute(
        "SELECT date, temp_mean FROM daily_weather WHERE date >= ? ORDER BY date",
        (f"{year}-01-01",),
    ).fetchall()

    accumulated = 0.0
    gdd_rows = []
    for date_str, temp_mean in rows:
        if not date_str.startswith(str(year)):
            break
        daily = max(0.0, (temp_mean or 0.0) - 10.0)
        accumulated += daily
        gdd_rows.append((date_str, year, daily, accumulated))

    return gdd_rows


def main():
    conn = sqlite3.connect(DB_FILE)
    conn.execute(CREATE_TABLE_SQL)
    conn.commit()

    years = [
        row[0]
        for row in conn.execute(
            "SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) FROM daily_weather ORDER BY 1"
        )
    ]

    for year in years:
        rows = compute_gdd_for_year(conn, year)
        conn.executemany(INSERT_SQL, rows)
        conn.commit()
        print(f"{year}: GDD calculated for {len(rows)} days.")

    conn.close()


if __name__ == "__main__":
    main()
