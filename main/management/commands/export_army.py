from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from main.models import Army
from shutil import copytree
from django.conf import settings
from json import dumps
from pathlib import Path


class Command(BaseCommand):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "-u",
            "--user_name",
            type=str,
            help="The user from whose perspective the armies will be exported.",
        )
        parser.add_argument(
            "army",
            type=str,
            help="The name of the army to be exported. `*` for all armies.",
        )
        parser.add_argument(
            "path",
            type=str,
            help="The path to the directory where the armies will be exported.",
        )
        return super().add_arguments(parser)

    def handle(self, *args, **options):
        user_name = options.get("user_name")
        user = AnonymousUser()
        if user_name is not None:
            User = get_user_model()
            try:
                user = User.objects.get(username=user_name)
            except User.DoesNotExist:
                raise CommandError("User does not exist.")

        army_name = options.get("army")
        if army_name == "*":
            armies = Army.get_user_armies(user)
        else:
            try:
                armies = Army.objects.filter(name=army_name)
            except Army.DoesNotExist:
                raise CommandError("Specified army does not exist.")
        for army in armies:
            self.export_army(army, Path(options["path"]))

    def export_army(self, army, path):
        army_dir = settings.MEDIA_ROOT / "armies" / army.id
        exported_army_dir = path / army.id
        copytree(army_dir, exported_army_dir, dirs_exist_ok=True)
        self.stdout.write(f"Army {army.name} exported to {exported_army_dir}.")
        # Export army info to info.json
        with open(exported_army_dir / "info.json", "w") as f:
            f.write(dumps(army.get_info()))
        return
