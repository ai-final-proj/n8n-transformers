import requests
import psycopg2
import json
from PyPDF2 import PdfReader
import uuid

# === 1. Read PDF text ===
pdf_path = "ai_rules.pdf"
reader = PdfReader(pdf_path)
rules_text = "\n".join(page.extract_text() for page in reader.pages)

# === 2. Get embedding from Ollama ===
ollama_url = "http://localhost:11434/api/embeddings"
payload = {
    "model": "nomic-embed-text:latest",
    "input": [rules_text]
}
res = requests.post(ollama_url, json=payload)
print("Ollama raw response:", res.text)
data = res.json()
print("Embedding API response:", data)

embedding = data.get("embedding")
if not embedding or len(embedding) == 0:
    raise RuntimeError("❌ Ollama returned empty embedding. Check your input text or Ollama model.")

# Convert embedding to pgvector format
vector_str = "[" + ",".join(str(x) for x in embedding) + "]"

# === 3. Insert into n8n_vectors ===
conn = psycopg2.connect(
    dbname="n8n_local_db",
    user="postgres",
    password="postgres",
    host="localhost",
    port=5432
)
cur = conn.cursor()

cur.execute("""
INSERT INTO n8n_vectors (id, text, metadata, embedding)
VALUES (%s, %s, %s, %s)
""", (
    str(uuid.uuid4()),
    rules_text,
    json.dumps({"type": "system_rules"}),
    vector_str
))

conn.commit()
cur.close()
conn.close()

print("✅ AI rules PDF uploaded into n8n_vectors table with embedding.")