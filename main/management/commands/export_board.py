from typing import override
from shutil import copy, rmtree
from main.models import Board
from json import dumps
from .helpers.simple_exporter import SimpleExporter


class Command(SimpleExporter):
    res_name = "board"
    model = Board

    @override
    def export(self, board, path, options):
        board_img_path = board.image.path
        exported_board_dir = path / board.id
        if exported_board_dir.exists():
            rmtree(exported_board_dir)
        exported_board_dir.mkdir(parents=True)
        copy(board_img_path, exported_board_dir)
        self.stdout.write(f"Board {board.name} exported to {exported_board_dir}.")
        # Export board info to info.json
        with open(exported_board_dir / "info.json", "w") as f:
            info = board.get_info()
            info["image"] = f"boards/{board.id}/" + info["image"].split("/")[-1]
            f.write(dumps(info))
        return
