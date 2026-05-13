import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import time
import concurrent.futures

STATE_CENTROIDS = {
    "01": [32.8066, -86.7911],  # Alabama
    "02": [61.3707, -152.4044], # Alaska
    "04": [33.7298, -111.4312], # Arizona
    "05": [34.9697, -92.3731],  # Arkansas
    "06": [36.1162, -119.6816], # California
    "08": [39.0598, -105.3111], # Colorado
    "09": [41.5978, -72.7554],  # Connecticut
    "10": [39.3185, -75.5071],  # Delaware
    "11": [38.8974, -77.0268],  # District of Columbia
    "12": [27.7663, -81.6868],  # Florida
    "13": [33.0406, -83.6431],  # Georgia
    "15": [21.0943, -157.4983], # Hawaii
    "16": [44.2405, -114.4788], # Idaho
    "17": [40.3495, -88.9861],  # Illinois
    "18": [39.8494, -86.2583],  # Indiana
    "19": [42.0115, -93.2105],  # Iowa
    "20": [38.5266, -96.7265],  # Kansas
    "21": [37.6681, -84.6701],  # Kentucky
    "22": [31.1695, -91.8678],  # Louisiana
    "23": [44.6939, -69.3819],  # Maine
    "24": [39.0639, -76.8021],  # Maryland
    "25": [42.2302, -71.5301],  # Massachusetts
    "26": [43.3266, -84.5361],  # Michigan
    "27": [45.6945, -93.9002],  # Minnesota
    "28": [32.7416, -89.6787],  # Mississippi
    "29": [38.4561, -92.2884],  # Missouri
    "30": [46.9219, -110.4544], # Montana
    "31": [41.1254, -98.2681],  # Nebraska
    "32": [38.3135, -117.0554], # Nevada
    "33": [43.4525, -71.5639],  # New Hampshire
    "34": [40.2989, -74.5210],  # New Jersey
    "35": [34.8405, -106.2485], # New Mexico
    "36": [42.1657, -74.9481],  # New York
    "37": [35.6301, -79.8064],  # North Carolina
    "38": [47.5289, -99.7840],  # North Dakota
    "39": [40.3888, -82.7649],  # Ohio
    "40": [35.5653, -96.9289],  # Oklahoma
    "41": [44.5720, -122.0709], # Oregon
    "42": [40.5908, -77.2098],  # Pennsylvania
    "44": [41.6809, -71.5118],  # Rhode Island
    "45": [33.8569, -80.9450],  # South Carolina
    "46": [44.2998, -99.4388],  # South Dakota
    "47": [35.7478, -86.6923],  # Tennessee
    "48": [31.0545, -97.5635],  # Texas
    "49": [40.1500, -111.8624], # Utah
    "50": [44.0459, -72.7107],  # Vermont
    "51": [37.7693, -78.1700],  # Virginia
    "53": [47.4009, -121.4905], # Washington
    "54": [38.4912, -80.9545],  # West Virginia
    "55": [44.2685, -89.6165],  # Wisconsin
    "56": [42.7560, -107.3025]  # Wyoming
}

BASE_URL = "https://modis.ornl.gov/rst/api/v1"
YEARS = [2020, 2021, 2022, 2023, 2024]
DOY_CHUNKS = [
    ("001", "065"), ("066", "130"), ("131", "195"),
    ("196", "260"), ("261", "325"), ("326", "366")
]

# Set up a robust session with automatic retries for connection drops
session = requests.Session()
retries = Retry(total=5, backoff_factor=1, status_forcelist=[ 429, 500, 502, 503, 504 ])
session.mount('https://', HTTPAdapter(max_retries=retries))

def fetch_modis_data(product, band, lat, lon, start_date, end_date):
    url = f"{BASE_URL}/{product}/subset?latitude={lat}&longitude={lon}&band={band}&startDate={start_date}&endDate={end_date}&kmAboveBelow=0&kmLeftRight=0"
    try:
        response = session.get(url, timeout=10)
        if response.status_code == 200:
            return response.json().get("subset", [])
    except Exception as e:
        print(f"  [!] Connection error fetching {product}: {e}")
    return []

def process_single_state(item):
    fips, (lat, lon) = item
    print(f"Starting FIPS {fips}...")
    
    state_results = {}
    
    for year in YEARS:
        lst_list = []
        ndvi_list = []

        for start_doy, end_doy in DOY_CHUNKS:
            start_date = f"A{year}{start_doy}"
            end_date = f"A{year}{end_doy}"

            lst_raw = fetch_modis_data("MOD11A2", "LST_Day_1km", lat, lon, start_date, end_date)
            ndvi_raw = fetch_modis_data("MOD13Q1", "250m_16_days_NDVI", lat, lon, start_date, end_date)

            for entry in lst_raw:
                val = float(entry['data'][0])
                if val > 0: 
                    lst_list.append((val * 0.02) - 273.15)

            for entry in ndvi_raw:
                val = float(entry['data'][0])
                if val > -3000:
                    ndvi_list.append(val * 0.0001)
            
            # Removed arbitrary long sleeps. The session handles rate limiting elegantly.

        avg_lst = sum(lst_list) / len(lst_list) if lst_list else None
        avg_ndvi = sum(ndvi_list) / len(ndvi_list) if ndvi_list else None

        state_results[year] = {
            "avg_lst_celsius": round(avg_lst, 2) if avg_lst is not None else None,
            "avg_ndvi": round(avg_ndvi, 4) if avg_ndvi is not None else None
        }
        
    print(f"Finished FIPS {fips}")
    return fips, state_results

def process_state_data():
    final_data = {year: {} for year in YEARS}

    # Using a ThreadPool to process multiple states concurrently. 
    # Max workers set to 6 to stay under NASA's API radar.
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        # Map the function to our state dictionary
        future_to_fips = {executor.submit(process_single_state, item): item[0] for item in STATE_CENTROIDS.items()}
        
        for future in concurrent.futures.as_completed(future_to_fips):
            fips, state_results = future.result()
            # Distribute the results back out to our yearly dictionary structure
            for year in YEARS:
                final_data[year][fips] = state_results[year]

    print("\nSaving files...")
    for year in YEARS:
        filename = f"modis_data_{year}.json"
        with open(filename, 'w') as f:
            json.dump(final_data[year], f, indent=2)
        print(f"Saved {filename}")

if __name__ == "__main__":
    start_time = time.time()
    process_state_data()
    print(f"Total time: {time.time() - start_time:.2f} seconds")