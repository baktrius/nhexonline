from django.urls import path
from . import views

app_name = "main"
urlpatterns = [
    path("", views.index, name="index"),
    path("tables/", views.tables, name="tables"),
    path("tables/<slug:pk>/", views.tableDetails, name="table_details"),
    path("tables/<slug:pk>/play", views.play, name="play"),
    path("tables/<slug:pk>/chairs/", views.chairs, name="chairs"),
    path("tables/<slug:pk>/invitations/", views.invitations, name="invitations"),
    path("tables/<slug:pk>/info/", views.table_info, name="table_info"),
    path("tables/<slug:pk>/claim/", views.claimTable, name="claim_table"),
    path("tables/<slug:pk>/del/", views.delTable, name="del_table"),
    path(
        "chairs/<slug:pk>/link_invitation/",
        views.manage_link_invitation,
        name="manage_link_invitation",
    ),
    path("chairs/<slug:pk>/delete/", views.chair_delete, name="chair_delete"),
    path("armies/", views.armies, name="armies"),
    path("armies/<slug:pk>/", views.army_details, name="army_details"),
    path("army/<slug:pk>/info/", views.army_info, name="army_info"),
    path("armies/<slug:pk>/delete/", views.army_delete, name="army_delete"),
    path("armies/<slug:pk>/clone/", views.army_clone, name="army_clone"),
    path(
        "armies/<slug:pk>/create_pub_req/", views.create_pub_req, name="create_pub_req"
    ),
    path("armies/<slug:pk>/tokens/", views.tokens, name="tokens"),
    path("armies/<slug:pk>/resources/", views.resources, name="resources"),
    path("armies/<slug:pk>/resources/del/", views.del_res, name="del_res"),
    path(
        "armies/<slug:pk>/resources/del_many/", views.res_bulk_del, name="res_bulk_del"
    ),
    path("pub_reqs/", views.pub_reqs, name="pub_reqs"),
    path("pub_reqs/<slug:pk>/", views.pub_req_details, name="pub_req_details"),
    path("pub_reqs/<slug:pk>/accept/", views.pub_req_accept, name="pub_req_accept"),
    path("boards/<slug:pk>/info/", views.board_info, name="board_info"),
    path("tokens/<slug:pk>/", views.tokenDetails, name="token_details"),
    path("tokens/<slug:pk>/delete/", views.tokenDelete, name="token_delete"),
    path("resModal/<slug:pk>/", views.ResModal.as_view(), name="resModal"),
    path("serverInfo/", views.server_info, name="server_info"),
    path(
        "invitations/<slug:pk>/delete/",
        views.invitation_delete,
        name="invitation_delete",
    ),
    path("invitations/<slug:pk>/", views.named_invitation, name="named_invitation"),
    path(
        "invitations/<slug:pk>/play/",
        views.named_invitation_play,
        name="named_invitation_play",
    ),
    path("linkInvitations/<slug:pk>/", views.link_invitation, name="link_invitation"),
    path(
        "linkInvitations/<slug:pk>/play/",
        views.link_invitation_play,
        name="link_invitation_play",
    ),
    path(
        "authorizeRoleRequest/",
        views.authorize_role_request,
        name="authorize_role_request",
    ),
]
