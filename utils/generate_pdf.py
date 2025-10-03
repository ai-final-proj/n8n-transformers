from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os


def create_rules_pdf(filename="SQLQueryConstructionRulesForSelect.pdf", rules_file="rules/SQLQueryConstructionRulesForSelect.txt"):
    # === Read rules text from external file ===
    if not os.path.exists(rules_file):
        raise FileNotFoundError(f"Rules file not found: {rules_file}")

    with open(rules_file, "r", encoding="utf-8") as f:
        rules_text = f.read()

    c = canvas.Canvas(filename, pagesize=letter)

    # === Metadata ===
    c.setTitle("SQL Query Construction Rules (SELECT-only)")
    c.setAuthor("AI Scheduling System Project")
    c.setSubject("System Documentation for Database Structure")
    c.setKeywords(
        "SQL Query Construction Rules (SELECT-only), PostgreSQL, Single Statement, WITH, CTE, "
        "Multi-Item Packaging, jsonb_build_object, Explicit JOINs, Fully Qualified Names, public schema, "
        "Singular Table Names, Column Selection, No SELECT *, Aggregations and Grouping, UNION Compatibility, "
        "Filtering and Type Safety, Injection Safety, Output Markers, Output Format, Performance Hints, "
        "Error Handling, Parameterization, Aliases, Read-only, No SELECT INTO"
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
    c.drawString(left_margin, y, "SQL Query Construction Rules (SELECT-only)")
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
