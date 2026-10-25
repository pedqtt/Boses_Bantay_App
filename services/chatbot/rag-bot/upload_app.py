"""Small local upload UI. Core functions live in upload_documents.py."""
import streamlit as st
from ollama import Client
from supabase import create_client
import config
from ingest import IngestFailure
from upload_documents import preview_upload, ingest_upload

st.set_page_config(page_title="Chatbot document upload", page_icon="📄")
st.title("Chatbot document upload")
st.caption("Local administrator tool · PDF or UTF-8 TXT · Maximum 20 MB per file")
st.info("Upload previews do not change the chatbot records. Click Index document to save and index. Existing filenames cannot be replaced here yet.")
uploaded = st.file_uploader("Choose a document", type=["pdf", "txt"], max_upload_size=20)
if uploaded is not None:
    data = uploaded.getvalue()
    try:
        preview = preview_upload(uploaded.name, data)
    except IngestFailure as error:
        st.error(str(error))
    else:
        st.write(f"{preview.chunk_count} chunks ready for indexing")
        if preview.pages:
            st.caption("PDF pages with readable text: " + ", ".join(map(str, preview.pages)))
        with st.expander("Preview extracted text", expanded=True):
            st.text(preview.excerpt)
        if st.button("Index document", type="primary"):
            try:
                config.validate_supabase()
                database = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
                models = Client(host=config.OLLAMA_HOST, timeout=180)
                with st.spinner("Embedding and saving document..."):
                    count = ingest_upload(uploaded.name, data, database, models)
                st.success(f"Indexed {count} chunks from {uploaded.name}.")
            except (IngestFailure, ValueError) as error:
                st.error(str(error))
            except Exception:
                st.error("The upload could not complete. Check local configuration and service availability.")
st.caption("Run locally only. Authentication and public hosting are not configured.")
