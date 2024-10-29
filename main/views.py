import functools
import json
from pathlib import Path
from random import choice
from django import forms
from django.conf import settings
from django.db.models.query import QuerySet
from django.forms import modelform_factory
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.generic import CreateView, UpdateView
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.core.paginator import Paginator
import requests

from .models import (
    Board,
    Chair,
    Emote,
    Link,
    NamedInvitation,
    PublicationRequest,
    Table,
    Resource,
    Army,
    Token,
)
from .forms import (
    AddChairForm,
    AddInvitationForm,
    AddResourcesForm,
    AddTableForm,
    AddTokenForm,
    AddArmyForm,
    CreatePubReq,
)
from django_htmx.http import trigger_client_event, HttpResponseClientRedirect
from django.contrib.auth.decorators import login_required
from http import HTTPStatus


def redirect_to_login(request):
    return HttpResponseRedirect(
        "{}?next={}".format(reverse("users:login"), request.path)
    )


def redirect_with_obj(view_name, obj):
    return HttpResponseRedirect(reverse(view_name, kwargs={"pk": obj.pk}))


def admin_required(view_func):

    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_staff:
            return redirect_to_login(request)
        return view_func(request, *args, **kwargs)

    return wrapper


def read_perm(obj, user):
    if hasattr(obj, "has_read_permission"):
        return obj.has_read_permission(user)
    return obj.has_write_permission(user)


def write_perm(obj, user):
    return obj.has_write_permission(user)


def obj_view(klass, perm=read_perm):
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(request, pk, *args, **kwargs):
            obj = get_object_or_404(klass, pk=pk)
            if not perm(obj, request.user):
                return redirect_to_login(request)
            return view_func(request, obj, *args, **kwargs)

        return wrapper

    return decorator


def method_in(methods):
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return HttpResponse(status=HTTPStatus.METHOD_NOT_ALLOWED)
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


only_GET = method_in(["GET"])
only_POST = method_in(["POST"])
GET_or_POST = method_in(["GET", "POST"])


def default(val, default):
    return val if val is not None else default


def prep_form(request, klass, *args, **kwargs):
    return klass(request.POST if request.method == "POST" else None, *args, **kwargs)


def generate_random_table_name():
    colors = [
        "Red",
        "Blue",
        "Green",
        "Yellow",
        "Black",
        "White",
        "Purple",
        "Orange",
        "Pink",
        "Brown",
    ]
    materials = [
        "Wooden",
        "Glass",
        "Metallic",
        "Marble",
        "Concrete",
        "Bamboo",
        "Plastic",
        "Granite",
        "Acrylic",
    ]

    return f"{choice(colors)} {choice(materials)} Table"


@only_GET
def index(request):
    form = prep_form(request, AddTableForm)
    form.fields["name"].initial = generate_random_table_name()
    form.fields["add_chair_for_players"].widget = forms.HiddenInput()
    form.fields["generate_join_link_for_players"].widget = forms.HiddenInput()
    form.fields["add_chair_for_spectators"].widget = forms.HiddenInput()
    form.fields["generate_join_link_for_spectators"].widget = forms.HiddenInput()
    return render(request, "main/index.html", {"form": form})


@GET_or_POST
def tables(request):
    tables = []
    invitations = []
    user = None
    if request.user.is_authenticated:
        tables = request.user.table_set.all()
        invitations = request.user.namedinvitation_set.all()
        user = request.user
    form = prep_form(request, AddTableForm)
    if request.method == "POST":
        form.instance.owner = user
        if form.is_valid():
            tableId = requests.post(
                settings.INTERNAL_TSS_URL + "/tables/",
                data={"board": form.instance.board.id},
            ).json()["tableId"]
            if tableId:
                form.instance.id = tableId
                table = form.save()
                players_num = default(form.cleaned_data.get("add_chair_for_players"), 0)
                if players_num > 0:
                    table.chair_set.create(
                        name="Players",
                        arity=players_num,
                        kind="p",
                        enable_link_invitation=form.cleaned_data.get(
                            "generate_join_link_for_players"
                        ),
                    )
                spectators_num = default(
                    form.cleaned_data.get("add_chair_for_spectators"), 0
                )
                if spectators_num > 0:
                    table.chair_set.create(
                        name="Spectators",
                        arity=spectators_num,
                        kind="s",
                        enable_link_invitation=form.cleaned_data.get(
                            "generate_join_link_for_spectators"
                        ),
                    )
                return redirect_with_obj("main:table_details", table)
            else:
                form.add_error(None, "Failed to create table")
    paginator = Paginator(tables, 20)
    page_number = request.GET.get("page")
    tables_page = paginator.get_page(page_number)
    context = {
        "tables": tables,
        "tables_page": tables_page,
        "invitations": invitations,
        "form": form,
    }
    return render(request, "main/tables.html", context)


