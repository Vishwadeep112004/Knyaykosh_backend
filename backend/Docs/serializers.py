import cloudinary.utils
from rest_framework import serializers
from .models import Document, LegalCategory, KnowledgeBaseStatus


class LegalCategorySerializer(serializers.ModelSerializer):
    documents_count = serializers.SerializerMethodField()

    class Meta:
        model = LegalCategory
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "documents_count"
        ]

    def get_documents_count(self, obj):
        return obj.documents.count()


class DocumentSerializer(serializers.ModelSerializer):
    categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=LegalCategory.objects.all(),
        required=False
    )
    categories_details = serializers.SerializerMethodField()
    view_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "name",
            "document_type",
            "published_at",
            "categories",
            "categories_details",
            "cloudinary_url",
            "cloudinary_public_id",
            "view_url",
            "file_hash",
            "total_chunks",
            "processing_status",
            "error_message",
            "is_active",
            "uploaded_at",
        ]
        read_only_fields = [
            "id",
            "file_hash",
            "total_chunks",
            "processing_status",
            "error_message",
            "uploaded_at",
        ]

    def get_categories_details(self, obj):
        return [
            {"id": cat.id, "name": cat.name}
            for cat in obj.categories.all()
        ]

    def get_view_url(self, obj):
        if obj.cloudinary_public_id:
            try:
                return cloudinary.utils.private_download_url(
                    obj.cloudinary_public_id,
                    "",
                    resource_type="raw",
                    type="upload",
                    attachment=False
                )
            except Exception:
                pass
        return f"/docs/documents/{obj.id}/view/"


class KnowledgeBaseStatusSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    active_documents = serializers.SerializerMethodField()
    ready_documents = serializers.SerializerMethodField()
    pending_documents = serializers.SerializerMethodField()
    failed_documents = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeBaseStatus
        fields = [
            "id",
            "status",
            "status_display",
            "last_generated_at",
            "total_documents",
            "active_documents",
            "ready_documents",
            "pending_documents",
            "failed_documents",
            "total_chunks",
            "total_embeddings",
            "last_error",
            "updated_at",
        ]

    def get_active_documents(self, obj):
        return Document.objects.filter(is_active=True).count()

    def get_ready_documents(self, obj):
        return Document.objects.filter(is_active=True, processing_status="READY").count()

    def get_pending_documents(self, obj):
        return Document.objects.filter(is_active=True, processing_status="PENDING").count()

    def get_failed_documents(self, obj):
        return Document.objects.filter(is_active=True, processing_status="FAILED").count()
