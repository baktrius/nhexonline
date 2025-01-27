from functools import partial
import os
from os import path
from shutil import rmtree
import shutil
from django.db import models
from django.conf import settings
from django.urls import reverse
from django.core.exceptions import ValidationError, PermissionDenied
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import transaction
from django.contrib.auth.models import AnonymousUser
from nanoid import generate
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from .filesize import naturalsize


class NanoIdField(models.CharField):
    def __init__(self, *args, **kwargs):
        kwargs["max_length"] = kwargs.get("max_length", 21)
        kwargs["editable"] = False
        kwargs["unique"] = True
        kwargs["default"] = partial(generate, size=kwargs["max_length"])
        super().__init__(*args, **kwargs)


class TableVisit(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    table = models.ForeignKey("Table", on_delete=models.CASCADE)
    visited_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s visit"

    class Meta:
        ordering = ["-visited_at"]


class Table(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True
    )
    board = models.ForeignKey("Board", on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    visits = models.ManyToManyField(
        to=settings.AUTH_USER_MODEL,
        through=TableVisit,
        related_name="visited_tables",
    )

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse("main:table_details", kwargs={"pk": self.pk})

    def get_play_url(self):
        return reverse("main:play", kwargs={"pk": self.pk})

    def has_write_permission(self, user):
        return self.owner == None or self.owner == user

    def claim(self, user):
        if not self.has_write_permission(user):
            raise PermissionDenied()
        self.owner = user
        self.save()

    def get_chairs_with_existing_invitations(self):
        return self.chair_set.filter(namedinvitation__isnull=False).distinct()

    def get_chairs_with_link_invitation(self):
        return self.chair_set.filter(link_invitation__isnull=False)

    def register_visit(self, user):
        if user.is_authenticated:
            TableVisit.objects.create(user=user, table=self)

    class Meta:
        ordering = ["created_at"]


class ChairManager(models.Manager):
    def create(self, enable_link_invitation=False, **kwargs):
        chair = super().create(**kwargs)
        if enable_link_invitation:
            chair.enable_link_invitation()
            chair.save()
        return chair


class Chair(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    table = models.ForeignKey(Table, on_delete=models.CASCADE)
    arity = models.SmallIntegerField(default=1)
    KIND_CHOICES = [("p", "Player"), ("s", "Spectator")]
    kind = models.CharField(max_length=1, choices=KIND_CHOICES, default="p")
    link_invitation = models.URLField(null=True, blank=True)

    objects = ChairManager()

    def __str__(self):
        return f"{self.name} chair"

    def get_role(self):
        return {
            "p": "player",
            "s": "spectator",
        }[self.kind]

    def has_write_permission(self, user):
        return self.table.has_write_permission(user)

    def enable_link_invitation(self):
        self.link_invitation = generate(size=10)

    def disable_link_invitation(self):
        self.link_invitation = None

    def get_invitations_summary(self):
        return ", ".join([i.user.username for i in self.namedinvitation_set.all()])


class NamedInvitation(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    chair = models.ForeignKey(Chair, on_delete=models.CASCADE)

    def get_play_url(self):
        return self.chair.table.get_play_url()

    def get_absolute_url(self):
        return reverse("main:named_invitation", kwargs={"pk": self.pk})

    def __str__(self) -> str:
        return (
            f"for {self.user.username} to {self.chair.table.name} as {self.chair.name}"
        )

    def get_from_string(self):
        return f"from {self.chair.table.owner.username} to {self.chair.table.name} as {self.chair.name}"

    class Meta:
        unique_together = ["user", "chair"]

    def has_read_permission(self, user):
        return self.user == user or self.has_write_permission(user)

    def has_write_permission(self, user):
        return self.chair.has_write_permission(user)


class Army(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    custom = models.BooleanField(default=True)
    private = models.BooleanField(default=True)
    readonly = models.BooleanField(default=False)
    utility = models.BooleanField(default=False)
    keyshortcut = models.CharField(max_length=100, null=True, blank=True)
    my_order = models.PositiveIntegerField(
        default=0, blank=False, null=False, db_index=True
    )

    def get_absolute_url(self):
        return reverse("main:army_details", kwargs={"pk": self.pk})

    def __str__(self) -> str:
        return str(self.name)

    @staticmethod
    def get_user_armies(user=None):
        # get only public armies and user's private armies
        if isinstance(user, AnonymousUser):
            user = None
        return Army.objects.filter(private=False) | Army.objects.filter(owner=user)

    def delete(self, using=None, keep_parents=False):
        if transaction.get_connection().in_atomic_block:
            raise RuntimeError("Army.delete cannot be run inside a transaction block.")
        army_media_path = f"{settings.MEDIA_ROOT}/armies/{self.id}"
        res = super().delete(using, keep_parents)
        rmtree(army_media_path, ignore_errors=True)
        return res

    def save(self, *args, **kwargs):
        if not self.my_order:
            max_order = self.__class__.objects.aggregate(models.Max("my_order"))[
                "my_order__max"
            ]
            self.my_order = (max_order or 0) + 1
        super().save(*args, **kwargs)

    def clone(self, new_name):
        new_army = Army.objects.create(
            name=new_name,
            owner=self.owner,
            custom=self.custom,
            private=self.private,
            readonly=self.readonly,
        )
        shutil.copytree(
            f"{settings.MEDIA_ROOT}/armies/{self.id}",
            f"{settings.MEDIA_ROOT}/armies/{new_army.id}",
        )
        resource_mapping = {}
        resources = self.resource_set.all()
        resource_mapping = {}
        new_resources = [
            Resource(
                name=res.name,
                army=new_army,
                file=f"armies/{new_army.id}/{os.path.basename(res.file.name)}",
            )
            for res in resources
        ]
        new_resources = Resource.objects.bulk_create(new_resources)
        for res, new_res in zip(resources, new_resources):
            resource_mapping[res.id] = new_res
        Token.objects.bulk_create(
            [
                Token(
                    name=token.name,
                    multiplicity=token.multiplicity,
                    army=new_army,
                    front_image=resource_mapping[token.front_image.id],
                    front_image_rect=token.front_image_rect,
                    back_image=resource_mapping[token.back_image.id],
                    back_image_rect=token.back_image_rect,
                    kind=token.kind,
                )
                for token in self.token_set.all()
            ]
        )
        return new_army

    def has_write_permission(self, user):
        return self.owner == user or user.is_staff

    def get_info(self):
        tokens = self.token_set.select_related("front_image", "back_image").all()
        hqs, units, markers = [
            [token for token in tokens if token.kind == kind]
            for kind in ["h", "u", "m"]
        ]
        return {
            "name": self.name,
            "tokens": list(map(Token.get_data, units)),
            "bases": list(map(Token.get_data, hqs)),
            "markers": list(map(Token.get_data, markers)),
        }

    def get_resource_choices(self):
        return [(res.id, res) for res in self.resource_set.all()]

    class Meta:
        verbose_name_plural = "armies"
        ordering = ["my_order"]


class PublicationRequest(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    source_army = models.ForeignKey(Army, on_delete=models.CASCADE)
    replace_if_successful = models.ForeignKey(
        Army,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="destination",
    )

    def has_read_permission(self, user):
        return self.source_army.owner == user or user.is_staff

    def has_write_permission(self, user):
        return user.is_staff


def army_directory_path(instance, filename):
    return f"armies/{instance.army.id}/{filename}"


class Resource(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    army = models.ForeignKey(Army, on_delete=models.CASCADE)
    file = models.FileField(upload_to=army_directory_path)

    def close_url(self):
        return reverse("main:del_res", args=(self.id,))

    def delete(self, using=None, keep_parents=False):
        if transaction.get_connection().in_atomic_block:
            raise RuntimeError(
                "Resource.delete cannot be run inside a transaction block."
            )
        self.file.delete(save=False)
        return super().delete(using, keep_parents)

    def __str__(self):
        return self.name

    def get_size(self):
        return self.file.size if self.is_valid() else 0

    def is_valid(self):
        return self.file and os.path.exists(self.file.path)


class Token(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    multiplicity = models.PositiveSmallIntegerField(
        default=1, validators=[MaxValueValidator(35)]
    )
    army = models.ForeignKey(Army, on_delete=models.CASCADE)
    front_image = models.ForeignKey(Resource, on_delete=models.CASCADE)
    front_image_rect = models.JSONField(default=None, null=True, blank=True)
    back_image = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name="back_token_set",
    )
    back_image_rect = models.JSONField(default=None, null=True, blank=True)
    KIND_CHOICES = [("h", "HQ"), ("u", "Unit"), ("m", "Marker")]
    kind = models.CharField(max_length=1, choices=KIND_CHOICES, default="u")
    additional_info = models.JSONField(default=dict, null=True, blank=True)

    def clean(self):
        if hasattr(self, "front_image") and self.army != self.front_image.army:
            raise ValidationError(
                "Token's army field doesn't match its front_image's army field"
            )
        if hasattr(self, "back_image") and self.army != self.back_image.army:
            raise ValidationError(
                "Token's army field doesn't match its back_image's army field"
            )

    @staticmethod
    def get_rect(rect, kind):
        if rect is None:
            return None
        if kind == "m":
            return rect | {"scaleX": 77 / rect["w"], "scaleY": 77 / rect["h"]}
        return rect | {"scaleX": 192 / rect["w"], "scaleY": 167 / rect["h"]}

    def get_front_rect(self):
        return self.get_rect(self.front_image_rect, self.kind)

    def get_back_rect(self):
        return self.get_rect(self.back_image_rect, self.kind)

    def __str__(self) -> str:
        return str(self.name)

    def has_write_permission(self, user):
        return self.army.owner == user or user.is_staff

    def get_data(self):
        res = {
            "name": self.name,
            "q": self.multiplicity,
            "img": path.basename(self.front_image.file.path),
            "backImg": path.basename(self.back_image.file.path),
            "id": self.id,
        }
        if self.additional_info:
            res.update(self.additional_info)
        if self.front_image_rect:
            res["imgRect"] = self.front_image_rect
        if self.back_image_rect:
            res["backImgRect"] = self.back_image_rect
        return res


class UserDiskQuota(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="disk_quota"
    )
    value = models.PositiveIntegerField(default=settings.DEFAULT_DISK_QUOTA_SIZE)

    def get_free_space(self):
        return max(self.value - self.used, 0)

    @property
    def used(self):
        return sum(
            res.get_size()
            for res in Resource.objects.select_related("army").filter(
                army__owner=self.user
            )
        )

    @property
    def used_str(self):
        return naturalsize(self.used)

    @property
    def quota_value_str(self):
        return naturalsize(self.value)

    def __str__(self):
        return f"{self.user.username} disk quota"


class Board(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    image = models.FileField(upload_to="boards/")
    info = models.JSONField(default=dict)
    defaultPriority = models.PositiveIntegerField(default=0, unique=True)

    def __str__(self) -> str:
        return self.name

    def get_info(self):
        res = self.info
        res["image"] = self.image.url
        return res


class BaseLink(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    url = models.URLField()
    my_order = models.PositiveSmallIntegerField(
        default=0, blank=False, null=False, db_index=True
    )

    def save(self, *args, **kwargs):
        if not self.my_order:
            max_order = self.__class__.objects.aggregate(models.Max("my_order"))[
                "my_order__max"
            ]
            self.my_order = (max_order or 0) + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        abstract = True
        ordering = ["my_order"]


class Link(BaseLink):
    pass


class FooterLink(BaseLink):
    url = models.CharField(max_length=200)

    def clean(self):
        url = self.url
        if url.startswith("/"):
            url = "http://example.com" + url
        validate = URLValidator()
        try:
            validate(url)
        except ValidationError:
            raise ValidationError("Invalid URL or relative path")
        super().clean()


class Emote(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    name = models.CharField(max_length=100)
    image = models.FileField(upload_to="emojis/")
    keyshortcut = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.name

    def get_info(self):
        alternative_imgs = self.emotealternativeimage_set.all()
        return {
            "id": self.id,
            "name": self.name,
            "image": [self.image.name] + [img.image.name for img in alternative_imgs],
            "keyshortcut": self.keyshortcut,
        }


class EmoteAlternativeImage(models.Model):
    id = NanoIdField(primary_key=True, max_length=12)
    emote = models.ForeignKey(Emote, on_delete=models.CASCADE)
    image = models.FileField(upload_to="emojis/")
