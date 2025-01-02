# Generated by Django 5.0.3 on 2025-01-02 10:57

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0024_footerlink'),
    ]

    operations = [
        migrations.AddField(
            model_name='table',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='table',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]