from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    name = models.CharField(max_length=100)
    age = models.CharField(max_length=100)
    profession = models.CharField(max_length=50)
    email = models.EmailField(max_length=254)


class Chats(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    chats = models.JSONField(default=list)