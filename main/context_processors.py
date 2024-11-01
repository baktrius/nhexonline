from .models import FooterLink


def global_context(request):
    return {
        "footer_links": FooterLink.objects.all(),
    }
