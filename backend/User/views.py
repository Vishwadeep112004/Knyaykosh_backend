from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, Chats
from .serializers import UserSerializer, UserRegisterSerializer, ChatsSerializer


@api_view(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def userApi(req, pk=None):
    if req.method == "POST":
        serializer = UserRegisterSerializer(data=req.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=201)
        return Response(serializer.errors, status=400)

    if req.method == "GET":
        if pk:
            try:
                user = User.objects.get(id=pk)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    if req.method == "PUT":
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        serializer = UserSerializer(user, data=req.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if req.method == "PATCH":
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        serializer = UserSerializer(user, data=req.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if req.method == "DELETE":
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        user.delete()
        return Response({"message": "User deleted successfully"}, status=200)


@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def chatApi(req, pk=None):
    if req.method == "GET":
        if pk:
            try:
                chat = Chats.objects.get(id=pk, user=req.user)
            except Chats.DoesNotExist:
                return Response({"error": "Chat not found"}, status=404)
            serializer = ChatsSerializer(chat)
            return Response(serializer.data)
        chats = Chats.objects.filter(user=req.user)
        serializer = ChatsSerializer(chats, many=True)
        return Response(serializer.data)

    if req.method == "POST":
        data = req.data.copy()
        data["user"] = req.user.id
        serializer = ChatsSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    if req.method == "PATCH":
        try:
            chat = Chats.objects.get(id=pk, user=req.user)
        except Chats.DoesNotExist:
            return Response({"error": "Chat not found"}, status=404)
        conversation_id = req.data.get("conversation_id")
        query = req.data.get("query")
        answer = req.data.get("answer")
        if conversation_id is None:
            return Response({"error": "conversation_id is required"}, status=400)
        if conversation_id < 0 or conversation_id >= len(chat.chats):
            return Response({"error": "Invalid conversation_id"}, status=400)
        chat.chats[conversation_id].append([query, answer])
        chat.save()
        serializer = ChatsSerializer(chat)
        return Response(serializer.data)

    if req.method == "DELETE":
        try:
            chat = Chats.objects.get(id=pk, user=req.user)
        except Chats.DoesNotExist:
            return Response({"error": "Chat not found"}, status=404)
        chat.delete()
        return Response({"message": "Chat deleted successfully"}, status=200)