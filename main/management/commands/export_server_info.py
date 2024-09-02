from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from main.models import Army
from main.views import get_server_info
from json import dumps


class Command(BaseCommand):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "-u",
            "--user_name",
            type=str,
            help="The user from whose perspective server info will be exported.",
        )
        parser.add_argument(
            "path",
            type=str,
            help="The path where server info will be exported.",
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
        with open(options["path"], "w") as f:
            f.write(dumps(get_server_info(user)))
        self.stdout.write(self.style.SUCCESS("Server info exported."))
