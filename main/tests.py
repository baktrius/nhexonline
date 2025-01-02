from http import HTTPStatus
import os
import shutil
from django.test import TestCase, TransactionTestCase, override_settings
from django.contrib.auth import get_user_model
from django.urls import reverse

from .models import Board, Chair, Table, Army, Resource, Token
from django.core.files.uploadedfile import SimpleUploadedFile
import json


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nhex.settings")

TEST_DIR = "test_data"


def create_user(username: str, password: str):
    return get_user_model().objects.create_user(username=username, password=password)


# Below tests aren't independent, because they share the same upload directory.
@override_settings(MEDIA_ROOT=(TEST_DIR + "/media"))
class ResourceUploading(TestCase):
    SMALL_IMG = "main/test_files/img1.png"

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.user = create_user(username="user", password="user")
        cls.army = Army.objects.create(name="test", owner=cls.user)

    def upload_small_img(self):
        with open(self.SMALL_IMG, "rb") as file:
            return self.client.post(
                f"/armies/{self.army.pk}/resources/", {"file_field": file}
            )

    def tearDown(self):
        shutil.rmtree(TEST_DIR, ignore_errors=True)
        return super().tearDown()

    def test_resource_upload(self):
        self.client.login(username="user", password="user")
        response = self.upload_small_img()
        self.assertTrue(Resource.objects.exists())
        self.assertRedirects(response, f"/armies/{self.army.pk}/resources/")

    def test_resource_is_stored(self):
        self.client.login(username="user", password="user")
        self.upload_small_img()
        # Assume that self.army has only one resource
        resource = self.army.resource_set.first()
        self.assertEqual(resource.name, "img1")
        resource_path = resource.file.path
        self.assertEqual(
            os.path.dirname(resource_path),
            os.path.abspath(f"{TEST_DIR}/media/armies/{self.army.pk}/"),
        )
        self.assertTrue(os.path.exists(resource_path))

    def test_multi_resource_upload(self):
        self.client.login(username="user", password="user")
        self.assertEqual(Resource.objects.count(), 0)
        with open(self.SMALL_IMG, "rb") as file1, open(self.SMALL_IMG, "rb") as file2:
            response = self.client.post(
                f"/armies/{self.army.pk}/resources/", {"file_field": [file1, file2]}
            )
        self.assertEqual(Resource.objects.count(), 2)

    def test_upload_file_exceeding_size_limit(self):
        self.client.login(username="user", password="user")
        with open("main/test_files/big_img.png", "rb") as file:
            response = self.client.post(
                f"/armies/{self.army.pk}/resources/", {"file_field": file}
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Resource.objects.count(), 0)
        self.assertInHTML("File is too large.", response.content.decode())

    def test_upload_as_anonymous(self):
        response = self.upload_small_img()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.url, f"/accounts/login/?next=/armies/{self.army.pk}/resources/"
        )
        self.assertEqual(Resource.objects.count(), 0)

    def test_not_owner_upload(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        response = self.upload_small_img()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Resource.objects.count(), 0)

    def test_exceeding_user_resources_collective_limit(self):
        self.client.login(username="user", password="user")
        # Set small quota for user
        self.user.disk_quota.value = 512 * 1024
        self.user.disk_quota.save()
        num_of_imgs = 10
        for _ in range(num_of_imgs):
            self.upload_small_img()
        num_of_resources = Resource.objects.count()
        self.assertLess(num_of_resources, num_of_imgs)
        self.assertGreater(num_of_resources, 0)

    def test_resource_listing(self):
        self.client.login(username="user", password="user")
        self.upload_small_img()
        response = self.client.get(f"/armies/{self.army.pk}/resources/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "img1")


@override_settings(MEDIA_ROOT=(TEST_DIR + "/media"))
class CorruptedResource(TestCase):

    def setUp(self):
        self.user = create_user(username="user", password="user")
        image = SimpleUploadedFile("dummy.txt", b"dummy content")
        self.army = Army.objects.create(name="test", owner=self.user)
        self.resource = Resource.objects.create(name="test", army=self.army, file=image)
        self.corruptedArmy = Army.objects.create(name="corrupted", owner=self.user)
        self.corruptedResource = Resource.objects.create(
            name="corrupted", army=self.corruptedArmy, file=image
        )
        self.corruptedResource.file.delete()

    def tearDown(self):
        shutil.rmtree(TEST_DIR, ignore_errors=True)
        return super().tearDown()

    def test_list_valid_army_resources(self):
        self.client.login(username="user", password="user")
        response = self.client.get(f"/armies/{self.army.pk}/resources/")
        self.assertEqual(response.status_code, 200)

    def test_resource_listing_dont_calculate_disk_usage(self):
        self.client.login(username="user", password="user")
        self.assertNumQueries(
            1, lambda: self.client.get(f"/armies/{self.army.pk}/resources/")
        )


@override_settings(MEDIA_ROOT=(TEST_DIR + "/media"))
class ResourceCleanup(TransactionTestCase):
    SMALL_IMG = "main/test_files/img1.png"

    def setUp(self):
        self.user = create_user(username="user", password="user")
        self.army = Army.objects.create(name="test", owner=self.user)

    def upload_small_img(self):
        with open(self.SMALL_IMG, "rb") as file:
            return self.client.post(
                f"/armies/{self.army.pk}/resources/", {"file_field": file}
            )

    def tearDown(self) -> None:
        shutil.rmtree(TEST_DIR, ignore_errors=True)
        return super().tearDown()

    def test_resource_file_cleaned_up(self):
        self.client.login(username="user", password="user")
        self.upload_small_img()
        resource = self.army.resource_set.first()
        resource_path = resource.file.path
        self.assertTrue(os.path.exists(resource_path))
        resource.delete()
        self.assertFalse(os.path.exists(resource_path))

    def test_army_delete_cleans_up_resources(self):
        self.client.login(username="user", password="user")
        self.upload_small_img()
        self.assertEqual(Resource.objects.count(), 1)
        resource = self.army.resource_set.first()
        resource_path = resource.file.path
        self.assertTrue(os.path.exists(resource_path))
        self.army.delete()
        self.assertFalse(os.path.exists(resource_path))
        self.assertEqual(Resource.objects.count(), 0)


class SimpleTest(TestCase):
    def test_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)


