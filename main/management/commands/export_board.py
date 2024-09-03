from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from shutil import copy, rmtree
from os import mkdir
from main.models import Board
from django.conf import settings
from json import dumps
from pathlib import Path


class Command(BaseCommand):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "board",
            type=str,
            help="The name of the board to be exported. `*` for all boards.",
        )
        parser.add_argument(
            "path",
            type=str,
            help="The path to the directory where the board will be exported.",
        )
        return super().add_arguments(parser)

    def handle(self, *args, **options):
        board_name = options.get("board")
        if board_name == "*":
            boards = Board.objects.all()
        else:
            try:
                boards = Board.objects.filter(name=board_name)
            except Board.DoesNotExist:
                raise CommandError("Specified board does not exist.")
        for board in boards:
            self.export_board(board, Path(options["path"]))

    def export_board(self, board, path):
        board_img_path = board.image.path
        exported_board_dir = path / board.id
        if exported_board_dir.exists():
            rmtree(exported_board_dir)
        exported_board_dir.mkdir()
        copy(board_img_path, exported_board_dir)
        self.stdout.write(f"Board {board.name} exported to {exported_board_dir}.")
        # Export board info to info.json
        with open(exported_board_dir / "info.json", "w") as f:
            info = board.get_info()
            info["image"] = f"boards/{board.id}/" + info["image"].split("/")[-1]
            f.write(dumps(info))
        return