def get_base_uri(request):
    if hasattr(settings, "MAIN_SERVER_URL"):
        return settings.MAIN_SERVER_URL
    return request.build_absolute_uri("/")[:-1]


@only_GET
@obj_view(Table)
def tableDetails(request, table):
    context = {
        "table": table,
        "nick": get_user_suggested_nick(request.user),
        "base_uri": get_base_uri(request),
    }
    return render(request, "main/tableDetails.html", context)


@only_POST
@obj_view(Table, write_perm)
@login_required
def claimTable(request, table):
    table.claim(request.user)
    return redirect_with_obj("main:table_details", table)


@only_POST
@obj_view(Table, write_perm)
def delTable(request, table):
    table.delete()
    res_url = reverse("main:tables")
    if request.htmx:
        return HttpResponseClientRedirect(res_url)
    return HttpResponseRedirect(res_url)


@GET_or_POST
@login_required
def armies(request):
    form = prep_form(request, AddArmyForm)
    if request.method == "POST":
        if form.is_valid():
            army = form.save(commit=False)
            army.owner = request.user
            army.save()
            return HttpResponseRedirect(reverse("main:armies"))
    armies = Army.objects.filter(owner=request.user)
    paginator = Paginator(armies, 20)
    page_number = request.GET.get("page")
    armies_page = paginator.get_page(page_number)
    context = {
        "form": form,
        "armies": armies,
        "armies_page": armies_page,
    }
    return render(request, "main/armies.html", context)


@GET_or_POST
@obj_view(Army)
def army_details(request, army):
    form = prep_form(request, modelform_factory(Army, fields=["name"]), instance=army)
    if request.method == "POST":
        if form.is_valid():
            form.save()
            return redirect_with_obj("main:army_details", army)

    tokens = army.token_set.all()
    pub_reqs = army.publicationrequest_set.all()
    context = {
        "army": army,
        "tokens": tokens,
        "form": form,
        "pub_reqs": pub_reqs,
    }
    return render(request, "main/armyDetails.html", context)


@only_POST
@obj_view(Army, write_perm)
def army_delete(request, army):
    army.delete()
    return HttpResponseRedirect(reverse("main:armies"))


@GET_or_POST
@obj_view(Army)
def army_clone(request, army):
    if request.method == "GET":
        context = {"army": army}
        return render(request, "main/cloneArmy.html", context)
    new_army = army.clone(f"{army.name} (clone)")
    return redirect_with_obj("main:army_details", new_army)


@GET_or_POST
@obj_view(Army, write_perm)
def create_pub_req(request, army):
    form = prep_form(request, CreatePubReq, source_army=army)
    if request.method == "POST":
        if form.is_valid():
            form.save()
            return redirect_with_obj("main:army_details", army)
    context = {
        "form": form,
        "army": army,
    }
    return render(request, "main/createPubReq.html", context)


@only_GET
@admin_required
def pub_reqs(request):
    reqs = PublicationRequest.objects.all()
    return render(request, "main/pubReqs.html", {"pub_reqs": reqs})


@only_GET
@obj_view(PublicationRequest)
def pub_req_details(request, obj):
    return render(request, "main/pubReqDetails.html", {"pub_req": obj})


@obj_view(PublicationRequest, write_perm)
def pub_req_accept(request, obj):
    pass


def try_parse_int(s: str) -> int | None:
    try:
        return int(s)
    except (ValueError, TypeError):
        return None


@GET_or_POST
@login_required
def tokens(request, pk):
    army = get_object_or_404(Army, pk=pk)
    if army.owner != request.user:
        return HttpResponse(status=HTTPStatus.FORBIDDEN)
    resources = army.get_resource_choices()
    form = prep_form(request, AddTokenForm, resources=resources)
    if request.method == "POST":
        form.instance.army = army
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(request.path)
    tokens = army.token_set.select_related("front_image", "back_image").order_by("kind")
    context = {
        "army": army,
        "tokens": tokens.all(),
        "form": form,
    }
    return render(request, "main/tokens.html", context)


