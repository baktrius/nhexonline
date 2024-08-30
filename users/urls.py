from django.urls import include, path
from django.contrib.auth import views as auth_views

from . import views

app_name = "users"
urlpatterns = [
    path("login/", auth_views.LoginView.as_view(), name="login"),
    path("logout/", views.CustomLoginView.as_view(), name="logout"),
    path("logged_out/", views.logged_out, name="logged_out"),
    path("register/", views.register, name="register"),
]
