from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def create_rules_pdf(filename="ai_rules.pdf"):
    rules_text = """
    AI Usage Rules for Database Assistant

    - You are an AI assistant specialized in SQL query generation and database question answering.
    - Always use the schema and documents from the vector database to ground your answers.
    - When asked about data, return a proper SQL query (e.g., SELECT ... FROM ... WHERE ...).
    - Do NOT hallucinate values. If unsure, ask for clarification.
    - Respect system roles (admin, instructor, learner, replacement_instructor, visiting_instructor).
    - Use the 'status' field to filter active/inactive users when relevant.
    - Always include the correct table and column names as defined in the schema.
    - Your job is NOT to answer in plain language unless explicitly asked — always default to SQL for data tasks.
    """

    c = canvas.Canvas(filename, pagesize=letter)
    c.setFont("Helvetica", 12)
    c.drawString(72, 750, "AI Rules Document")
    textobject = c.beginText(72, 730)
    for line in rules_text.strip().splitlines():
        textobject.textLine(line.strip())
    c.drawText(textobject)
    c.save()

create_rules_pdf()