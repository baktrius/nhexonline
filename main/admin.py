from django.db import models as django_models
from django.contrib import admin
from django.forms.widgets import Textarea
from . import models
from adminsortable2.admin import SortableAdminMixin


class TokenInline(admin.TabularInline):
    model = models.Token
    formfield_overrides = {
        django_models.JSONField: {"widget": Textarea(attrs={"rows": 2, "cols": 40})},
    }


@admin.register(models.Army)
class ArmyAdmin(SortableAdminMixin, admin.ModelAdmin):
    inlines = [TokenInline]


class EmoteAlternativeImageInline(admin.TabularInline):
    model = models.EmoteAlternativeImage


class EmoteAdmin(admin.ModelAdmin):
    inlines = [EmoteAlternativeImageInline]


@admin.register(models.Link)
class SortableLinkAdmin(SortableAdminMixin, admin.ModelAdmin):
    pass


admin.site.register(models.Table)
admin.site.register(models.Resource)
admin.site.register(models.PublicationRequest)
admin.site.register(models.Board)
admin.site.register(models.Emote, EmoteAdmin)
