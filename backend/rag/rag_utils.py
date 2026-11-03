import os
import pickle
import faiss
import numpy as np
from django.conf import settings
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"
model = SentenceTransformer(MODEL_NAME)

DATA_PATH = os.path.join(settings.BASE_DIR, "rag", "data")
DOCS_PATH = DATA_PATH  
VECTOR_DB_PATH = os.path.join(DATA_PATH, "vector_db")
INDEX_PATH = os.path.join(VECTOR_DB_PATH, "legal.index")
CHUNKS_PATH = os.path.join(VECTOR_DB_PATH, "chunks.pkl")
EMBEDDING_DIMENSION = model.get_embedding_dimension()

def extract():
    if not os.path.isdir(DOCS_PATH):
        raise FileNotFoundError(f"PDF directory not found: {DOCS_PATH}")
    loader = DirectoryLoader(
        DOCS_PATH,
        glob="*.pdf",
        loader_cls=PyPDFLoader,
        show_progress=True,
        use_multithreading=True,
        silent_errors=False
    )
    docs = loader.load()
    for doc in docs:
        doc.metadata["source"] = os.path.basename(
            doc.metadata.get("source", "Unknown")
        )
        if "page" in doc.metadata:
            doc.metadata["page"] = int(doc.metadata["page"]) + 1
    return [doc for doc in docs if doc.page_content.strip()]


def get_chunks(docs):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", " ", ""],
        add_start_index=True
    )
    return [
        chunk for chunk in splitter.split_documents(docs)
        if chunk.page_content.strip()
    ]

def generate_embeddings(chunks):
    if not chunks:
        raise ValueError("No chunks available to embed.")
    texts = [chunk.page_content for chunk in chunks]
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
        convert_to_numpy=True
    )
    embeddings = np.asarray(embeddings, dtype=np.float32)
    if embeddings.ndim != 2 or embeddings.shape[1] != EMBEDDING_DIMENSION:
        raise ValueError("Generated embeddings have an invalid dimension.")
    if not np.isfinite(embeddings).all():
        raise ValueError("Generated embeddings contain invalid values.")
    return embeddings

def build_faiss_index(embeddings):
    embeddings = np.asarray(embeddings, dtype=np.float32)
    if embeddings.ndim != 2 or embeddings.shape[0] == 0:
        raise ValueError("Embeddings must be a non-empty 2D array.")
    if embeddings.shape[1] != EMBEDDING_DIMENSION:
        raise ValueError("Embedding dimension does not match the model.")
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    return index

def save_vector_store(index, chunks):
    if index.ntotal != len(chunks):
        raise ValueError("FAISS index and chunks count do not match.")
    if index.d != EMBEDDING_DIMENSION:
        raise ValueError("FAISS index dimension does not match the model.")
    os.makedirs(VECTOR_DB_PATH, exist_ok=True)
    temp_index_path = INDEX_PATH + ".tmp"
    temp_chunks_path = CHUNKS_PATH + ".tmp"
    try:
        faiss.write_index(index, temp_index_path)
        with open(temp_chunks_path, "wb") as file:
            pickle.dump(chunks, file, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(temp_index_path, INDEX_PATH)
        os.replace(temp_chunks_path, CHUNKS_PATH)
    finally:
        for path in (temp_index_path, temp_chunks_path):
            if os.path.exists(path):
                os.remove(path)

def create_embeddings():
    docs = extract()
    if not docs:
        raise ValueError(f"No readable PDF pages found in {DOCS_PATH}")
    chunks = get_chunks(docs)
    if not chunks:
        raise ValueError("No chunks created from PDF documents.")
    embeddings = generate_embeddings(chunks)
    index = build_faiss_index(embeddings)
    save_vector_store(index, chunks)
    return {
        "message": "Embeddings created successfully",
        "documents": len({doc.metadata.get("source") for doc in docs}),
        "pages": len(docs),
        "chunks": len(chunks),
        "vectors": int(index.ntotal),
        "embedding_model": MODEL_NAME
    }

def load_index():
    if not os.path.isfile(INDEX_PATH) or not os.path.isfile(CHUNKS_PATH):
        raise FileNotFoundError(
            "Vector store files not found. Run create_embeddings() first."
        )
    index = faiss.read_index(INDEX_PATH)
    with open(CHUNKS_PATH, "rb") as file:
        chunks = pickle.load(file)
    if not isinstance(chunks, list):
        raise ValueError("chunks.pkl does not contain a valid chunk list.")
    if index.ntotal != len(chunks):
        raise ValueError(
            "FAISS index and chunks.pkl are inconsistent. Rebuild the index."
        )
    if index.d != EMBEDDING_DIMENSION:
        raise ValueError(
            "Embedding dimension mismatch. Rebuild using the configured model."
        )
    if index.ntotal and not chunks:
        raise ValueError("The vector index contains no corresponding chunks.")
    return index, chunks



def retrieve_chunks(query, index, chunks, k=5, threshold=0.50):
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Question cannot be empty.")
    if k < 1:
        raise ValueError("k must be at least 1.")
    if index.ntotal != len(chunks):
        raise ValueError("FAISS index and chunks count do not match.")
    if index.ntotal == 0:
        return []
    query_embedding = model.encode(
        [query.strip()],
        normalize_embeddings=True,
        convert_to_numpy=True
    )
    query_embedding = np.asarray(query_embedding, dtype=np.float32)
    scores, indices = index.search(query_embedding, min(k, index.ntotal))
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or float(score) < threshold:
            continue
        results.append({
            "score": float(score),
            "chunk": chunks[int(idx)]
        })
    return results



def remove_duplicate_chunks(results):
    unique_results = []
    seen = set()
    for result in results:
        chunk = result["chunk"]
        text = " ".join(chunk.page_content.split()).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        unique_results.append(result)
    return unique_results


def retrieve_relevant_chunks(query, index, chunks, k=5, threshold=0.40):
    if k < 1:
        raise ValueError("k must be at least 1.")
    if not -1.0 <= threshold <= 1.0:
        raise ValueError("threshold must be between -1 and 1.")
    if index.ntotal != len(chunks):
        raise ValueError("FAISS index and chunks count do not match.")
    if index.ntotal == 0:
        return []
    candidate_k = min(max(k * 5, 50), index.ntotal)
    results = retrieve_chunks(query, index, chunks, k=candidate_k)
    results = remove_duplicate_chunks(results)
    results = [item for item in results if item["score"] >= threshold]
    return results[:k]

def format_chunk_result(result):
    chunk = result["chunk"]
    return {
        "score": round(float(result["score"]), 4),
        "content": chunk.page_content,
        "source": os.path.basename(
            chunk.metadata.get("source", "Unknown")
        ),
        "page": chunk.metadata.get("page"),
        "start_index": chunk.metadata.get("start_index")
    }

def retrieve_for_dashboard(query, index, chunks, k=5, threshold=0.50):
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Question cannot be empty.")
    results = retrieve_relevant_chunks(
        query=query.strip(),
        index=index,
        chunks=chunks,
        k=k,
        threshold=threshold
    )
    results = remove_duplicate_chunks(results)
    return [
        {
            "score": item["score"],
            "content": item["chunk"].page_content,
            "source": item["chunk"].metadata.get("source", "Unknown"),
            "page": item["chunk"].metadata.get("page"),
            "start_index": item["chunk"].metadata.get("start_index", 0)
        }
        for item in results
    ]
