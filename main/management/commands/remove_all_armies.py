from django.core.management.base import BaseCommand, CommandError
from main.models import Army

class Command(BaseCommand):
    help = "Removes all armies."

    def handle(self, *args, **options):
        Army.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("All armies removed."))
