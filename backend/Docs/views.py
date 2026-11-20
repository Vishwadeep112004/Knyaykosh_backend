import os
import re
import shutil
import logging
import hashlib
import tempfile
import pickle
import uuid
import requests
import faiss
import numpy as np
from dotenv import load_dotenv

import cloudinary
import cloudinary.uploader
import cloudinary.utils

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

from .models import Document, LegalCategory, KnowledgeBaseStatus
from .serializers import (
    DocumentSerializer,
    LegalCategorySerializer,
    KnowledgeBaseStatusSerializer
)

logger = logging.getLogger(__name__)
# Suppress benign low-level PDF parsing warnings (font encoding, startxref pointer)
logging.getLogger("pypdf").setLevel(logging.ERROR)

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

MODEL_NAME = "all-MiniLM-L6-v2"
_model = None


def get_sentence_transformer():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def generate_embeddings(chunks, batch_size=64):
    if not chunks:
        raise ValueError("No chunks available to embed.")
    model = get_sentence_transformer()
    texts = [chunk.page_content for chunk in chunks]
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True
    )
    return np.asarray(embeddings, dtype=np.float32)


def fetch_document_pdf_bytes(document, local_hash_cache=None):
    """
    Downloads or retrieves raw PDF bytes for a Document instance.
    Checks in sequence:
    1. Signed Cloudinary URL via cloudinary.utils.private_download_url.
    2. Direct Cloudinary URL via document.cloudinary_url.
    3. Local directory fallback (rag/data/) via:
       a) document.file_hash (cached SHA256 of files in rag/data/)
       b) Basename or stripped basename from cloudinary_public_id / cloudinary_url
       c) document.name variants (.pdf, _, -).
    """
    # 1. Signed Cloudinary download
    if document.cloudinary_public_id:
        for fmt in ["pdf", ""]:
            try:
                signed_url = cloudinary.utils.private_download_url(
                    document.cloudinary_public_id,
                    fmt,
                    resource_type="raw",
                    type="upload"
                )
                resp = requests.get(signed_url, timeout=30)
                if resp.status_code == 200 and resp.content:
                    logger.info("Successfully fetched '%s' (ID %s) via signed Cloudinary URL.", document.name, document.id)
                    return resp.content
                logger.debug(
                    "Signed Cloudinary URL returned HTTP %s for '%s' (fmt=%r)",
                    resp.status_code, document.name, fmt
                )
            except Exception as e:
                logger.debug("Signed Cloudinary download error for '%s' (fmt=%r): %s", document.name, fmt, e)

    # 2. Direct Cloudinary URL
    if document.cloudinary_url:
        try:
            resp = requests.get(document.cloudinary_url, timeout=30)
            if resp.status_code == 200 and resp.content:
                logger.info("Successfully fetched '%s' (ID %s) via direct Cloudinary URL.", document.name, document.id)
                return resp.content
            logger.debug("Direct Cloudinary URL returned HTTP %s for '%s'", resp.status_code, document.name)
        except Exception as e:
            logger.debug("Direct Cloudinary download error for '%s': %s", document.name, e)

    # 3. Local filesystem fallback
    data_dir = os.path.join(settings.BASE_DIR, "rag", "data")
    if os.path.isdir(data_dir):
        # 3a. Match by file_hash
        if document.file_hash and local_hash_cache and document.file_hash in local_hash_cache:
            local_path = local_hash_cache[document.file_hash]
            if os.path.isfile(local_path):
                try:
                    with open(local_path, "rb") as f:
                        logger.info(
                            "Retrieved '%s' (ID %s) from local data matching file_hash: %s",
                            document.name, document.id, os.path.basename(local_path)
                        )
                        return f.read()
                except Exception as e:
                    logger.warning("Failed to read local file %s for '%s': %s", local_path, document.name, e)

        # 3b. Match by candidate filenames
        candidate_filenames = []
        if document.cloudinary_public_id:
            raw_fname = document.cloudinary_public_id.split("/")[-1]
            candidate_filenames.append(raw_fname)
            candidate_filenames.append(re.sub(r"^nyaykosh_[a-f0-9]+_", "", raw_fname))

        if document.cloudinary_url:
            raw_url_fname = document.cloudinary_url.split("/")[-1]
            candidate_filenames.append(raw_url_fname)
            candidate_filenames.append(re.sub(r"^nyaykosh_[a-f0-9]+_", "", raw_url_fname))

        candidate_filenames.extend([
            document.name,
            f"{document.name}.pdf",
            document.name.replace(" ", "_"),
            f"{document.name.replace(' ', '_')}.pdf",
            document.name.replace(" ", "-"),
            f"{document.name.replace(' ', '-')}.pdf"
        ])

        for fname in candidate_filenames:
            candidate_path = os.path.join(data_dir, fname)
            if os.path.isfile(candidate_path):
                try:
                    with open(candidate_path, "rb") as f:
                        logger.info(
                            "Retrieved '%s' (ID %s) from local data matching filename: %s",
                            document.name, document.id, fname
                        )
                        return f.read()
                except Exception as e:
                    logger.warning("Failed to read candidate local file %s for '%s': %s", candidate_path, document.name, e)

    logger.error("Could not retrieve PDF content for document '%s' (ID %s) from Cloudinary or local files.", document.name, document.id)
    return None


