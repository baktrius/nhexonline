from django.urls import reverse
from django.conf import settings
from django.contrib.auth import get_user_model
import pytest
from pytest_django.asserts import assertContains


@pytest.fixture
def user_data():
    correct_password = "St$$ongP@ssword1234"
    return {
        "username": "testuser",
        "password1": correct_password,
        "password2": correct_password,
    }


@pytest.mark.django_db
def test_successful_signup(client, user_data):
    response = client.post(reverse("users:register"), user_data)
    assert response.status_code == 302
    assert response.url == settings.LOGIN_REDIRECT_URL
    assert response.wsgi_request.user.is_authenticated


@pytest.mark.django_db
def test_registered_user_is_in_db(client, user_data):
    client.post(reverse("users:register"), user_data)
    User = get_user_model()
    assert User.objects.filter(username=user_data["username"]).exists()


@pytest.mark.django_db
def test_creation_of_user_with_duplicate_username_fails(client, user_data):
    client.post(reverse("users:register"), user_data)
    response = client.post(reverse("users:register"), user_data)
    assert response.status_code == 200
    assertContains(response, "A user with that username already exists.")