@only_POST
@obj_view(Token.objects.select_related("army"), write_perm)
def tokenDelete(request, token):
    token.delete()
    if request.htmx:
        return HttpResponse()
    return redirect_with_obj("main:tokens", token.army)


@GET_or_POST
@obj_view(Token.objects.select_related("army"))
def tokenDetails(request, token):
    army = token.army
    resources = army.get_resource_choices()
    form = prep_form(request, AddTokenForm, instance=token, resources=resources)
    if request.method == "POST":
        if form.is_valid():
            form.save()
            return redirect_with_obj("main:tokens", token.army)
    context = {
        "army": army,
        "token": token,
        "form": form,
    }
    return render(request, "main/token_details.html", context)


# TODO reconsider access control
@only_GET
def army_info(request: HttpRequest, pk: str) -> HttpResponse:
    try:
        army = Army.objects.get(pk=pk)
    except Army.DoesNotExist:
        return JsonResponse({"error": "Army not found"}, status=HTTPStatus.NOT_FOUND)

    return JsonResponse(army.get_info())


def resources_to_json(resources):
    return [{"name": res.name, "url": res.file.url, "id": res.id} for res in resources]


def add_resource_context(pk, context):
    army = Army.objects.get(pk=pk)
    context["pk"] = pk
    context["army"] = army
    context["resources"] = army.resource_set.all()
    context["resources_json_lazy"] = lambda: resources_to_json(context["resources"])
    return context


@GET_or_POST
@obj_view(Army)
def resources(request, army):
    form = prep_form(
        request,
        AddResourcesForm,
        request.FILES,
        free_space=request.user.disk_quota.get_free_space(),
    )
    context = {"form": form}
    add_resource_context(army.pk, context)
    if request.method == "GET" or not form.is_valid():
        # initial form rendering
        # or rerendering in case of invalid data
        return render(request, "main/resources2.html", context=context)
    # successful form handling
    files = form.cleaned_data["file_field"]
    new_resources = [
        Resource(army_id=army.pk, file=f, name=Path(f.name).stem) for f in files
    ]
    for res in new_resources:
        res.save()
    if not request.htmx:
        return HttpResponseRedirect(request.path)
    context["add_res"] = new_resources
    response = render(request, "main/addResForm.html", context=context)
    return trigger_client_event(
        response, "add_res", {"els": resources_to_json(new_resources)}
    )


@only_POST
@obj_view(Resource, write_perm)
def del_res(request, res):
    res.delete()
    return HttpResponse()


@only_POST
@obj_view(Army, write_perm)
def res_bulk_del(request: HttpRequest, army):
    ids = request.POST.getlist("res", [])
    army.resource_set.filter(pk__in=ids).delete()
    return JsonResponse({"success": True})


class ResModal(UpdateView):
    model = Resource
    fields = ["name"]
    template_name = "main/resModal.html"


@only_GET
@obj_view(Table)
def play(request, table):
    return render(
        request, "main/play.html", {"table": table, "roleRequest": {"role": "owner"}}
    )


@only_GET
def table_info(request, pk):
    table = get_object_or_404(Table, pk=pk)
    chairs = list(table.chair_set.values("id", "name", "arity", "kind"))
    info = {
        "id": str(pk),
        "name": table.name,
        "defNumOfPlayers": 2,
        "board": table.board_id,
        "owner": table.owner_id,
        "chairs": chairs,
    }
    return JsonResponse(info)


@only_GET
def board_info(request, pk):
    board = get_object_or_404(Board, pk=pk)
    return JsonResponse(board.get_info())


def get_server_info(user):
    armies = list(
        Army.get_user_armies(user).values(
            "id", "name", "custom", "private", "utility", "keyshortcut"
        )
    )
    emotes = [
        el.get_info()
        for el in Emote.objects.prefetch_related("emotealternativeimage_set").all()
    ]
    return {
        "serverName": "local",
        "serverVersion": "1.0.0",
        "res": {
            "armies": armies,
            "emotes": emotes,
            "utilities": [],
            "links": list(Link.objects.values("name", "url")),
            "boards": list(Board.objects.values("id", "name")),
        },
        "tss_url": settings.TSS_URL,
        "tss_ws_url": settings.TSS_WS_URL,
    }


