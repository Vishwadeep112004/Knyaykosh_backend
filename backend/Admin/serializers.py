from rest_framework import serializers
from .models import Admin


class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = [
            "id",
            "name",
            "email",
            "age",
            "qualification",
            "designation",
            "created_at",
            "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class AdminRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "min_length": "Password must contain at least 8 characters."
        }
    )
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = Admin
        fields = [
            "name",
            "email",
            "age",
            "qualification",
            "designation",
            "password",
            "confirm_password",
        ]

    def validate_name(self, value):
        name = value.strip()
        if len(name) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        return name

    def validate_email(self, value):
        email = value.strip().lower()
        if Admin.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An administrator with this email already exists.")
        return email

    def validate_age(self, value):
        if value < 18 or value > 120:
            raise serializers.ValidationError("Age must be between 18 and 120.")
        return value

    def validate(self, data):
        password = data.get("password")
        confirm_password = data.get("confirm_password")

        if password != confirm_password:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })

        return data
