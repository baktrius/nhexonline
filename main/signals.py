from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import UserDiskQuota
from django.contrib.auth import get_user_model

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_disk_quota(sender, instance, created, **kwargs):
    if created:
        UserDiskQuota.objects.create(user=instance)
