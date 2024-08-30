import json
import shutil
import tempfile
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.core.files import File
from django.contrib.auth import get_user_model
from main.models import Army


class Command(BaseCommand):
    help = "Imports army zip file."

    def add_arguments(self, parser):
        parser.add_argument("owner", type=str)
        parser.add_argument("zip_src", type=str)
        parser.add_argument("-n", "--name", type=str, action="store")

    def handle(self, *args, **options):
        User = get_user_model()
        try:
            owner = User.objects.get(username=options["owner"])
        except User.DoesNotExist:
            raise CommandError("User does not exist.")
        zip_src = Path(options["zip_src"])
        try:
            with transaction.atomic():
                temp_dir = Path(tempfile.mkdtemp())
                shutil.unpack_archive(zip_src, temp_dir)
                info_path = temp_dir / "info.json"
                if not (info_path).exists():
                    raise CommandError("info.json not found in zip file.")
                with open(info_path) as f:
                    army_info = json.load(f)
                if not isinstance(army_info, dict):
                    raise CommandError("info.json is not a dictionary.")
                if not army_info.keys() <= {
                    "name",
                    "bases",
                    "tokens",
                    "defBackImg",
                    "markers",
                    "defBackImgRect",
                }:
                    raise CommandError(
                        f"info.json contains invalid keys {list(army_info.keys())}."
                    )
                name = options["name"] or army_info.get("name")
                if not name:
                    raise CommandError("Army name not found in info.json.")
                def_back_img = army_info.get("defBackImg")
                def_back_img_rect = army_info.get("defBackImgRect")
                resources = dict()

                def append_resource(name):
                    nonlocal resources
                    if not name in resources:
                        resource_path = temp_dir / name
                        if not resource_path.exists():
                            raise CommandError(
                                f"Resource {name} not found in zip file."
                            )
                        with resource_path.open(mode="rb") as f:
                            resources[name] = army.resource_set.create(
                                name=name, file=File(f, name=resource_path.name)
                            )
                    return resources[name]

                army = Army.objects.create(name=name, owner=owner)

                def append_token(kind, info, repeat_front=False):
                    if not info.keys() <= {
                        "name",
                        "img",
                        "imgRect",
                        "q",
                        "backImg",
                        "backImgRect",
                    }:
                        raise CommandError(
                            f"Token info contains invalid keys {list(info.keys())}."
                        )
                    name = info.get("name")
                    img_name = info.get("img")
                    rect = info.get("imgRect")
                    if repeat_front:
                        back_img_name = info.get("backImg") or img_name
                        back_img_rect = info.get("backImgRect") or rect
                    else:
                        back_img_name = info.get("backImg") or def_back_img
                        back_img_rect = info.get("backImgRect") or def_back_img_rect
                    quantity = info.get("q")
                    if None in [
                        name,
                        img_name,
                        rect,
                        back_img_name,
                        back_img_rect,
                        quantity,
                    ]:
                        raise CommandError("Token info contains missing values.")
                    img = append_resource(img_name)
                    back_img = append_resource(back_img_name)
                    army.token_set.create(
                        name=name,
                        front_image=img,
                        front_image_rect=rect,
                        back_image=back_img,
                        back_image_rect=back_img_rect,
                        multiplicity=quantity,
                        kind=kind,
                    )

                for token in army_info.get("tokens", []):
                    append_token("u", token)
                for marker in army_info.get("markers", []):
                    append_token("m", marker, True)
                for base in army_info.get("bases", []):
                    append_token("h", base)

                self.stdout.write(
                    self.style.SUCCESS(f"Successfully imported army {name}!")
                )
        finally:
            shutil.rmtree(temp_dir)
