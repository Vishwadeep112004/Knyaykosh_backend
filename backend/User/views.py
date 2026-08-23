from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User, Chats
from .serializers import UserSerializer, ChatsSerializer

@api_view(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
def userApi(req, pk=None):
    if req.method == "GET":
        if pk:
            user = User.objects.get(id=pk)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    if req.method == "POST":
        serializer = UserSerializer(data=req.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if req.method == "PUT":
        user = User.objects.get(id=pk)
        serializer = UserSerializer(user, data=req.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if req.method == "PATCH":
        user = User.objects.get(id=pk)
        serializer = UserSerializer(user, data=req.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if req.method == "DELETE":
        user = User.objects.get(id=pk)
        user.delete()
        return Response({"message": "User deleted successfully"})

@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
def chatApi(req, user_id, pk=None):
    if req.method == "GET":
        if pk:
            chat = Chats.objects.get(id=pk, user_id=user_id)
            serializer = ChatsSerializer(chat)
            return Response(serializer.data)
        chats = Chats.objects.filter(user_id=user_id)
        serializer = ChatsSerializer(chats, many=True)
        return Response(serializer.data)

    if req.method == "POST":
        user = User.objects.get(id=user_id)
        data = req.data.copy()
        data["user"] = user.id
        serializer = ChatsSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if req.method=="PATCH":
        chat=Chats.objects.get(id=pk,user_id=user_id)
        conversation_id=req.data.get("conversation_id")
        query=req.data.get("query")
        answer=req.data.get("answer")
        if conversation_id is None:
            return Response({"error":"conversation_id is required"},status=400)
        if conversation_id<0 or conversation_id>=len(chat.chats):
            return Response({"error":"Invalid conversation_id"},status=400)
        chat.chats[conversation_id].append([query,answer])
        chat.save()
        serializer=ChatsSerializer(chat)
        return Response(serializer.data)    

    if req.method == "DELETE":
        chat = Chats.objects.get(id=pk, user_id=user_id)
        chat.delete()
        return Response({"message": "Chat deleted successfully"})