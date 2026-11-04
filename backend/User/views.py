
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, Chats, Chat
from .serializers import UserSerializer, UserRegisterSerializer


def get_user_or_404(pk):
    try:
        return User.objects.get(id=pk), None
    except User.DoesNotExist:
        return None, Response({"error": "User not found"}, status=404)


def serialize_chat(chat):
    return {
        "id": chat.id,
        "title": chat.title,
        "convo": chat.convo,
        "summary": chat.summary,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at
    }

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(req):
    return Response(UserSerializer(req.user).data)

@api_view(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def userApi(req, pk=None):
    if req.method == "POST":
        serializer = UserRegisterSerializer(data=req.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=201)
        return Response(serializer.errors, status=400)
    if not req.user or not req.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)

    if not req.user.is_staff:
        if pk is None or pk != req.user.id:
            return Response({"error": "Forbidden"}, status=403)

    if req.method == "GET":
        if pk:
            user, err = get_user_or_404(pk)
            if err:
                return err
            return Response(UserSerializer(user).data)

        users = User.objects.all()
        return Response(UserSerializer(users, many=True).data)

    if req.method in ("PUT", "PATCH"):
        if pk is None:
            return Response({"error": "User id is required"}, status=400)

        user, err = get_user_or_404(pk)
        if err:
            return err

        serializer = UserSerializer(
            user,
            data=req.data,
            partial=(req.method == "PATCH")
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
        return Response({"message": "User deleted successfully"})


@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def chatApi(req, pk=None):

    # ---------- GET Chats ----------
    if req.method == "GET":
        if pk:
            try:
                chat = Chat.objects.get(
                    id=pk,
                    chats__user=req.user
                )
            except Chat.DoesNotExist:
                return Response(
                    {"error": "Chat not found"},
                    status=404
                )

            return Response(serialize_chat(chat))

        # Get all individual conversations of logged-in user
        chats = Chat.objects.filter(
            chats__user=req.user
        ).order_by("-updated_at")

        return Response([
            serialize_chat(chat) for chat in chats
        ])

    # ---------- CREATE New Chat ----------
    if req.method == "POST":
        title = req.data.get("title", "New Chat")

        if not isinstance(title, str) or not title.strip():
            return Response(
                {"error": "Invalid chat title"},
                status=400
            )

        with transaction.atomic():
            collection, created = Chats.objects.get_or_create(
                user=req.user
            )

            chat = Chat.objects.create(
                chats=collection,
                title=title.strip(),
                convo=[],
                summary=""
            )

        return Response(
            serialize_chat(chat),
            status=201
        )

    # ---------- UPDATE Conversation ----------
    if req.method == "PATCH":
        if pk is None:
            return Response(
                {"error": "Chat id is required"},
                status=400
            )

        with transaction.atomic():
            try:
                chat = Chat.objects.select_for_update().get(
                    id=pk,
                    chats__user=req.user
                )
            except Chat.DoesNotExist:
                return Response(
                    {"error": "Chat not found"},
                    status=404
                )

            query = req.data.get("query")
            answer = req.data.get("answer")
            summary = req.data.get("summary")
            title = req.data.get("title")

            # Save a question-answer pair
            if query is not None or answer is not None:
                if not isinstance(query, str) or not query.strip():
                    return Response(
                        {"error": "Valid query is required"},
                        status=400
                    )

                if not isinstance(answer, str) or not answer.strip():
                    return Response(
                        {"error": "Valid answer is required"},
                        status=400
                    )

                if not isinstance(chat.convo, list):
                    return Response(
                        {"error": "Invalid conversation data"},
                        status=400
                    )

                chat.convo.append({
                    "query": query.strip(),
                    "answer": answer.strip()
                })

                # Automatically generate initial title from first question
                if len(chat.convo) == 1 and chat.title == "New Chat":
                    chat.title = query.strip()[:60]

            # Update rolling summary
            if summary is not None:
                if not isinstance(summary, str):
                    return Response(
                        {"error": "Summary must be a string"},
                        status=400
                    )
                chat.summary = summary

            # Update title if provided
            if title is not None:
                if not isinstance(title, str) or not title.strip():
                    return Response(
                        {"error": "Invalid title"},
                        status=400
                    )
                chat.title = title.strip()

            chat.save()

        return Response(serialize_chat(chat))

    # ---------- DELETE Chat ----------
    if req.method == "DELETE":
        if pk is None:
            return Response(
                {"error": "Chat id is required"},
                status=400
            )

        try:
            chat = Chat.objects.get(
                id=pk,
                chats__user=req.user
            )
        except Chat.DoesNotExist:
            return Response(
                {"error": "Chat not found"},
                status=404
            )

        chat.delete()

        return Response({
            "message": "Chat deleted successfully"
        })
