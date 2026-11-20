import requests
from pathlib import Path
from getpass import getpass
import re
import time

# ================= CONFIGURATION =================

BASE_URL = "http://127.0.0.1:8000"
UPLOAD_URL = f"{BASE_URL}/docs/documents/upload/"

PDF_FOLDER = Path.home() / "Desktop/NyayKosh/backend/rag/data"

# ===============================================

# Titles for recognizable documents
KNOWN_NAMES = {
    "BharatiyaNagarikSurakshaSanhita.pdf":
        "Bharatiya Nagarik Suraksha Sanhita",
    "BharatiyaSakshyaAdhiniyam.pdf":
        "Bharatiya Sakshya Adhiniyam",
    "bhartiyaNyaySanhita.pdf":
        "Bharatiya Nyaya Sanhita",
    "consititution.pdf":
        "Constitution of India",
    "ConsumerProtectionAct.pdf":
        "Consumer Protection Act, 2019",
    "Fert_Order_1985.pdf":
        "Fertiliser Control Order, 1985",
    "IndianContractAct.pdf":
        "Indian Contract Act, 1872",
    "InformationTechnologyAct.pdf":
        "Information Technology Act, 2000",
    "Motor Vehicles Act.pdf":
        "Motor Vehicles Act",
    "NyayKosh_Consumer_Protection_Guide_India.pdf":
        "NyayKosh Consumer Protection Guide India",
    "ProtectionofWomenfromDomesticViolenceAct.pdf":
        "Protection of Women from Domestic Violence Act",
    "RighttoInformation.pdf":
        "Right to Information Act",
}

def generate_document_name(filename):
    # Use known titles first
    if filename in KNOWN_NAMES:
        return KNOWN_NAMES[filename]

    # Pattern: A1985-61.pdf or a2019-29.pdf
    match = re.match(r"^[aA](\d{4})-(\d+)\.pdf$", filename)

    if match:
        year, act_number = match.groups()
        return f"Act No. {int(act_number)} of {year}"

    # Pattern: 2020-37.pdf or 2025-24.pdf
    match = re.match(r"^(\d{4})-(\d+)\.pdf$", filename)

    if match:
        year, act_number = match.groups()
        return f"Act No. {int(act_number)} of {year}"

    # Fallback: use filename without extension
    return Path(filename).stem.replace("_", " ").replace("-", " ").strip()


def upload_pdf(pdf_path, token):
    headers = {
        "Authorization": f"Bearer {token}"
    }

    document_name = generate_document_name(pdf_path.name)

    # Categories intentionally left empty.
    # Publication date omitted.
    data = {
        "name": document_name,
        "document_type": "ACT",
    }

    with open(pdf_path, "rb") as pdf_file:
        files = {
            "file": (
                pdf_path.name,
                pdf_file,
                "application/pdf"
            )
        }

        response = requests.post(
            UPLOAD_URL,
            headers=headers,
            data=data,
            files=files,
            timeout=300
        )

    return response


def main():
    if not PDF_FOLDER.exists():
        print(f"Folder does not exist: {PDF_FOLDER}")
        return

    # Only PDFs directly inside this folder.
    # Does not search downloader or vector_db subfolders.
    pdf_files = sorted(
        PDF_FOLDER.glob("*.pdf"),
        key=lambda p: p.name.lower()
    )

    if not pdf_files:
        print("No PDF files found.")
        return

    print(f"Found {len(pdf_files)} PDF files.")
    print(f"Upload endpoint: {UPLOAD_URL}")
    print()

    token = getpass("Enter admin access token: ").strip()

    if not token:
        print("Access token cannot be empty.")
        return

    successful = []
    duplicates = []
    failed = []

    for index, pdf_path in enumerate(pdf_files, start=1):
        document_name = generate_document_name(pdf_path.name)

        print("-" * 60)
        print(f"[{index}/{len(pdf_files)}] {pdf_path.name}")
        print(f"Document name: {document_name}")

        try:
            response = upload_pdf(pdf_path, token)

            if response.status_code == 201:
                successful.append(pdf_path.name)
                print("Upload successful!")

            elif response.status_code == 400:
                try:
                    error_message = response.json().get(
                        "error",
                        response.text
                    )
                except Exception:
                    error_message = response.text

                if "already been uploaded" in str(error_message).lower():
                    duplicates.append(pdf_path.name)
                    print(f"Duplicate - skipped: {error_message}")
                else:
                    failed.append(pdf_path.name)
                    print(f"Upload failed: {error_message}")

            elif response.status_code in [401, 403]:
                print("Authentication/permission error.")
                print("Check your admin access token.")
                print(response.text)

                failed.extend(
                    file.name for file in pdf_files[index - 1:]
                )
                break

            else:
                failed.append(pdf_path.name)
                print(f"HTTP Error: {response.status_code}")
                print(response.text)

        except requests.exceptions.Timeout:
            failed.append(pdf_path.name)
            print("Request timed out.")

        except requests.exceptions.ConnectionError:
            failed.append(pdf_path.name)
            print("Cannot connect to Django server.")

        except Exception as error:
            failed.append(pdf_path.name)
            print(f"Unexpected error: {error}")

        # Small delay between uploads
        time.sleep(0.5)

    # ================= FINAL REPORT =================

    print("\n")
    print("=" * 60)
    print("UPLOAD SUMMARY")
    print("=" * 60)

    print(f"Total PDFs found : {len(pdf_files)}")
    print(f"Uploaded        : {len(successful)}")
    print(f"Duplicates      : {len(duplicates)}")
    print(f"Failed          : {len(failed)}")

    if successful:
        print("\nSUCCESSFULLY UPLOADED:")
        for filename in successful:
            print(f"  ✓ {filename}")

    if duplicates:
        print("\nDUPLICATES SKIPPED:")
        for filename in duplicates:
            print(f"  - {filename}")

    if failed:
        print("\nFAILED FILES:")
        for filename in failed:
            print(f"  ✗ {filename}")

    print("\nUpload process completed.")


if __name__ == "__main__":
    main()
