from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import User, Chats
from .serializers import UserSerializer, UserRegisterSerializer, ChatsSerializer


def get_user_or_404(pk):
    try:
        return User.objects.get(id=pk), None
    except User.DoesNotExist:
        return None, Response({"error": "User not found"}, status=404)


@api_view(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def userApi(req, pk=None):
    # ---------- Public: registration ----------
    if req.method == "POST":
        serializer = UserRegisterSerializer(data=req.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=201)
        return Response(serializer.errors, status=400)

    # ---------- Everything below requires login ----------
    # AllowAny still lets DRF parse the JWT, so req.user is populated
    # whenever a valid token is sent.
    if not req.user or not req.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)

    # Normal users can only access their own record. Staff can access any.
    if not req.user.is_staff:
        if pk is None or pk != req.user.id:
            return Response({"error": "Forbidden"}, status=403)

    if req.method == "GET":
        if pk:
            user, err = get_user_or_404(pk)
            if err:
                return err
            return Response(UserSerializer(user).data)
        # Only staff can reach this point without a pk
        users = User.objects.all()
        return Response(UserSerializer(users, many=True).data)

    if req.method in ("PUT", "PATCH"):
        if pk is None:
            return Response({"error": "User id is required"}, status=400)
        user, err = get_user_or_404(pk)
        if err:
            return err
        serializer = UserSerializer(
            user, data=req.data, partial=(req.method == "PATCH")
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if req.method == "DELETE":
        if pk is None:
            return Response({"error": "User id is required"}, status=400)
        user, err = get_user_or_404(pk)
        if err:
            return err
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
            return Response(ChatsSerializer(chat).data)
        chats = Chats.objects.filter(user=req.user)
        return Response(ChatsSerializer(chats, many=True).data)

    if req.method == "POST":
        data = req.data.copy()
        data["user"] = req.user.id  # always the logged-in user
        serializer = ChatsSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    if req.method == "PATCH":
        if pk is None:
            return Response({"error": "Chat id is required"}, status=400)
        try:
            chat = Chats.objects.get(id=pk, user=req.user)
        except Chats.DoesNotExist:
            return Response({"error": "Chat not found"}, status=404)

        try:
            conversation_id = int(req.data.get("conversation_id"))
        except (TypeError, ValueError):
            return Response(
                {"error": "conversation_id must be an integer"}, status=400
            )

        query = req.data.get("query")
        answer = req.data.get("answer")
        if not query or not answer:
            return Response(
                {"error": "query and answer are required"}, status=400
            )

        if conversation_id < 0 or conversation_id >= len(chat.chats):
            return Response({"error": "Invalid conversation_id"}, status=400)

        chat.chats[conversation_id].append([query, answer])
        chat.save()
        return Response(ChatsSerializer(chat).data)

    if req.method == "DELETE":
        if pk is None:
            return Response({"error": "Chat id is required"}, status=400)
        try:
            chat = Chats.objects.get(id=pk, user=req.user)
        except Chats.DoesNotExist:
            return Response({"error": "Chat not found"}, status=404)
        chat.delete()
        return Response({"message": "Chat deleted successfully"}, status=200)