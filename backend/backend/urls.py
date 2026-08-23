from django.contrib import admin
from django.urls import path
import User.views as user_views
import rag.views as rag_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('users/', user_views.userApi),
    path('users/<int:pk>/', user_views.userApi),
    path('users/<int:user_id>/chats/', user_views.chatApi),
    path('users/<int:user_id>/chats/<int:pk>/', user_views.chatApi),
]