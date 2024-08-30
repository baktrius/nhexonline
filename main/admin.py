from main import models
from django.contrib import admin
from . import models


class TokenInline(admin.TabularInline):
    model = models.Token


class ArmyAdmin(admin.ModelAdmin):
    inlines = [TokenInline]


class EmoteAlternativeImageInline(admin.TabularInline):
    model = models.EmoteAlternativeImage


class EmoteAdmin(admin.ModelAdmin):
    inlines = [EmoteAlternativeImageInline]


admin.site.register(models.Table)
admin.site.register(models.Resource)
admin.site.register(models.Army, ArmyAdmin)
admin.site.register(models.PublicationRequest)
admin.site.register(models.Board)
admin.site.register(models.Link)
admin.site.register(models.Emote, EmoteAdmin)
