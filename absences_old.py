from bs4 import BeautifulSoup
import json
import pandas as pd
from datetime import datetime

# --- Sample HTML (in a real scenario, you would fetch this from a web page) ---
with open('html.txt', 'r') as file:
    html = file.read()

# --- Parse the HTML with BeautifulSoup ---
soup = BeautifulSoup(html, 'html.parser')

# --- Find the table by ID ---
table = soup.find('table', {'id': lambda x: x and x.startswith('grid_attendanceHistory')})

# --- Define your date range ---
# Example: include only data on or after 2025 Jan 1
start_date = datetime(int(input("Enter year number: ")), int(input("Enter month number: ")), int(input("Enter date number: ")))

# Optionally define an end date if desired
# end_date = datetime(2023, 4, 30)

# --- Initialize a list to store missed school dates ---
missed_school_dates = []

# --- Loop through table rows to extract data ---
# Skip the header row (tr[0]) by using [1:]
for row in table.find_all('tr')[1:]:
    cols = row.find_all('td')
    if len(cols) > 2:
        # The date is typically in the first column
        date_str = cols[0].text.strip()
        attendance = cols[1].text.strip()
        period = cols[2].text.strip()

        # Attempt to parse the date string (e.g., "Mon Apr 3, 2023")
        # Adjust the strptime format if your actual date format differs
        try:
            row_date = datetime.strptime(date_str, "%a %b %d, %Y")
        except ValueError:
            # If parsing fails, skip or handle differently
            continue
        
        # --- Filter by your date range ---
        # Only include rows on or after start_date
        if row_date < start_date:
            continue
        
        # If you have an end_date, also do:
        # if row_date > end_date:
        #     continue

        # --- Append the row to missed_school_dates if it’s in range ---
        missed_school_dates.append({
            'date': date_str,        # Keep the original string or store row_date if you prefer
            'attendance': attendance,
            'period': period
        })

# --- (Optional) Convert to JSON format to inspect ---
missed_school_json = json.dumps(missed_school_dates, indent=4)
# print(missed_school_json)

# --- Now proceed with the rest of your logic ---

# Initialize dictionary to count excused and activity instances per period
period_counts = {f"period {i}": {"excused": 0, "activity": 0} for i in range(1, 8)}

# Function to parse the period string
def parse_period_string(period_str):
    periods = set()
    # Replace connectors ("&", "-", spaces) to create a standardized list
    parts = period_str.replace("&", ",").replace("-", ":").replace(" ", "").split(",")
    for part in parts:
        if ":" in part:  # This handles ranges like "1-8"
            start, end = map(int, part.split(":"))
            periods.update(range(start, end + 1))
        else:
            # If it’s a single period (e.g., "5"), just add it
            periods.add(int(part))
    return periods

# Process each entry in the JSON data
for entry in missed_school_dates:
    attendance_type = entry["attendance"]
    period_str = entry["period"]
    
    # Parse the periods (some rows might say "1-3" or "1&2", etc.)
    periods = parse_period_string(period_str)
    
    for p in periods:
        if 1 <= p <= 7:  # Only include periods 1 to 7
            # Exclude tardies from counting
            if "tardy" not in attendance_type.lower():
                # Count 'excused' vs. 'activity'
                if "activity" in attendance_type.lower():
                    period_counts[f"period {p}"]["activity"] += 1
                elif "excused" in attendance_type.lower():
                    period_counts[f"period {p}"]["excused"] += 1

# --- Create a DataFrame and add a total column ---
df = pd.DataFrame(period_counts).T
df["total"] = df["excused"] + df["activity"]

# --- Display the DataFrame ---
print(df)
input()  # Just to pause in a script environment


try:
    selected_period = int(input("Enter the period number (1-7) to view excused absence dates: "))
    if 1 <= selected_period <= 7:
        print(f"\nExcused absences for Period {selected_period}:")
        for entry in missed_school_dates:
            attendance_type = entry["attendance"]
            period_str = entry["period"]
            periods = parse_period_string(period_str)
            
            if selected_period in periods and "excused" in attendance_type.lower() and "tardy" not in attendance_type.lower():
                print(entry["date"])
    else:
        print("Invalid period number. Please enter a number between 1 and 7.")
except ValueError:
    print("Invalid input. Please enter a numeric period number.")