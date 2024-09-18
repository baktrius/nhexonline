from pathlib import Path

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


class Command(BaseCommand):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "-u",
            "--user_name",
            type=str,
            help="The user from whose perspective assets will be exported.",
        )
        parser.add_argument(
            "path",
            type=str,
            help="The path where assets should be saved.",
        )
        return super().add_arguments(parser)

    def handle(self, *args, **options):
        user_name = options.get("user_name")
        path = Path(options.get("path"))
        call_command("export_server_info", path / "serverInfo", user_name=user_name)
        call_command("export_army", "*", path / "armies", user_name=user_name)
        call_command("export_board", "*", path / "boards")
        call_command("export_emote", "*", path / "emojis")
        self.stdout.write(self.style.SUCCESS("All assets exported."))
