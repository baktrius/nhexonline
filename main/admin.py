from django.db import models as django_models
from django.contrib import admin
from django.forms.widgets import Textarea, NumberInput
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
    list_display = ("name", "owner", "custom", "private", "readonly", "utility")
    search_fields = ("name", "owner__username")
    list_filter = ("custom", "private", "readonly", "utility")


class EmoteAlternativeImageInline(admin.TabularInline):
    model = models.EmoteAlternativeImage


class EmoteAdmin(admin.ModelAdmin):
    inlines = [EmoteAlternativeImageInline]


@admin.register(models.FooterLink)
class SortableFooterLinkAdmin(SortableAdminMixin, admin.ModelAdmin):
    pass


@admin.register(models.Link)
class SortableLinkAdmin(SortableAdminMixin, admin.ModelAdmin):
    pass


admin.site.register(models.Table)
admin.site.register(models.Resource)
admin.site.register(models.PublicationRequest)
admin.site.register(models.Board)
admin.site.register(models.Emote, EmoteAdmin)


@admin.register(models.UserDiskQuota)
class UserDiskQuotaAdmin(admin.ModelAdmin):
    list_display = ("user", "quota_value_str", "used_str")
    search_fields = ("user__username",)
    formfield_overrides = {
        django_models.PositiveIntegerField: {
            "widget": NumberInput(attrs={"width": 100}),
            "label": "Value (bytes)",
        }
    }
