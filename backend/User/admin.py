from django.contrib import admin
from .models import User, Chats

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "age", "profession", "email")
    list_display_links = ("id", "name")

@admin.register(Chats)
class ChatsAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "chats")
    list_display_links = ("id", "user")