from rest_framework import serializers
from .models import User, Chats


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'name',
            'age',
            'profession',
            'email',
        ]


class UserRegisterSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            'username',
            'name',
            'age',
            'profession',
            'email',
            'password',
        ]

        extra_kwargs = {
            'password': {
                'write_only': True
            }
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            name=validated_data.get('name', ''),
            age=validated_data.get('age', ''),
            profession=validated_data.get('profession', ''),
            email=validated_data.get('email', ''),
        )
        return user


class ChatsSerializer(serializers.ModelSerializer):

    class Meta:
        model = Chats
        fields = "__all__"