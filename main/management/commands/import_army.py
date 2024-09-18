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
    help = (
        "Imports army zip file or folder containing info.json. "
        "Can import many armies at once. In such case all options "
        "and flags will be applied to each army separately."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "owner",
            type=str,
            help="Username of user which will be set as owner of imported army.",
        )
        parser.add_argument(
            "zip_src",
            type=str,
            help="Path to army zip file(s) or folder(s) containing info.json.",
            nargs="+",
        )
        parser.add_argument(
            "-n",
            "--name",
            type=str,
            action="store",
            help="New name for imported army which will overwrite name specified in info.json.",
        )
        parser.add_argument(
            "-p", "--public", action="store_true", help="Makes imported army public."
        )
        parser.add_argument(
            "-u",
            "--utility",
            action="store_true",
            help="Marks imported army as utility army meaning its tokens will be added to get utility menu.",
        )
        parser.add_argument(
            "-o",
            "--official",
            action="store_true",
            help="Marks imported army as official.",
        )
        return super().add_arguments(parser)

    def handle(self, *args, **options):
        User = get_user_model()
        try:
            owner = User.objects.get(username=options["owner"])
        except User.DoesNotExist:
            raise CommandError("User does not exist.")
        for zip_src in options["zip_src"]:
            self.import_army(owner, Path(zip_src), options)

    def import_army(self, owner, zip_src, options):
        self.stdout.write(f"Importing army from {zip_src}...")
        if zip_src.suffix == ".zip":
            with tempfile.TemporaryDirectory() as temp_dir:
                shutil.unpack_archive(zip_src, temp_dir)
                self._import_army(owner, Path(temp_dir), options)
        elif zip_src.suffix == ".json":
            self._import_army(owner, zip_src.parent, options)
        elif zip_src.is_dir():
            self._import_army(owner, zip_src, options)
        else:
            raise CommandError("Unsupported file type.")

    def _import_army(self, owner, src_dir, options):
        info_path = src_dir / "info.json"
        if not (info_path).exists():
            raise CommandError("info.json not found in zip file.")
        with open(info_path) as f:
            army_info = json.load(f)
        self.check_dict_keys(
            army_info,
            "info.json",
            {
                "name",
                "bases",
                "tokens",
                "defBackImg",
                "markers",
                "defBackImgRect",
                "instructionLink",
                "tags",
            },
            {"instructionLink", "tags"},
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
                resource_path = src_dir / name
                if not resource_path.exists():
                    raise CommandError(f"Resource {name} not found in zip file.")
                with resource_path.open(mode="rb") as f:
                    resources[name] = army.resource_set.create(
                        name=name, file=File(f, name=resource_path.name)
                    )
            return resources[name]

        def append_token(army, kind, info, repeat_front=False):
            name = info.get("name")
            if not name:
                raise CommandError("Token info does not specify its name.")
            self.check_dict_keys(
                info,
                f"{name} token",
                {
                    "name",
                    "img",
                    "imgRect",
                    "q",
                    "backImg",
                    "backImgRect",
                    "info",
                    "secret",
                    "id",
                },
                {"id"},
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
            additional_info = {}
            if "info" in info and info.get("info") != "":
                additional_info["info"] = info.get("info")
            if "secret" in info:
                additional_info["secret"] = info.get("secret")
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
                additional_info=additional_info or None,
            )

        with transaction.atomic():
            army = Army.objects.create(
                name=name,
                owner=owner,
                private=not options["public"],
                utility=options["utility"],
                custom=not options["official"],
            )
            for token in army_info.get("tokens", []):
                append_token(army, "u", token)
            for marker in army_info.get("markers", []):
                append_token(army, "m", marker, True)
            for base in army_info.get("bases", []):
                append_token(army, "h", base)

            self.stdout.write(self.style.SUCCESS(f"Successfully imported army {name}!"))

    def check_dict_keys(self, d, name, allowed, ignored=None):
        if ignored is None:
            ignored = set()
        if not isinstance(d, dict):
            raise CommandError(f"{name} is not a dictionary.")
        keys = d.keys()
        if not keys <= allowed:
            raise CommandError(f"{name} contains invalid keys {list(keys - allowed)}.")
        if keys & ignored:
            self.stdout.write(
                self.style.WARNING(
                    f"{name} contains ignored keys {list(keys & ignored)}."
                )
            )
