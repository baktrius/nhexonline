from django.shortcuts import render
from django.http import HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.contrib.auth import authenticate, login
from django.contrib.auth.views import LogoutView
from django.conf import settings

from .forms import SignupForm


def register(request):
    if request.method == "POST":
        form = SignupForm(request.POST)
        if form.is_valid():
            form.save()
            username = form.cleaned_data["username"]
            password = form.cleaned_data["password1"]
            user = authenticate(request, username=username, password=password)
            if user:
                login(request, user)
                return HttpResponseRedirect(settings.LOGIN_REDIRECT_URL)
            return HttpResponseRedirect(reverse("login"))
    else:
        form = SignupForm()
    return render(request, "registration/registration.html", {"form": form})


class CustomLoginView(LogoutView):
    next_page = reverse_lazy("users:logged_out")


def logged_out(request):
    return render(request, "registration/logged_out.html")
