import os
import re
import fitz
import faiss
import pickle
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from sentence_transformers import SentenceTransformer
from google import genai
from User.models import User,Chats


DATA_PATH=os.path.join(settings.BASE_DIR,"rag","data")
INDEX_PATH=os.path.join(DATA_PATH,"vector_db","legal.index")
CHUNKS_PATH=os.path.join(DATA_PATH,"vector_db","chunks.pkl")
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


@api_view(["POST"])
def ask_question(request):
    query=request.data.get("question")
    chat_id=request.data.get("chat_id")
    user_id=request.data.get("user_id")
    conversation_id=request.data.get("conversation_id")
    if not query:
        return Response({"error":"Question is required"},status=400)
    if chat_id is None:
        return Response({"error":"chat_id is required"},status=400)
    if user_id is None:
        return Response({"error":"user_id is required"},status=400)
    if conversation_id is None:
        return Response({"error":"conversation_id is required"},status=400)
    try:
        chat=Chats.objects.get(id=chat_id,user_id=user_id)
    except Chats.DoesNotExist:
        return Response({"error":"Chat not found"},status=404)
    if conversation_id<0 or conversation_id>=len(chat.chats):
        return Response({"error":"Invalid conversation_id"},status=400)
    index,chunks=load_index()
    if index is None or not chunks:
        return Response({"error":"No legal documents have been indexed yet"},status=400)
    query_embedding=model.encode([query],normalize_embeddings=True)
    k=min(5,index.ntotal)
    similarities,indices=index.search(query_embedding,k)
    context=""
    sources=[]
    for i in range(k):
        index_value=indices[0][i]
        if index_value<0:
            continue
        chunk=chunks[index_value]
        context+=chunk["text"]+"\n\n"
        sources.append(chunk["source"])
    prompt=f"""Answer the question using only the provided context.
Context:
{context}
Question:
{query}
If the context does not contain enough information, say so."""
    client=genai.Client(api_key="enter api key")
    response=client.models.generate_content(model="gemini-3.6-flash",contents=prompt)
    chat.chats[conversation_id].append([query,response.text])
    chat.save()
    return Response({"question":query,"answer":response.text,"sources":list(set(sources))})