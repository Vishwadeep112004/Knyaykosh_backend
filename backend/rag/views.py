import os
import re
import fitz
import faiss
import pickle
import requests
from django.conf import settings
from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from sentence_transformers import SentenceTransformer
from User.models import User,Chats

DATA_PATH=os.path.join(settings.BASE_DIR,"rag","data")
INDEX_PATH=os.path.join(DATA_PATH,"vector_db","legal.index")
CHUNKS_PATH=os.path.join(DATA_PATH,"vector_db","chunks.pkl")
OLLAMA_URL="http://localhost:11434/api/chat"
OLLAMA_MODEL="llama3.2:3b"
model=SentenceTransformer("all-MiniLM-L6-v2")

def get_chunks(text):
    chunks=[]
    pattern=r'(?m)^\s*(\d+[A-Z]?)\.\s+(.+?)(?=\n|$)'
    matches=list(re.finditer(pattern,text))
    if not matches:
        paragraphs=re.split(r'\n\s*\n',text)
        current_chunk=""
        for paragraph in paragraphs:
            paragraph=paragraph.strip()
            if not paragraph:
                continue
            if len(current_chunk)+len(paragraph)<=6000:
                current_chunk+="\n\n"+paragraph
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk=paragraph
        if current_chunk:
            chunks.append(current_chunk.strip())
        return chunks
    for i,match in enumerate(matches):
        start=match.start()
        end=matches[i+1].start() if i+1<len(matches) else len(text)
        section=text[start:end].strip()
        if not section:
            continue
        if len(section)<=6000:
            chunks.append(section)
        else:
            parts=re.split(r'(?=\n\s*\(\d+\))',section)
            current_chunk=""
            for part in parts:
                part=part.strip()
                if not part:
                    continue
                if len(current_chunk)+len(part)<=6000:
                    current_chunk+="\n\n"+part
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk=part
            if current_chunk:
                chunks.append(current_chunk.strip())
    return chunks

def create_embeddings():
    all_chunks=[]
    for file_name in os.listdir(DATA_PATH):
        if not file_name.lower().endswith(".pdf"):
            continue
        pdf_path=os.path.join(DATA_PATH,file_name)
        doc=fitz.open(pdf_path)
        text=""
        for page in doc:
            text+=page.get_text()+"\n"
        doc.close()
        chunks=get_chunks(text)
        for chunk in chunks:
            all_chunks.append({"text":chunk,"source":file_name})
    if not all_chunks:
        return 0
    texts=[chunk["text"] for chunk in all_chunks]
    embeddings=model.encode(texts,normalize_embeddings=True)
    dim=embeddings.shape[1]
    index=faiss.IndexFlatIP(dim)
    index.add(embeddings)
    os.makedirs(os.path.dirname(INDEX_PATH),exist_ok=True)
    faiss.write_index(index,INDEX_PATH)
    with open(CHUNKS_PATH,"wb") as f:
        pickle.dump(all_chunks,f)
    return len(all_chunks)

def load_index():
    if os.path.exists(INDEX_PATH):
        index=faiss.read_index(INDEX_PATH)
    else:
        index=None
    if os.path.exists(CHUNKS_PATH):
        with open(CHUNKS_PATH,"rb") as f:
            chunks=pickle.load(f)
    else:
        chunks=[]
    return index,chunks

