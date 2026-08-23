from rest_framework import serializers
from .models import User, Chats


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = "__all__"


class ChatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chats
        fields = "__all__"