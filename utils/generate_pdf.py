from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os


def create_rules_pdf(filename="Request_Normalizer_001.pdf", rules_file="rules/RequestNormalizer.txt"):
    # === Read rules text from external file ===
    if not os.path.exists(rules_file):
        raise FileNotFoundError(f"Rules file not found: {rules_file}")

    with open(rules_file, "r", encoding="utf-8") as f:
        rules_text = f.read()

    c = canvas.Canvas(filename, pagesize=letter)

    # === Metadata ===
    c.setTitle("Request Normalizer")
    c.setAuthor("AI Scheduling System Project")
    c.setSubject("System Documentation for Request Normalizer and Input Normalization Rules")
    c.setKeywords(
        "AI, Scheduling, PostgreSQL, Database, Normalization, "
        "Schema, Roles, Mapping, Cohort, Program, User, "
        "System Role, Subgroup, Schedule, Schedule Item, Period, "
        "Input Processing, Rules, Consistency, Workflow, Vector Store"
    )
    c.setCreator("ReportLab PDF Generator")

    # === Setup ===
    width, height = letter
    left_margin = 72  # 1 inch
    top_margin = height - 72
    bottom_margin = 72
    line_height = 14

    c.setFont("Helvetica", 12)
    y = top_margin
    c.drawString(left_margin, y, "Request Normalizer")
    y -= 2 * line_height  # leave space below header

    # === Draw text line by line with pagination ===
    for line in rules_text.strip().splitlines():
        if y <= bottom_margin:  # new page
            c.showPage()
            c.setFont("Helvetica", 12)
            y = top_margin
        c.drawString(left_margin, y, line.rstrip())  # rstrip keeps alignment nice
        y -= line_height

    c.save()


# Example usage:
create_rules_pdf()