@only_GET
def server_info(request):
    return JsonResponse(get_server_info(request.user))


@GET_or_POST
@obj_view(Table, write_perm)
def chairs(request, table):
    form = prep_form(request, AddChairForm)
    if request.method == "POST" and form.is_valid():
        chair = form.save(commit=False)
        chair.table = table
        chair.save()
        return redirect_with_obj("main:chairs", table)
    return render(request, "main/chairs.html", {"form": form, "table": table})


@only_POST
@obj_view(Chair.objects.select_related("table"), write_perm)
def chair_delete(request, chair):
    chair.delete()
    return redirect_with_obj("main:table_details", chair.table)


@GET_or_POST
@obj_view(Table.objects.prefetch_related("chair_set__namedinvitation_set"))
def invitations(request, table):
    form = prep_form(request, AddInvitationForm)
    form.fields["chair"].queryset = table.chair_set.all()
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect_with_obj("main:invitations", table)
    return render(
        request,
        "main/tableInvitations.html",
        {
            "form": form,
            "table": table,
            "base_uri": get_base_uri(request),
        },
    )


@only_POST
@obj_view(NamedInvitation.objects.select_related("chair__table"), write_perm)
def invitation_delete(request, invitation):
    invitation.delete()
    return redirect_with_obj("main:invitations", invitation.chair.table)


@only_POST
@obj_view(Chair.objects.select_related("table"), write_perm)
def manage_link_invitation(request, chair):
    if request.POST.get("action") == "Enable":
        chair.enable_link_invitation()
    elif request.POST.get("action") == "Disable":
        chair.disable_link_invitation()
    else:
        return HttpResponse(status=HTTPStatus.BAD_REQUEST)
    chair.save()
    return redirect_with_obj("main:invitations", chair.table)


def get_user_suggested_nick(user):
    if user.is_authenticated:
        return user.username
    # Generate something random
    names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Thomas", "Victor"]
    animals = ["Cat", "Dog", "Elephant", "Fox", "Giraffe", "Horse", "Iguana", "Jaguar"]
    return f"{choice(animals)} {choice(names)}"


@only_GET
def link_invitation(request, pk):
    chair = get_object_or_404(Chair.objects.select_related("table"), link_invitation=pk)
    return render(
        request,
        "main/linkInvitation.html",
        {
            "chair": chair,
            "link_invitation": pk,
            "nick": get_user_suggested_nick(request.user),
        },
    )


@only_GET
def link_invitation_play(request, pk):
    chair = get_object_or_404(Chair.objects.select_related("table"), link_invitation=pk)
    return render(
        request,
        "main/play.html",
        {"table": chair.table, "roleRequest": {"role": chair.get_role()}},
    )


@only_GET
@obj_view(NamedInvitation.objects.select_related("chair__table"))
def named_invitation(request, invitation):
    return render(request, "main/namedInvitation.html", {"invitation": invitation})


@only_GET
@obj_view(NamedInvitation.objects.select_related("chair__table"))
def named_invitation_play(request, invitation):
    return render(
        request,
        "main/play.html",
        {
            "table": invitation.chair.table,
            "roleRequest": {"role": invitation.chair.get_role()},
        },
    )


@csrf_exempt
@only_POST
def authorize_role_request(request):
    data = json.loads(request.body)
    table = get_object_or_404(Table, pk=data["tableId"])
    roleReq = data["roleRequest"]
    if roleReq.get("role") == "owner":
        if table.owner == request.user:
            return JsonResponse({"result": True, "role": "owner"})
    elif roleReq.get("namedInvitation") is not None:
        invitation = get_object_or_404(
            NamedInvitation.objects.select_related("chair"),
            pk=roleReq["namedInvitation"],
        )
        if invitation.user == request.user and invitation.chair.table_id == table.pk:
            return JsonResponse({"result": True, "role": invitation.chair.get_role()})
    elif roleReq.get("linkInvitation") is not None:
        chair = get_object_or_404(
            Chair,
            link_invitation=roleReq["linkInvitation"],
        )
        if chair.table_id == table.pk:
            return JsonResponse({"result": True, "role": chair.get_role()})
    return JsonResponse(
        {"result": False, "reason": "Unauthorized"},
        status=HTTPStatus.UNAUTHORIZED,
    )