@override_settings(MEDIA_ROOT=(TEST_DIR + "/media"))
class TablesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.owner = create_user(username="owner", password="owner")
        cls.user2 = create_user(username="user2", password="user2")
        cls.table = Table.objects.create(name="test_table", owner=cls.owner)
        board_image = SimpleUploadedFile("dummy.txt", b"dummy content")
        cls.board = Board.objects.create(name="test_board", image=board_image)

    def tearDown(self) -> None:
        shutil.rmtree(TEST_DIR, ignore_errors=True)
        return super().tearDown()

    def test_table_creation(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            "/tables/", {"name": "new_table", "board": self.board.pk}
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(2, Table.objects.count())
        self.assertEqual(0, Chair.objects.count())

    def test_table_creation_without_board_fails(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post("/tables/", {"name": "new_table"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "This field is required.")
        self.assertEqual(1, Table.objects.count())

    def test_table_with_chairs_creation(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            "/tables/",
            {"name": "new_table", "add_chair_for_players": 2, "board": self.board.pk},
        )
        self.assertEqual(response.status_code, 302)
        table = Table.objects.get(name="new_table")
        self.assertEqual(1, table.chair_set.count())

    def test_table_with_spectators_chairs_creation(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            "/tables/",
            {
                "name": "new_table",
                "add_chair_for_spectators": 2,
                "board": self.board.pk,
            },
        )
        self.assertEqual(response.status_code, 302)
        table = Table.objects.get(name="new_table")
        self.assertEqual(1, table.chair_set.count())

    def test_one_can_see_its_own_tables(self):
        self.client.login(username="owner", password="owner")
        response = self.client.get("/tables/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.table)

    def test_one_cannot_see_others_tables(self):
        self.client.login(username="user2", password="user2")
        response = self.client.get("/tables/")
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, self.table)

    def test_one_can_view_its_table(self):
        self.client.login(username="owner", password="owner")
        response = self.client.get(f"/tables/{self.table.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.table)

    def test_one_cannot_view_others_table(self):
        self.client.login(username="user2", password="user2")
        response = self.client.get(f"/tables/{self.table.pk}/")
        self.assertEqual(response.status_code, 302)

    def test_anonymous_user_can_create_table(self):
        response = self.client.post(
            "/tables/", {"name": "new_table", "board": self.board.pk}
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(2, Table.objects.count())

    def test_anonymous_user_can_view_table_without_owner(self):
        table = Table.objects.create(name="table")
        response = self.client.get(f"/tables/{table.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, table)


class ChairManagementTest(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.owner = create_user(username="owner", password="owner")
        cls.table = Table.objects.create(name="table", owner=cls.owner)

    def test_chair_creation(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            f"/tables/{self.table.pk}/chairs/",
            {"name": "players", "arity": 1, "kind": "p"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Chair.objects.exists())

    def test_chair_creation_with_no_name(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            f"/tables/{self.table.pk}/chairs/",
            {"arity": 1, "kind": "p"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Chair.objects.exists())

    def test_unauthorized_chair_creation(self):
        response = self.client.post(
            f"/tables/{self.table.pk}/chairs/",
            {"name": "players", "arity": 1, "kind": "p"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Chair.objects.exists())

    def test_unauthorized_chair_creation2(self):
        user = create_user(username="user", password="user")
        self.client.login(username="user", password="user")
        response = self.client.post(
            f"/tables/{self.table.pk}/chairs/",
            {"name": "players", "arity": 1, "kind": "p"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Chair.objects.exists())

    def test_no_chair_listing(self):
        self.client.login(username="owner", password="owner")
        response = self.client.get(f"/tables/{self.table.pk}/invitations/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No chairs are available.")

    def test_chair_listing(self):
        self.client.login(username="owner", password="owner")
        chair = Chair.objects.create(table=self.table, arity=1, kind="p")
        response = self.client.get(f"/tables/{self.table.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, str(chair))


class InvitationsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.owner = create_user(username="owner", password="owner")
        cls.table = Table.objects.create(name="table", owner=cls.owner)
        cls.chair = Chair.objects.create(
            table=cls.table, arity=1, kind="p", name="Players"
        )
        cls.player1 = create_user(username="player1", password="player1")
        cls.player2 = create_user(username="player2", password="player2")

    def testPlayerCanSeeInvitation(self):
        # Create invitation
        invitation = self.chair.namedinvitation_set.create(user=self.player1)
        # log in as player1
        self.client.login(username="player1", password="player1")
        res = self.client.get(f"/tables/")
        # check that link to invitation is present in the response
        self.assertContains(res, f'href="{invitation.get_absolute_url()}"')
        self.assertContains(res, invitation.get_from_string())

    def testPlayerCannotSeeOthersInvitation(self):
        # Create invitation
        invitation = self.chair.namedinvitation_set.create(user=self.player1)
        # log in as player2
        self.client.login(username="player2", password="player2")
        res = self.client.get(f"/tables/")
        # check that link to invitation is not present in the response
        self.assertNotContains(
            res, f"<a href={invitation.get_absolute_url()}>{invitation}</a>", html=True
        )
        self.assertNotContains(res, str(invitation))

    def testSendingInvitationToNonexistingUser(self):
        self.client.login(username="owner", password="owner")
        res = self.client.post(
            f"/tables/{self.table.pk}/invitations/",
            {"user": "nonexisting", "chair": self.chair.pk},
        )
        self.assertContains(res, "User does not exist.")
        self.assertFalse(self.chair.namedinvitation_set.exists())

    def testSendingInvitationToExistingUser(self):
        self.client.login(username="owner", password="owner")
        res = self.client.post(
            f"/tables/{self.table.pk}/invitations/",
            {"user": self.player1.username, "chair": self.chair.pk},
        )
        self.assertRedirects(res, f"/tables/{self.table.pk}/invitations/")
        self.assertTrue(self.chair.namedinvitation_set.exists())

    def testSendingRepeatedInvitation(self):
        self.chair.namedinvitation_set.create(user=self.player1)
        self.client.login(username="owner", password="owner")
        res = self.client.post(
            f"/tables/{self.table.pk}/invitations/",
            {"user": self.player1.username, "chair": self.chair.pk},
        )
        self.assertContains(
            res, f"Invitation for {self.player1} to {self.chair} already exists."
        )
        self.assertEqual(self.chair.namedinvitation_set.count(), 1)

    def testJoiningSummaryListsNamedInvitations(self):
        self.chair.namedinvitation_set.create(user=self.player1)
        self.chair.namedinvitation_set.create(user=self.player2)
        self.client.login(username="owner", password="owner")
        res = self.client.get(f"/tables/{self.table.pk}/")
        self.assertContains(res, "for player1, player2 to Players chair", count=1)


class InvitationsCheckingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.owner = create_user(username="owner", password="owner")
        cls.table = Table.objects.create(name="table", owner=cls.owner)
        cls.chair = Chair.objects.create(table=cls.table, arity=1, kind="p")
        cls.player1 = create_user(username="player1", password="player1")
        cls.player2 = create_user(username="player2", password="player2")
        cls.invitation = cls.chair.namedinvitation_set.create(user=cls.player1)

    def authorizeRoleRequest(self, roleRequest):
        return self.client.post(
            f"/authorizeRoleRequest/",
            data=json.dumps(
                {
                    "tableId": self.table.pk,
                    "roleRequest": roleRequest,
                }
            ),
            content_type="application/json",
        )

    def testAcceptingOwner(self):
        self.client.login(username="owner", password="owner")
        res = self.authorizeRoleRequest({"role": "owner"})
        self.assertJSONEqual(res.content.decode(), {"result": True, "role": "owner"})

    def testRejectingUnauthorizedOwner(self):
        self.client.login(username="player1", password="player1")
        res = self.authorizeRoleRequest({"role": "owner"})
        self.assertJSONEqual(
            res.content.decode(), {"result": False, "reason": "Unauthorized"}
        )

    def testAcceptingNamedInvitation(self):
        self.client.login(username="player1", password="player1")
        res = self.authorizeRoleRequest({"namedInvitation": self.invitation.pk})
        self.assertJSONEqual(
            res.content.decode(),
            {"result": True, "role": self.invitation.chair.get_role()},
        )

    def testRejectingUnauthorizedNamedInvitation(self):
        self.client.login(username="player2", password="player2")
        res = self.authorizeRoleRequest({"namedInvitation": self.invitation.pk})
        self.assertJSONEqual(res.content, {"result": False, "reason": "Unauthorized"})

    def testRejectingAnonymousNamedInvitation(self):
        res = self.authorizeRoleRequest({"namedInvitation": self.invitation.pk})
        self.assertJSONEqual(res.content, {"result": False, "reason": "Unauthorized"})


class ArmiesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.owner = create_user(username="owner", password="owner")

    def getTestArmy(self):
        return Army.objects.create(name="test", owner=self.owner)

    def test_army_creation(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post("/armies/", {"name": "test"})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("main:armies"))
        self.assertTrue(Army.objects.exists())

    def test_army_creation_as_anonymous(self):
        response = self.client.post("/armies/", {"name": "test"})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("users:login") + "?next=/armies/")
        self.assertFalse(Army.objects.exists())

    def test_army_creation_with_no_name(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post("/armies/", {})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "This field is required.")
        self.assertFalse(Army.objects.exists())

    def test_army_listing(self):
        self.client.login(username="owner", password="owner")
        army = self.getTestArmy()
        response = self.client.get("/armies/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, army)

    def test_others_armies_arent_listed(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        army = self.getTestArmy()
        response = self.client.get("/armies/")
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, army)

    def test_army_view(self):
        self.client.login(username="owner", password="owner")
        army = self.getTestArmy()
        response = self.client.get(f"/armies/{army.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, army)

    def test_army_view_as_anonymous(self):
        army = self.getTestArmy()
        response = self.client.get(f"/armies/{army.pk}/")
        self.assertEqual(response.status_code, 302)

    def test_army_view_as_not_owner(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        army = self.getTestArmy()
        response = self.client.get(f"/armies/{army.pk}/")
        self.assertEqual(response.status_code, 302)

    def test_army_edit(self):
        self.client.login(username="owner", password="owner")
        army = self.getTestArmy()
        response = self.client.post(f"/armies/{army.pk}/", {"name": "new_name"})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(
            response, reverse("main:army_details", kwargs={"pk": army.pk})
        )
        army.refresh_from_db()
        self.assertEqual(army.name, "new_name")

    def test_unowned_private_armies_arent_listed_in_server_info(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        army = self.getTestArmy()
        response = self.client.get("/serverInfo/")
        self.assertEqual(response.status_code, 200)
        responseJson = response.json()
        self.assertEqual([], responseJson["res"]["armies"])

    def test_owned_private_armies_are_listed_in_owners_server_info(self):
        self.client.login(username="owner", password="owner")
        army = self.getTestArmy()
        response = self.client.get("/serverInfo/")
        self.assertEqual(response.status_code, 200)
        responseJson = response.json()
        self.assertEqual(1, len(responseJson["res"]["armies"]))

    def test_anonymous_server_info_dont_contain_private_armies(self):
        army = self.getTestArmy()
        response = self.client.get("/serverInfo/")
        self.assertEqual(response.status_code, 200)
        responseJson = response.json()
        self.assertEqual([], responseJson["res"]["armies"])

    def test_public_armies_are_listed_in_server_info(self):
        army = Army.objects.create(name="public", owner=self.owner, private=False)
        response = self.client.get("/serverInfo/")
        self.assertEqual(response.status_code, 200)
        responseJson = response.json()
        self.assertEqual(1, len(responseJson["res"]["armies"]))

    def test_public_armies_arent_listed_twice_by_owner(self):
        army = Army.objects.create(name="public", owner=self.owner, private=False)
        self.client.login(username="owner", password="owner")
        response = self.client.get("/serverInfo/")
        self.assertEqual(response.status_code, 200)
        responseJson = response.json()
        self.assertEqual(1, len(responseJson["res"]["armies"]))


class ArmiesTest2(TransactionTestCase):
    def setUp(cls):
        super().setUp()
        cls.owner = create_user(username="owner", password="owner")

    def getTestArmy(self):
        return Army.objects.create(name="test", owner=self.owner)

    def test_army_removal(self):
        self.client.login(username="owner", password="owner")
        army = self.getTestArmy()
        response = self.client.post(f"/armies/{army.pk}/delete/")
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("main:armies"))
        self.assertFalse(Army.objects.exists())

    def test_unowned_army_removal(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        army = self.getTestArmy()
        response = self.client.post(f"/armies/{army.pk}/delete/")
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertTrue(Army.objects.exists())


@override_settings(MEDIA_ROOT=(TEST_DIR + "/media"))
class TokensTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.owner = create_user(username="owner", password="owner")
        cls.army = Army.objects.create(name="test", owner=cls.owner)
        dummy_file = SimpleUploadedFile("dummy.txt", b"dummy content")
        cls.resource = cls.army.resource_set.create(name="img1", file=dummy_file)
        dummy_file.close()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_DIR, ignore_errors=True)
        return super().tearDownClass()

    def get_test_token_data(self):
        return {
            "kind": "u",
            "name": "test",
            "multiplicity": 1,
            "front_image": self.resource.pk,
            "back_image": self.resource.pk,
        }

    def test_token_creation(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            f"/armies/{self.army.pk}/tokens/",
            self.get_test_token_data(),
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Token.objects.exists())

    def test_token_creation_as_anonymous(self):
        response = self.client.post(
            f"/armies/{self.army.pk}/tokens/",
            self.get_test_token_data(),
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.url,
            f"/accounts/login/?next=/armies/{self.army.pk}/tokens/",
        )
        self.assertFalse(Token.objects.exists())

    def test_token_creation_by_other_user(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        response = self.client.post(
            f"/armies/{self.army.pk}/tokens/",
            self.get_test_token_data(),
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Token.objects.exists())

    def test_token_creation_with_unspecified_name(self):
        self.client.login(username="owner", password="owner")
        response = self.client.post(
            f"/armies/{self.army.pk}/tokens/",
            {
                "kind": "u",
                "multiplicity": "1",
                "front_image": self.resource.pk,
                "back_image": self.resource.pk,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Token.objects.exists())
        self.assertContains(response, "This field is required.")

    def get_test_token(self, name="test"):
        return self.army.token_set.create(
            kind="u",
            name=name,
            multiplicity=1,
            front_image=self.resource,
            back_image=self.resource,
        )

    def test_token_removal(self):
        self.client.login(username="owner", password="owner")
        token = self.get_test_token()
        response = self.client.post(f"/tokens/{token.pk}/delete/")
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Token.objects.exists())

    def test_token_removal_as_anonymous(self):
        token = self.get_test_token()
        response = self.client.post(f"/tokens/{token.pk}/delete/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.url,
            f"/accounts/login/?next=/tokens/{token.pk}/delete/",
        )
        self.assertTrue(Token.objects.exists())

    def test_token_removal_by_other_user(self):
        user2 = create_user(username="user2", password="user2")
        self.client.login(username="user2", password="user2")
        token = self.get_test_token()
        response = self.client.post(f"/tokens/{token.pk}/delete/")
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Token.objects.exists())

    def test_tokens_are_listed_in_army_info(self):
        self.client.login(username="owner", password="owner")
        token = self.get_test_token()
        response = self.client.get(f"/armies/{self.army.pk}/info/")
        responseJson = response.json()
        self.assertEqual(1, len(responseJson["tokens"]))
        self.assertEqual(token.name, responseJson["tokens"][0]["name"])
        self.assertEqual(0, len(responseJson["bases"]))
        self.assertEqual(response.status_code, 200)

    def test_token_management_page_with_no_resources(self):
        self.client.login(username="owner", password="owner")
        army_without_resources = Army.objects.create(name="test2", owner=self.owner)
        response = self.client.get(f"/armies/{army_without_resources.pk}/tokens/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Missing resources info")

    def test_token_management_page_with_resources_dont_contain_missing_resources_info(
        self,
    ):
        self.client.login(username="owner", password="owner")
        response = self.client.get(f"/armies/{self.army.pk}/tokens/")
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Missing resources info")
