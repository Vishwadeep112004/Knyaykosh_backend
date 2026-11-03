import csv
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    "Accept": "application/pdf,text/html,*/*",
})

def fetch_pdf(url):
    if not is_official_url(url):
        raise ValueError("URL is not from an allowed official domain")

    response = session.get(
        url,
        timeout=(15, 120),
        stream=True,
        allow_redirects=True,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "").lower()

    if "application/pdf" in content_type:
        content = response.content
        if content.startswith(b"%PDF-"):
            return content, response.url

    # If the response is HTML, inspect it for a PDF link.
    response.close()
    response = session.get(url, timeout=(15, 60))
    response.raise_for_status()

    if response.content.startswith(b"%PDF-"):
        return response.content, response.url

    soup = BeautifulSoup(response.text, "html.parser")

    for tag in soup.find_all(["a", "iframe", "embed"]):
        link = tag.get("href") or tag.get("src")
        if not link:
            continue

        candidate = urljoin(response.url, link)
        if not is_official_url(candidate):
            continue

        path = urlparse(candidate).path.lower()
        if ".pdf" not in path and "bitstream/" not in path:
            continue

        pdf_response = session.get(
            candidate,
            timeout=(15, 120),
            stream=True,
        )
        pdf_response.raise_for_status()
        content = pdf_response.content

        if content.startswith(b"%PDF-"):
            return content, pdf_response.url

    raise ValueError("No valid PDF found on the official page")


ALLOWED_HOSTS = {
    "indiacode.nic.in",
    "www.indiacode.nic.in",
    "lj.maharashtra.gov.in",
    "bombayhighcourt.gov.in",
}

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent
MANIFEST = SCRIPT_DIR / "acts.csv"
LOG_FILE = SCRIPT_DIR / "download_log.csv"

DATA_DIR.mkdir(parents=True, exist_ok=True)


def is_official_url(url):
    parsed = urlparse(url)
    return (
        parsed.scheme == "https"
        and (parsed.hostname or "").lower() in ALLOWED_HOSTS
    )


def download_act(filename, url):
    filename = Path(filename).name
    if not filename.lower().endswith(".pdf"):
        return "FAILED: Invalid PDF filename", "", url
    destination = DATA_DIR / filename
    if destination.exists() and destination.stat().st_size > 0:
        return "ALREADY_EXISTS", str(destination), url
    for attempt in range(3):
        try:
            content, source_url = fetch_pdf(url)
            if not content.startswith(b"%PDF-"):
                raise ValueError("Downloaded content is not a PDF")
            temporary = destination.with_suffix(".pdf.part")
            temporary.write_bytes(content)
            temporary.replace(destination)
            return "DOWNLOADED", str(destination), source_url
        except (requests.RequestException, ValueError) as error:
            if attempt == 2:
                return f"FAILED: {error}", "", url
            print(f"Retry {attempt + 1}/2 for {filename}: {error}")
            time.sleep(2 * (attempt + 1))


def main():
    print(f"Manifest: {MANIFEST}")
    print(f"PDF destination: {DATA_DIR}")
    if not MANIFEST.exists():
        print("ERROR: acts.csv not found")
        return
    results = []
    with MANIFEST.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            filename = (row.get("filename") or "").strip()
            url = (row.get("url") or "").strip()
            if not filename or not url:
                status, path, source = "SKIPPED: Missing data", "", url
            else:
                status, path, source = download_act(filename, url)
            print(f"{status}: {filename}")
            results.append({
                "filename": filename,
                "status": status,
                "saved_path": path,
                "source_url": source,
            })
            time.sleep(0.5)
    with LOG_FILE.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["filename", "status", "saved_path", "source_url"],
        )
        writer.writeheader()
        writer.writerows(results)
    print(f"\nReport saved: {LOG_FILE}")


if __name__ == "__main__":
    main()
