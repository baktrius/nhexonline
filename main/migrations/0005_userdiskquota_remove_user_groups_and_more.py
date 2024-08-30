# Generated by Django 5.0.3 on 2024-06-25 12:02

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0004_chair_namedinvitation'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserDiskQuota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('storage_quota', models.PositiveIntegerField(default=10485760)),
            ],
        ),
        migrations.RemoveField(
            model_name='user',
            name='groups',
        ),
        migrations.RemoveField(
            model_name='user',
            name='user_permissions',
        ),
    ]
