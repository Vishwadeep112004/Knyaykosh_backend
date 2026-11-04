from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    name = models.CharField(max_length=100)
    age = models.CharField(max_length=100)
    profession = models.CharField(max_length=50)
    email = models.EmailField(max_length=254)

class Chats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="chat_collection")
    created_at = models.DateTimeField(auto_now_add=True)

class Chat(models.Model):
    chats = models.ForeignKey(Chats, on_delete=models.CASCADE, related_name="conversations")
    title = models.CharField(max_length=255, default="New Chat")
    convo = models.JSONField(default=list)
    summary = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)