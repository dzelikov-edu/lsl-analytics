from google.oauth2 import service_account
from googleapiclient.discovery import build

import json
import os
import time
import random
import socket
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_sheets_service(service_account_json_path: str):
    # Check if the raw JSON value is in environment variables (for Cloud/Render)
    json_value = os.getenv("GOOGLE_SERVICE_ACCOUNT_VALUE")
    
    if json_value:
        # Load credentials directly from the environment variable string
        info = json.loads(json_value)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=SCOPES
        )
    else:
        # Fallback to the local file path (for your Laptop)
        creds = service_account.Credentials.from_service_account_file(
            service_account_json_path, scopes=SCOPES
        )
        
    return build("sheets", "v4", credentials=creds)



def read_range(service, spreadsheet_id: str, a1_range: str, max_retries: int = 6):
    """
    Read a range with retry + exponential backoff for transient Google API errors (503/429/500)
    and transient network timeouts.
    """
    last_err = None

    for attempt in range(max_retries):
        try:
            resp = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=a1_range)
                .execute()
            )
            return resp.get("values", [])

        except HttpError as e:
            last_err = e
            status = getattr(e.resp, "status", None)

            # Retry only transient API errors
            if status in (429, 500, 503):
                sleep_s = min(2 ** attempt, 32) + random.random()
                time.sleep(sleep_s)
                continue
            raise

        except (TimeoutError, socket.timeout) as e:
            last_err = e
            # Retry transient network timeouts
            sleep_s = min(2 ** attempt, 32) + random.random()
            time.sleep(sleep_s)
            continue

    raise RuntimeError(
        f"Google Sheets read failed after {max_retries} retries: {spreadsheet_id} {a1_range} ({type(last_err).__name__}: {last_err})"
    )