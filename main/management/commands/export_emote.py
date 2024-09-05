from typing import override
from shutil import copy, rmtree
from main.models import Emote
from json import dumps
from .simple_exporter import SimpleExporter


class Command(SimpleExporter):
    res_name = "emote"
    model = Emote

    @override
    def export(self, emote, path, options):
        exported_emote_dir = path
        if exported_emote_dir.exists():
            rmtree(exported_emote_dir)
        exported_emote_dir.mkdir()
        copy(emote.image.path, exported_emote_dir)
        for img in emote.emotealternativeimage_set.all():
            copy(img.image.path, exported_emote_dir)
        self.stdout.write(f"Emote {emote.name} exported to {exported_emote_dir}.")
        return