# ==============================================================================
# Document Management Endpoints
# ==============================================================================

@api_view(["GET"])
@permission_classes([IsAdminUser])
def list_documents(request):
    documents = Document.objects.all().prefetch_related("categories")

    # Search by document name or category name
    search = request.query_params.get("search", "").strip()
    if search:
        documents = documents.filter(name__icontains=search)

    # Filter by category
    category_id = request.query_params.get("category")
    if category_id:
        documents = documents.filter(categories__id=category_id)

    # Filter by document type
    doc_type = request.query_params.get("document_type")
    if doc_type:
        documents = documents.filter(document_type=doc_type.upper())

    # Filter by processing status
    proc_status = request.query_params.get("processing_status")
    if proc_status:
        documents = documents.filter(processing_status=proc_status.upper())

    # Filter by active status
    is_active = request.query_params.get("is_active")
    if is_active is not None:
        if is_active.lower() in ["true", "false"]:
            documents = documents.filter(is_active=(is_active.lower() == "true"))

    documents = documents.distinct().order_by("-uploaded_at")
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def upload_document(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response(
            {"error": "A PDF file is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate file format by extension
    if not uploaded_file.name.lower().endswith(".pdf"):
        return Response(
            {"error": "Only PDF files are supported."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate file size
    if uploaded_file.size == 0:
        return Response(
            {"error": "The uploaded PDF file is empty (0 bytes)."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate PDF magic header signature (%PDF-)
    uploaded_file.seek(0)
    pdf_header = uploaded_file.read(5)
    if pdf_header != b"%PDF-":
        return Response(
            {
                "error": "The uploaded file is not a valid PDF document (missing '%PDF-' header signature)."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Calculate SHA256 file hash to prevent duplicate uploads
    uploaded_file.seek(0)
    hasher = hashlib.sha256()
    for chunk in uploaded_file.chunks():
        hasher.update(chunk)
    file_hash = hasher.hexdigest()

    if Document.objects.filter(file_hash=file_hash).exists():
        existing_doc = Document.objects.filter(file_hash=file_hash).first()
        return Response(
            {
                "error": f"This document has already been uploaded as '{existing_doc.name}'."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Document Name & Metadata
    name = request.data.get("name", "").strip()
    if not name:
        name = os.path.splitext(uploaded_file.name)[0].replace("_", " ").replace("-", " ")

    document_type = request.data.get("document_type", "ACT").upper()
    if document_type not in dict(Document.DOCUMENT_TYPES):
        document_type = "ACT"

    published_at = request.data.get("published_at")
    if not published_at:
        published_at = None

    # Upload to Cloudinary with verification
    uploaded_file.seek(0)
    try:
        sanitized_filename = os.path.splitext(uploaded_file.name)[0][:30].replace(" ", "_")
        sanitized_filename = re.sub(r'[^\w-]', '', sanitized_filename) or "doc"
        public_id = f"nyaykosh_{uuid.uuid4().hex[:8]}_{sanitized_filename}.pdf"

        upload_result = cloudinary.uploader.upload(
            uploaded_file,
            resource_type="raw",
            folder="nyaykosh_docs",
            public_id=public_id
        )

        cloudinary_url = upload_result.get("secure_url") or upload_result.get("url")
        cloudinary_public_id = upload_result.get("public_id")
        uploaded_bytes = upload_result.get("bytes", 0)

        if not cloudinary_url or not cloudinary_public_id:
            raise ValueError("Cloudinary response missing URL or public ID.")

        if uploaded_bytes == 0:
            if cloudinary_public_id:
                try:
                    cloudinary.uploader.destroy(cloudinary_public_id, resource_type="raw")
                except Exception:
                    pass
            raise ValueError("Cloud storage recorded an empty file (0 bytes).")

    except Exception as e:
        logger.error("Failed uploading document '%s' to Cloudinary: %s", name, e, exc_info=True)
        return Response(
            {
                "error": "Failed to upload document to cloud storage.",
                "details": str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Save local copy for offline cache and high-speed indexing
    try:
        local_dir = os.path.join(settings.BASE_DIR, "rag", "data")
        os.makedirs(local_dir, exist_ok=True)
        local_cache_path = os.path.join(local_dir, f"{sanitized_filename}.pdf")
        if not os.path.exists(local_cache_path):
            uploaded_file.seek(0)
            with open(local_cache_path, "wb") as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)
    except Exception as save_err:
        logger.warning("Could not cache PDF locally: %s", save_err)

    # Create Document record
    with transaction.atomic():
        document = Document.objects.create(
            name=name,
            document_type=document_type,
            published_at=published_at,
            cloudinary_url=cloudinary_url,
            cloudinary_public_id=cloudinary_public_id,
            file_hash=file_hash,
            processing_status="PENDING",
            is_active=True
        )

        # Attach categories if provided
        categories = request.data.getlist("categories") or request.data.get("categories")
        if categories:
            if isinstance(categories, str):
                cat_ids = [c.strip() for c in categories.split(",") if c.strip().isdigit()]
            elif isinstance(categories, list):
                cat_ids = [int(c) for c in categories if str(c).isdigit()]
            else:
                cat_ids = []

            if cat_ids:
                document.categories.set(cat_ids)

        # Mark knowledge base as needing regeneration
        KnowledgeBaseStatus.mark_pending()

    return Response(
        {
            "message": f"Document '{document.name}' uploaded successfully. Embedding regeneration is required to activate it in the AI knowledge base.",
            "document": DocumentSerializer(document).data
        },
        status=status.HTTP_201_CREATED
    )


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_document(request, document_id):
    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    doc_name = document.name
    public_id = document.cloudinary_public_id

    # 1. Attempt Cloudinary deletion
    try:
        if public_id:
            cloudinary.uploader.destroy(public_id, resource_type="raw")
    except Exception as e:
        # Continue with DB deletion even if cloud delete logs warning
        pass

    # 2. Delete database record & mark status pending
    with transaction.atomic():
        document.delete()
        KnowledgeBaseStatus.mark_pending()

    return Response(
        {
            "message": f"Document '{doc_name}' deleted successfully. Embedding regeneration is required to update the vector index."
        },
        status=status.HTTP_200_OK
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def view_document_pdf(request, document_id):
    """
    Serves the PDF for browser viewing.
    Verifies document existence, fetches binary content from Cloudinary
    (with local cache fallback), verifies %PDF- signature, and returns
    an inline application/pdf response suitable for Chrome's PDF viewer.
    """
    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Optional redirect parameter
    if request.query_params.get("redirect") == "true" and document.cloudinary_public_id:
        try:
            signed_url = cloudinary.utils.private_download_url(
                document.cloudinary_public_id,
                "",
                resource_type="raw",
                type="upload",
                attachment=False
            )
            return HttpResponseRedirect(signed_url)
        except Exception as e:
            logger.warning("Cloudinary redirect URL generation failed: %s", e)

    # Fetch PDF bytes (Cloudinary signed private download with local cache fallback)
    pdf_bytes = fetch_document_pdf_bytes(document)
    if not pdf_bytes:
        return Response(
            {
                "error": f"Could not retrieve PDF for document '{document.name}'. File may be missing or inaccessible."
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # Validate PDF signature
    if not pdf_bytes.startswith(b"%PDF-"):
        return Response(
            {
                "error": f"Document '{document.name}' is corrupted or not a valid PDF (missing '%PDF-' header)."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    safe_name = re.sub(r'[^\w\s-]', '', document.name).strip().replace(" ", "_") or f"document_{document.id}"
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{safe_name}.pdf"'
    response["Content-Length"] = len(pdf_bytes)
    response["Cache-Control"] = "private, max-age=3600"
    return response


# ==============================================================================
# Knowledge Base & Embedding Generation Endpoints
# ==============================================================================

@api_view(["GET"])
@permission_classes([IsAdminUser])
def knowledge_base_status(request):
    kb = KnowledgeBaseStatus.get_instance()

    # Automatically check if there are pending or unindexed documents
    active_count = Document.objects.filter(is_active=True).count()
    has_pending = Document.objects.filter(is_active=True, processing_status="PENDING").exists()
    has_ready = Document.objects.filter(is_active=True, processing_status="READY").exists()
    has_failed = Document.objects.filter(is_active=True, processing_status="FAILED").exists()

    if kb.status != "GENERATING":
        if active_count == 0:
            kb.status = "PENDING_REGENERATION"
        elif has_pending:
            kb.status = "PENDING_REGENERATION"
        elif has_ready and kb.last_generated_at and kb.total_embeddings > 0:
            kb.status = "UP_TO_DATE"
        elif has_failed and kb.total_embeddings == 0:
            kb.status = "FAILED"
        kb.save(update_fields=["status", "updated_at"])

    serializer = KnowledgeBaseStatusSerializer(kb)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def generate_embeddings_api(request):
    documents = list(Document.objects.filter(is_active=True).order_by("id"))

    if not documents:
        return Response(
            {"error": "No active documents found to generate embeddings for."},
            status=status.HTTP_400_BAD_REQUEST
        )

    logger.info("Initiating embedding generation for %d active documents.", len(documents))

    all_chunks = []
    temp_files = []
    backup_files = []
    successful_documents = []
    failed_documents = []
    skipped_documents = []

    vector_dir = os.path.join(settings.BASE_DIR, "rag", "data", "vector_db")
    os.makedirs(vector_dir, exist_ok=True)

    temp_id = uuid.uuid4().hex
    temp_index_path = os.path.join(vector_dir, f"legal_{temp_id}.index")
    temp_chunks_path = os.path.join(vector_dir, f"chunks_{temp_id}.pkl")
    final_index_path = os.path.join(vector_dir, "legal.index")
    final_chunks_path = os.path.join(vector_dir, "chunks.pkl")

    try:
        KnowledgeBaseStatus.mark_generating()

        document_ids = [doc.id for doc in documents]
        Document.objects.filter(id__in=document_ids).update(processing_status="PROCESSING")

        # Pre-cache local file hashes for fast and reliable lookup
        data_dir = os.path.join(settings.BASE_DIR, "rag", "data")
        local_hash_cache = {}
        if os.path.isdir(data_dir):
            for fname in os.listdir(data_dir):
                if fname.lower().endswith(".pdf"):
                    p = os.path.join(data_dir, fname)
                    try:
                        with open(p, "rb") as f:
                            local_hash_cache[hashlib.sha256(f.read()).hexdigest()] = p
                    except Exception as e:
                        logger.warning("Could not read local file %s for hash cache: %s", p, e)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            add_start_index=True
        )

        # Step 1: Download PDFs & extract text & chunk per document independently
        for i, document in enumerate(documents):
            step = "fetching_pdf"
            temp_pdf_path = None
            try:
                logger.info("[%d/%d] Fetching PDF for '%s' (ID %s)...", i + 1, len(documents), document.name, document.id)
                pdf_bytes = fetch_document_pdf_bytes(document, local_hash_cache=local_hash_cache)
                if not pdf_bytes:
                    raise ValueError(f"Could not download or locate PDF content for document: '{document.name}'")

                step = "parsing_pdf"
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
                    temp_pdf.write(pdf_bytes)
                    temp_pdf_path = temp_pdf.name
                    temp_files.append(temp_pdf_path)

                try:
                    loader = PyPDFLoader(temp_pdf_path)
                    pages = loader.load()
                except Exception as parse_err:
                    raise ValueError(f"Corrupted or invalid PDF structure: {str(parse_err)}")

                step = "text_extraction"
                text_pages = [page for page in pages if page.page_content and page.page_content.strip()]
                if not text_pages:
                    err_msg = "Scanned PDF or image-only document with no extractable text layer."
                    document.processing_status = "FAILED"
                    document.error_message = err_msg
                    document.save(update_fields=["processing_status", "error_message"])
                    logger.warning(
                        "Document ID %s ('%s') has no extractable text (scanned PDF); skipping embedding generation.",
                        document.id, document.name
                    )
                    skipped_documents.append({
                        "id": document.id,
                        "name": document.name,
                        "reason": err_msg
                    })
                    failed_documents.append({
                        "id": document.id,
                        "name": document.name,
                        "stage": step,
                        "error": err_msg
                    })
                    continue

                step = "chunking"
                # Enrich metadata for RAG citation compatibility
                for page in text_pages:
                    page.metadata["document_id"] = document.id
                    page.metadata["document_name"] = document.name
                    page.metadata["source"] = f"{document.name}.pdf" if not document.name.endswith(".pdf") else document.name
                    if "page" in page.metadata:
                        page.metadata["page"] = int(page.metadata["page"]) + 1

                doc_chunks = splitter.split_documents(text_pages)
                if not doc_chunks:
                    err_msg = "Chunk splitter produced zero segments for document."
                    document.processing_status = "FAILED"
                    document.error_message = err_msg
                    document.save(update_fields=["processing_status", "error_message"])
                    logger.warning("Document ID %s ('%s') produced zero chunks; skipping.", document.id, document.name)
                    failed_documents.append({
                        "id": document.id,
                        "name": document.name,
                        "stage": step,
                        "error": err_msg
                    })
                    continue

                # Document processed successfully
                document.total_chunks = len(doc_chunks)
                document.processing_status = "READY"
                document.error_message = ""
                document.save(update_fields=["total_chunks", "processing_status", "error_message"])

                all_chunks.extend(doc_chunks)
                successful_documents.append({
                    "id": document.id,
                    "name": document.name,
                    "chunks": len(doc_chunks)
                })
                logger.info(
                    "[%d/%d] Successfully processed '%s': %d text pages, %d chunks.",
                    i + 1, len(documents), document.name, len(text_pages), len(doc_chunks)
                )

            except Exception as doc_err:
                err_msg = str(doc_err)
                logger.error(
                    "Error processing document '%s' (ID %s) at stage '%s': %s",
                    document.name, document.id, step, err_msg, exc_info=True
                )
                document.processing_status = "FAILED"
                document.error_message = err_msg
                document.save(update_fields=["processing_status", "error_message"])
                failed_documents.append({
                    "id": document.id,
                    "name": document.name,
                    "stage": step,
                    "error": err_msg
                })

            finally:
                if temp_pdf_path and os.path.exists(temp_pdf_path):
                    try:
                        os.remove(temp_pdf_path)
                        if temp_pdf_path in temp_files:
                            temp_files.remove(temp_pdf_path)
                    except OSError:
                        pass

        if not all_chunks:
            error_details = (
                f"Failed to extract text chunks from all {len(documents)} document(s). "
                f"Failures: {failed_documents}"
            )
            raise ValueError(error_details)

        # Step 2: Generate dense embeddings
        logger.info("Generating embeddings for %d total chunks across %d documents...", len(all_chunks), len(successful_documents))
        embeddings = generate_embeddings(all_chunks)
        if len(embeddings) == 0:
            raise ValueError("Zero embeddings generated from extracted chunks.")

        # Step 3: Build FAISS index
        logger.info("Building FAISS index with dimension %d and %d vectors...", embeddings.shape[1], len(embeddings))
        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)

        # Step 4: Write temporary index and chunks files
        faiss.write_index(index, temp_index_path)
        temp_files.append(temp_index_path)

        with open(temp_chunks_path, "wb") as f:
            pickle.dump(all_chunks, f, protocol=pickle.HIGHEST_PROTOCOL)
        temp_files.append(temp_chunks_path)

        # Step 5: Backup existing index & chunks safely before replacement
        for path in [final_index_path, final_chunks_path]:
            if os.path.exists(path):
                backup_path = f"{path}.{temp_id}.bak"
                try:
                    shutil.copy2(path, backup_path)
                    backup_files.append((path, backup_path))
                except Exception as b_err:
                    logger.warning("Failed to create backup copy of %s: %s", path, b_err)

        # Step 6: Atomic swap into production directory
        try:
            os.replace(temp_index_path, final_index_path)
            if temp_index_path in temp_files:
                temp_files.remove(temp_index_path)

            os.replace(temp_chunks_path, final_chunks_path)
            if temp_chunks_path in temp_files:
                temp_files.remove(temp_chunks_path)

        except Exception as swap_err:
            logger.error("Failed during atomic swap of vector index: %s", swap_err)
            # Restore backups if swap failed
            for final_path, backup_path in backup_files:
                if os.path.exists(backup_path):
                    shutil.copy2(backup_path, final_path)
            raise

        # Clean backup files on success
        for _, backup_path in backup_files:
            if os.path.exists(backup_path):
                try:
                    os.remove(backup_path)
                except OSError:
                    pass
        backup_files.clear()

        # Step 7: Update KB status
        kb = KnowledgeBaseStatus.get_instance()
        kb.total_documents = len(successful_documents)
        kb.total_chunks = len(all_chunks)
        kb.total_embeddings = len(embeddings)
        kb.last_generated_at = timezone.now()
        kb.status = "UP_TO_DATE"

        if failed_documents:
            fail_msg = f"{len(failed_documents)} document(s) could not be extracted (scanned/empty)."
            kb.last_error = fail_msg
            logger.warning("Embedding generation completed with partial document skips: %s", fail_msg)
        else:
            kb.last_error = ""
            logger.info("Knowledge base successfully updated with %d documents and %d chunks.", len(successful_documents), len(all_chunks))

        kb.save()

        resp_data = {
            "message": "Knowledge base embeddings regenerated successfully." if not failed_documents else f"Knowledge base embeddings generated with {len(failed_documents)} failed document(s).",
            "total_documents": len(documents),
            "successful_documents_count": len(successful_documents),
            "failed_documents_count": len(failed_documents),
            "skipped_documents_count": len(skipped_documents),
            "successful_documents": successful_documents,
            "failed_documents": failed_documents,
            "skipped_documents": skipped_documents,
            "total_chunks": len(all_chunks),
            "total_embeddings": len(embeddings)
        }

        return Response(resp_data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error("Knowledge base embedding generation failed: %s", e, exc_info=True)

        Document.objects.filter(id__in=[doc.id for doc in documents], processing_status="PROCESSING").update(
            processing_status="FAILED",
            error_message=str(e)
        )
        KnowledgeBaseStatus.mark_failed(str(e))

        # Restore backups if generation failed
        for final_path, backup_path in backup_files:
            if os.path.exists(backup_path):
                try:
                    shutil.copy2(backup_path, final_path)
                except Exception as r_err:
                    logger.error("Failed restoring backup %s to %s: %s", backup_path, final_path, r_err)
                try:
                    os.remove(backup_path)
                except OSError:
                    pass
        backup_files.clear()

        return Response(
            {
                "error": "Knowledge base generation failed.",
                "details": str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    finally:
        for path in temp_files:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


# ==============================================================================
# Category Management Endpoints
# ==============================================================================

@api_view(["GET"])
@permission_classes([IsAdminUser])
def list_categories(request):
    categories = LegalCategory.objects.all().order_by("name")
    serializer = LegalCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def add_category(request):
    serializer = LegalCategorySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAdminUser])
def update_category(request, category_id):
    try:
        category = LegalCategory.objects.get(id=category_id)
    except LegalCategory.DoesNotExist:
        return Response(
            {"error": "Category not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = LegalCategorySerializer(
        category,
        data=request.data,
        partial=(request.method == "PATCH")
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_category(request, category_id):
    try:
        category = LegalCategory.objects.get(id=category_id)
    except LegalCategory.DoesNotExist:
        return Response(
            {"error": "Category not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    category.delete()
    return Response(
        {"message": "Category deleted successfully."},
        status=status.HTTP_200_OK
    )
