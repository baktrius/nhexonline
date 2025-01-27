# Generated by Django 5.0.3 on 2024-10-28 18:16

from django.db import migrations, models


def reorder(apps, schema_editor):
    MyModel = apps.get_model("main", "Army")
    for order, item in enumerate(MyModel.objects.all(), 1):
        item.my_order = order
        item.save(update_fields=["my_order"])


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0022_alter_link_options_link_my_order"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="army",
            options={"ordering": ["my_order"], "verbose_name_plural": "armies"},
        ),
        migrations.AddField(
            model_name="army",
            name="my_order",
            field=models.PositiveIntegerField(db_index=True, default=0),
        ),
        migrations.RunPython(reorder, reverse_code=migrations.RunPython.noop),
    ]
