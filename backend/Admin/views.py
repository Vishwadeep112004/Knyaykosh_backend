from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Admin
from .serializers import (
    AdminSerializer,
    AdminLoginSerializer,
    AdminRegisterSerializer
)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def register_admin(request):
    # GET: Allow frontend to verify if initial admin setup is available
    if request.method == "GET":
        admin_exists = Admin.objects.exists()
        return Response(
            {
                "can_register": not admin_exists,
                "admin_exists": admin_exists,
                "message": (
                    "Admin registration is available."
                    if not admin_exists
                    else "An administrator account already exists. Only one admin is permitted."
                )
            },
            status=status.HTTP_200_OK
        )

    # POST: Register the single administrator
    if Admin.objects.exists():
        return Response(
            {
                "error": "Admin account already exists. Only one administrative account is permitted for this system."
            },
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = AdminRegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    validated_data = serializer.validated_data.copy()
    password = validated_data.pop("password")
    validated_data.pop("confirm_password", None)

    with transaction.atomic():
        if Admin.objects.exists():
            return Response(
                {
                    "error": "Admin account already exists. Only one administrative account is permitted for this system."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        admin = Admin.objects.create(
            **validated_data,
            password=password
        )

        # Synchronize corresponding Django auth user with staff privileges
        UserModel = get_user_model()
        user = UserModel.objects.filter(email__iexact=admin.email).first()
        if not user:
            base_username = admin.email.split("@")[0]
            username = base_username
            counter = 1
            while UserModel.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            user = UserModel.objects.create_user(
                username=username,
                email=admin.email,
                password=password,
                name=admin.name,
                is_staff=True,
                is_superuser=True
            )
        else:
            if not user.is_staff:
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=["is_staff", "is_superuser"])

    return Response(
        {
            "message": "Admin account registered successfully.",
            "admin": AdminSerializer(admin).data
        },
        status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_admin(request):
    serializer = AdminLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"].strip().lower()
    password = serializer.validated_data["password"]

    # 1. Check if a normal user account exists with this email
    UserModel = get_user_model()
    user = UserModel.objects.filter(email__iexact=email).first()

    # 2. Check Admin record
    admin = Admin.objects.filter(email__iexact=email).first()

    # If the email belongs to a normal registered user without admin credentials
    if user and not user.is_staff and not admin:
        return Response(
            {"error": "Access denied. Regular user accounts cannot access the admin portal."},
            status=status.HTTP_403_FORBIDDEN
        )

    # If no Admin record exists in Admin model, check if a superuser/staff user exists in UserModel
    if not admin:
        if user and user.is_staff and user.check_password(password):
            # Auto-provision single Admin record if not yet created
            if not Admin.objects.exists():
                admin = Admin.objects.create(
                    name=user.name or user.username or "Administrator",
                    email=user.email or email,
                    age=30,
                    qualification="System / Legal Administrator",
                    designation="Super Administrator",
                    password=password
                )
            else:
                admin = Admin.objects.first()
        else:
            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )
    else:
        # Verify password against Admin model
        if not admin.verify_password(password):
            # Also check user model password as fallback if synchronized
            if not (user and user.is_staff and user.check_password(password)):
                return Response(
                    {"error": "Invalid email or password."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

    # 3. Ensure corresponding Django auth user has staff privileges for JWT session
    if not user:
        base_username = admin.email.split("@")[0]
        username = base_username
        counter = 1
        while UserModel.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        user = UserModel.objects.create_user(
            username=username,
            email=admin.email,
            password=password,
            name=admin.name,
            is_staff=True,
            is_superuser=True
        )
    else:
        if not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

    # 4. Generate SimpleJWT tokens
    refresh = RefreshToken.for_user(user)
    refresh["is_staff"] = True
    refresh["is_admin"] = True
    refresh["email"] = admin.email
    refresh["name"] = admin.name

    return Response(
        {
            "message": "Login successful.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "admin": AdminSerializer(admin).data,
            "user": {
                "id": user.id,
                "username": user.username,
                "name": user.name or admin.name,
                "email": user.email or admin.email,
                "is_staff": True
            }
        },
        status=status.HTTP_200_OK
    )
