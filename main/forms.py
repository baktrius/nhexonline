from typing import Any
from django import forms
from django.contrib.auth import get_user_model

from .models import (
    Board,
    Chair,
    NamedInvitation,
    PublicationRequest,
    Resource,
    Token,
    Army,
    Table,
)


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True
    is_hidden = False


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single_file_clean = super().clean
        if isinstance(data, (list, tuple)):
            result = [single_file_clean(d, initial) for d in data]
        else:
            result = [single_file_clean(data, initial)]
        return result


class AddResourcesForm(forms.Form):
    file_field = MultipleFileField()

    def __init__(self, *args, **kwargs):
        self.free_space = kwargs.pop("free_space", 1024 * 1024 * 10)
        super().__init__(*args, **kwargs)

    def clean_file_field(self):
        files = self.cleaned_data["file_field"]
        for file in files:
            if file.size > 1024 * 1024:
                raise forms.ValidationError("File is too large.")
        return files

    def clean(self) -> dict[str, Any]:
        cleaned_data = super().clean()
        if "file_field" not in cleaned_data:
            return cleaned_data
        size_of_uploaded_files = sum(f.size for f in cleaned_data["file_field"])
        if size_of_uploaded_files > 1024 * 1024 * 10:
            raise forms.ValidationError("Total size of files is too large.")
        if (diff := size_of_uploaded_files - self.free_space) > 0:
            raise forms.ValidationError(
                f"Selected files exceeds user storage quota by {diff / 1024} KB."
            )
        return cleaned_data


class RadioImageSelect(forms.RadioSelect):
    option_template_name = "main/image_radio_option.html"

    def create_option(
        self, name, value, label, selected, index, subindex=None, attrs=None
    ):
        attrs["class"] = "absolute w-0 h-0 opacity-0"
        result = super().create_option(
            name, value, label.name, selected, index, subindex=subindex, attrs=attrs
        )
        result["img_url"] = label.file.url
        return result

    def get_context(self, name, value, attrs):
        attrs["class"] = (
            "border-gray-500 border-[1px] flex rounded imgRadio flex-wrap mb-2 items-center"
        )
        return super().get_context(name, value, attrs)


class AddTokenForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        resources = kwargs.pop("resources", None)
        super().__init__(*args, **kwargs)
        if resources:
            self.fields["front_image"].widget.choices = resources
            self.fields["back_image"].widget.choices = resources

    class Meta:
        model = Token
        fields = ["kind", "name", "multiplicity", "front_image", "back_image"]
        widgets = {
            "front_image": RadioImageSelect(),
            "back_image": RadioImageSelect(),
        }


class AddChairForm(forms.ModelForm):
    class Meta:
        model = Chair
        fields = ["name", "arity", "kind"]


class AddInvitationForm(forms.ModelForm):
    user = forms.CharField()
    field_order = ["user", "chair"]

    class Meta:
        model = NamedInvitation
        fields = ["chair"]

    def clean_user(self):
        User = get_user_model()
        user = self.cleaned_data["user"]
        try:
            return User.objects.get(username=user)
        except User.DoesNotExist:
            raise forms.ValidationError("User does not exist.")

    def clean(self):
        cleaned_data = super().clean()
        user = cleaned_data.get("user")
        chair = cleaned_data.get("chair")

        if user and chair:
            if NamedInvitation.objects.filter(user=user, chair=chair).exists():
                raise forms.ValidationError(
                    f"Invitation for {user} to {chair} already exists."
                )

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.user = self.cleaned_data["user"]
        if commit:
            instance.save()
        return instance


class AddArmyForm(forms.ModelForm):
    class Meta:
        model = Army
        fields = ["name"]


def get_default_board():
    default_board = Board.objects.order_by("defaultPriority").first()
    return default_board.id if default_board else None


class AddTableForm(forms.ModelForm):
    add_chair_for_players = forms.IntegerField(min_value=0, required=False, initial=2)
    add_chair_for_spectators = forms.IntegerField(
        min_value=0, required=False, initial=0
    )
    generate_join_link_for_players = forms.BooleanField(initial=True, required=False)
    generate_join_link_for_spectators = forms.BooleanField(
        initial=False, required=False
    )

    board = forms.ModelChoiceField(
        queryset=Board.objects.order_by("defaultPriority").all(),
        initial=get_default_board,
    )

    class Meta:
        model = Table
        fields = ["name", "board"]


class CreatePubReq(forms.ModelForm):
    rules_acknowledgement = forms.ChoiceField(
        choices=(("yes", "Yes"),), widget=forms.RadioSelect
    )
    field_order = ["rules_acknowledgement", "replace_if_successful"]

    class Meta:
        model = PublicationRequest
        fields = ["replace_if_successful"]

    def __init__(self, *args, **kwargs):
        self.source_army = kwargs.pop("source_army", None)
        super().__init__(*args, **kwargs)
        public_armies = Army.objects.filter(private=False)
        self.fields["replace_if_successful"].choices = [("", "None")] + [
            (army.id, army.name) for army in public_armies
        ]

    def save(self, **kwargs) -> Any:
        self.instance.source_army = self.source_army
        return super().save(**kwargs)
