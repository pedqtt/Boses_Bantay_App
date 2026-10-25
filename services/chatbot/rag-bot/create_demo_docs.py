"""Create fictional fixtures only; never use these as real barangay policies."""
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"
TITLE = "SYNTHETIC TEST DATA: Fictional Barangay Halimbawa. Not real policies."
SECTIONS = [
    ("Document assistance", "The fictional records desk accepts requests Monday to Friday, 9 AM to 4 PM. Residents bring one valid ID and complete Form H-01. A fictional clearance costs PHP 35 and takes two working days. Payment is made only after staff validates the application. A receipt is issued for every payment."),
    ("Community garden", "The fictional garden orientation takes place every first Saturday at 8 AM at the demonstration garden. Registration is free. Participants bring reusable gloves and a water bottle. Tool loans require signing a checkout sheet; tools must be returned before noon. The garden coordinator handles registration through the fictional community desk."),
    ("Waste collection", "In this fictional exercise, biodegradable waste is collected on Tuesdays at 7 AM. Recyclables are collected on Fridays at 7 AM. Residents separate glass, paper and plastics. Hazardous waste is not accepted in regular collection. For missed pickups, provide the street name and scheduled collection date to the fictional environment desk."),
    ("Study room", "The fictional study room opens Tuesday to Saturday from 10 AM to 6 PM. Entry is free. Bookings last two hours. A resident may reserve one slot per day at the library desk. Food is not permitted near computers. The room closes during announced maintenance. No internet speed or laptop lending policy is specified in this fixture."),
    ("Accessibility assistance", "The fictional assistance desk accepts accessibility requests in person during office hours. A resident may ask for an accessible interview space or help completing forms. Staff records the requested accommodation and provides a reference number. This fixture does not specify medical eligibility, cash benefits, or a hotline number."),
    ("Community feedback", "For the fictional feedback process, residents give the date, location and a short description of their concern. The community desk issues a tracking code and acknowledges receipt within three working days. The acknowledgement is not a resolution deadline. Residents keep the tracking code for follow-up. Do not include passwords or financial account details in the report."),
]


def create():
    DOCS.mkdir(exist_ok=True)
    txt = DOCS / "synthetic_resident_guide.txt"
    pdf = DOCS / "synthetic_facility_guide.pdf"
    if txt.exists() or pdf.exists():
        raise SystemExit("Demo files already exist; no files overwritten.")
    txt.write_text(TITLE + "\n\n" + "\n\n".join(title + "\n" + text for title, text in SECTIONS), encoding="utf-8")
    writer = PdfWriter()
    for lines in [
        ["SYNTHETIC TEST DATA - NOT REAL POLICIES", "Fictional Barangay Halimbawa: Facility Booking", "The fictional multipurpose hall is open daily from 8 AM to 5 PM.", "Submit Form H-02 at least five working days before an event.", "A fictional reservation deposit is PHP 200.", "The deposit is refundable if cancellation is at least 48 hours early."],
        ["SYNTHETIC TEST DATA - NOT REAL POLICIES", "Fictional Barangay Halimbawa: Hall Equipment", "An approved hall reservation includes 30 chairs and four tables.", "Sound equipment is not included.", "The organizer returns the hall clean and checks equipment with staff.", "Equipment damage is recorded on the handover form."],
    ]:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        commands = ["BT /F1 11 Tf 40 740 Td 20 TL"]
        for line in lines:
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            commands.append("(" + escaped + ") Tj T*")
        commands.append("ET")
        stream = DecodedStreamObject(); stream.set_data("\n".join(commands).encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    with pdf.open("wb") as target:
        writer.write(target)
    print("Created 2 synthetic fixtures: one TXT and one two-page PDF.")


if __name__ == "__main__":
    create()