def generate_answer(prompt):
    response=requests.post(
        OLLAMA_URL,
        json={
            "model":OLLAMA_MODEL,
            "messages":[
                {
                    "role":"system",
                    "content":"You are NyayKosh, an Indian legal information assistant. Answer clearly using only the legal context provided by the user. Do not invent laws, facts, sections, or citations. If the context is insufficient, explicitly say so. Explain the relevant legal provisions in simple language and elaborate when the context supports it. Do not present your response as a substitute for advice from a qualified lawyer."
                },
                {
                    "role":"user",
                    "content":prompt
                }
            ],
            "stream":False
        },
        timeout=180
    )
    response.raise_for_status()
    answer=response.json().get("message",{}).get("content","").strip()
    if not answer:
        raise ValueError("Ollama returned an empty answer")
    return answer


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ask_question(request):
    query=request.data.get("question")
    chat_id=request.data.get("chat_id")
    conversation_id=request.data.get("conversation_id")
    if not query or not isinstance(query,str) or not query.strip():
        return Response({"error":"Question is required"},status=400)
    query=query.strip()
    if chat_id is None:
        return Response({"error":"chat_id is required"},status=400)
    if conversation_id is None:
        return Response({"error":"conversation_id is required"},status=400)
    try:
        chat=Chats.objects.get(id=chat_id,user=request.user)
    except Chats.DoesNotExist:
        return Response({"error":"Chat not found"},status=404)
    if not isinstance(conversation_id,int) or isinstance(conversation_id,bool) or conversation_id<0 or conversation_id>=len(chat.chats):
        return Response({"error":"Invalid conversation_id"},status=400)
    index,chunks=load_index()
    if index is None or not chunks or index.ntotal==0:
        return Response({"error":"No legal documents have been indexed yet"},status=400)
    if index.ntotal!=len(chunks):
        return Response({"error":"FAISS index and chunks.pkl are inconsistent. Rebuild the index."},status=500)
    query_embedding=model.encode([query],normalize_embeddings=True)
    k=min(5,index.ntotal)
    similarities,indices=index.search(query_embedding,k)
    context_parts=[]
    sources=[]
    print(f"\n{'='*70}")
    print(f"RAG QUERY: {query}")
    for i in range(k):
        index_value=int(indices[0][i])
        if index_value<0 or index_value>=len(chunks):
            continue
        score=float(similarities[0][i])
        chunk=chunks[index_value]
        source=chunk.get("source","Unknown")
        text=chunk.get("text","")
        print(f"\nRESULT {i+1} | SCORE: {score:.4f}")
        print(f"SOURCE: {source}")
        print(f"TEXT: {text[:700]}")
        context_parts.append(f"Source: {source}\nLegal text:\n{text}")
        sources.append(source)
    print(f"\n{'='*70}")
    if not context_parts:
        return Response({"error":"No legal context was retrieved"},status=404)
    context="\n\n---\n\n".join(context_parts)
    prompt=f"""You are NyayKosh, an Indian legal information assistant.

Answer the user's question using the supplied legal documents.

Important rules:
1. First determine whether the supplied text directly addresses the user's legal problem.
2. Distinguish provisions directly relevant to the problem from provisions that are merely related to the same broad topic.
3. Do not claim that a provision grants compensation, establishes liability, or provides a remedy unless the supplied text supports that conclusion.
4. Do not recommend procedures intended for manufacturers, importers, or dealers to a farmer unless they genuinely apply to the user's situation.
5. Never invent laws, section numbers, deadlines, authorities, or legal remedies.
6. If the context is insufficient, explicitly explain what information is missing. Do not force an answer from unrelated provisions.
7. When possible, identify the relevant Act and section only if that information is explicitly supported by the context.
8. Give practical next steps that are supported by the context. Clearly label any general precaution as such.
9. Explain the answer in simple language. Do not guarantee compensation or a legal outcome.
10. Recommend consulting the appropriate authority or a qualified lawyer when the available documents cannot establish the remedy.

Retrieved legal documents:
{context}

User's question:
{query}

Provide:
- Whether the supplied context answers the question.
- The relevant legal provisions, if supported.
- Practical next steps.
- Any important limitations or missing information."""
    try:
        answer=generate_answer(prompt)
    except requests.exceptions.ConnectionError:
        return Response({"error":"Ollama is not running or cannot be reached. Please start the Ollama service and try again."},status=503)
    except requests.exceptions.Timeout:
        return Response({"error":"The AI model took too long to respond. Please try again."},status=504)
    except requests.exceptions.RequestException:
        return Response({"error":"Ollama could not generate an answer. Please try again."},status=502)
    except (ValueError,KeyError):
        return Response({"error":"Ollama returned an invalid response."},status=502)
    chat.chats[conversation_id].append([query,answer])
    chat.save()
    return Response({
        "question":query,
        "answer":answer,
        "sources":list(dict.fromkeys(sources))
    })
