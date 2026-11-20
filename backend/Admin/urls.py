from django.urls import path
from . import views

urlpatterns = [
    path("login/", views.login_admin, name="admin-login"),
    path("register/", views.register_admin, name="admin-register"),
]
