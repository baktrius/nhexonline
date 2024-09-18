from django.core.management.base import BaseCommand, CommandError, CommandParser
from pathlib import Path
from abc import ABC, abstractmethod


class SimpleExporter(BaseCommand, ABC):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "name",
            type=str,
            help=f"The name of the {self.res_name} to be exported. `*` for all {self.res_name}s.",
        )
        parser.add_argument(
            "path",
            type=str,
            help=f"The path to the directory where the {self.res_name} will be exported.",
        )
        return super().add_arguments(parser)

    def handle(self, *args, **options):
        name = options.get("name")
        if name == "*":
            objects = self.model.objects.all()
        else:
            try:
                objects = self.model.objects.filter(name=name)
            except self.model.DoesNotExist:
                raise CommandError(f"Specified {self.res_name} does not exist.")
        export_path = Path(options["path"])
        for obj in objects:
            self.export(obj, export_path, options)

    @abstractmethod
    def export(self, obj, path, options):
        pass
