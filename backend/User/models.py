from django.db import models

class User(models.Model):
    name=models.CharField(max_length=100)
    age=models.CharField()
    profession=models.CharField(max_length=50)
    email=models.EmailField(max_length=254)
    password=models.CharField(max_length=100)


class Chats(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    chats = models.JSONField(default=list)