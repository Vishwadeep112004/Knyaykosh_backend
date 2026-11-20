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
