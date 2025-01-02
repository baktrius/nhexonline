from django.db import models as django_models
from django.contrib import admin
from django.forms.widgets import Textarea, NumberInput
from django.contrib.admin.views.main import ChangeList
from django.core.paginator import EmptyPage, InvalidPage, Paginator
from adminsortable2.admin import SortableAdminMixin
from . import models


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


class InlineChangeList(object):
    can_show_all = False
    multi_page = True
    get_query_string = ChangeList.__dict__["get_query_string"]

    def __init__(self, request, page_num, paginator):
        self.show_all = "all" in request.GET
        self.page_num = page_num
        self.paginator = paginator
        self.result_count = paginator.count
        self.params = dict(request.GET.items())


class TableVisitInline(admin.TabularInline):
    model = models.TableVisit
    readonly_fields = ["user", "visited_at"]
    extra = 0
    template = "main/adminTableVisits.html"
    per_page = 10

    def get_formset(self, request, obj=None, **kwargs):
        formset_class = super(TableVisitInline, self).get_formset(
            request, obj, **kwargs
        )

        class PaginationFormSet(formset_class):
            def __init__(self, *args, **kwargs):
                super(PaginationFormSet, self).__init__(*args, **kwargs)

                qs = self.queryset
                paginator = Paginator(qs, self.per_page)
                try:
                    page_num = int(request.GET.get("page", ["0"])[0])
                except ValueError:
                    page_num = 0

                try:
                    page = paginator.page(page_num + 1)
                except (EmptyPage, InvalidPage):
                    page = paginator.page(paginator.num_pages)

                self.page = page
                self.cl = InlineChangeList(request, page_num, paginator)
                self.paginator = paginator

                if self.cl.show_all:
                    self._queryset = qs
                else:
                    self._queryset = page.object_list

        PaginationFormSet.per_page = self.per_page
        return PaginationFormSet


@admin.register(models.Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at", "updated_at")
    search_fields = ("name", "owner__username")
    list_filter = ("owner",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [TableVisitInline]


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
