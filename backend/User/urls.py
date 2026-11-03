from django.urls import path
from . import views

urlpatterns = [
    path('', views.userApi),
    path('<int:pk>/', views.userApi),
    path('chats/', views.chatApi),
    path('chats/<int:pk>/', views.chatApi),
]