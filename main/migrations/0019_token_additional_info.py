# Generated by Django 5.0.3 on 2024-09-01 14:14

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0018_emotealternativeimage'),
    ]

    operations = [
        migrations.AddField(
            model_name='token',
            name='additional_info',
            field=models.JSONField(blank=True, default=dict, null=True),
        ),
    ]