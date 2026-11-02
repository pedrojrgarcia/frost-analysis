import sqlite3

DB_FILE = "frost_data.db"

WEATHER_TABLE = "daily_weather"
GDD_TABLE = "daily_gdd"


def create_table_sql(gdd_table):
    return f"""
    CREATE TABLE IF NOT EXISTS {gdd_table} (
        date             TEXT PRIMARY KEY,
        year             INTEGER,
        gdd_daily        REAL,
        gdd_accumulated  REAL
    )
    """


def insert_sql(gdd_table):
    return f"""
    INSERT OR REPLACE INTO {gdd_table} (date, year, gdd_daily, gdd_accumulated)
    VALUES (?, ?, ?, ?)
    """


def table_exists(conn, table):
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone() is not None


def compute_gdd_for_year(conn, weather_table, year):
    rows = conn.execute(
        f"SELECT date, temp_mean FROM {weather_table} WHERE date >= ? ORDER BY date",
        (f"{year}-01-01",),
    ).fetchall()

    accumulated = 0.0
    gdd_rows = []
    for date_str, temp_mean in rows:
        if not date_str.startswith(str(year)):
            break
        if temp_mean is None:
            continue
        daily = max(0.0, temp_mean - 10.0)
        accumulated += daily
        gdd_rows.append((date_str, year, daily, accumulated))

    return gdd_rows


def analyze(conn, weather_table, gdd_table):
    if not table_exists(conn, weather_table):
        print(f"Table {weather_table} not found. Run fetch.py first.")
        return

    conn.execute(create_table_sql(gdd_table))
    conn.commit()

    years = [
        row[0]
        for row in conn.execute(
            f"SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) FROM {weather_table} ORDER BY 1"
        )
    ]

    for year in years:
        rows = compute_gdd_for_year(conn, weather_table, year)
        conn.executemany(insert_sql(gdd_table), rows)
        conn.commit()
        print(f"{year}: GDD calculated for {len(rows)} days.")


def main():
    conn = sqlite3.connect(DB_FILE)
    analyze(conn, WEATHER_TABLE, GDD_TABLE)
    conn.close()


if __name__ == "__main__":
    main()
