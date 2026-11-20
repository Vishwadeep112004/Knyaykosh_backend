from django.db import models
from django.utils import timezone


class LegalCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Document(models.Model):
    DOCUMENT_TYPES = [
        ("ACT", "Act"),
        ("AMENDMENT", "Amendment"),
        ("RULES", "Rules"),
        ("OTHER", "Other"),
    ]

    PROCESSING_STATUS = [
        ("PENDING", "Pending"),
        ("PROCESSING", "Processing"),
        ("READY", "Ready"),
        ("FAILED", "Failed"),
    ]

    name = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPES,
        default="ACT"
    )
    published_at = models.DateField(null=True, blank=True)

    categories = models.ManyToManyField(
        LegalCategory,
        related_name="documents",
        blank=True
    )

    cloudinary_url = models.URLField(max_length=500)
    cloudinary_public_id = models.CharField(max_length=255, unique=True)

    file_hash = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True
    )

    total_chunks = models.PositiveIntegerField(default=0)

    processing_status = models.CharField(
        max_length=20,
        choices=PROCESSING_STATUS,
        default="PENDING"
    )
    error_message = models.TextField(blank=True, default="")

    is_active = models.BooleanField(default=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class KnowledgeBaseStatus(models.Model):
    STATUS_CHOICES = [
        ("UP_TO_DATE", "Up-to-date"),
        ("PENDING_REGENERATION", "Changes pending regeneration"),
        ("GENERATING", "Generating embeddings"),
        ("FAILED", "Generation failed"),
    ]

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="PENDING_REGENERATION"
    )
    last_generated_at = models.DateTimeField(null=True, blank=True)
    total_documents = models.PositiveIntegerField(default=0)
    total_chunks = models.PositiveIntegerField(default=0)
    total_embeddings = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    @classmethod
    def mark_pending(cls):
        obj = cls.get_instance()
        if obj.status != "GENERATING":
            obj.status = "PENDING_REGENERATION"
            obj.save(update_fields=["status", "updated_at"])

    @classmethod
    def mark_generating(cls):
        obj = cls.get_instance()
        obj.status = "GENERATING"
        obj.last_error = ""
        obj.save(update_fields=["status", "last_error", "updated_at"])

    @classmethod
    def mark_up_to_date(cls, doc_count, chunk_count, embedding_count):
        obj = cls.get_instance()
        obj.status = "UP_TO_DATE"
        obj.total_documents = doc_count
        obj.total_chunks = chunk_count
        obj.total_embeddings = embedding_count
        obj.last_generated_at = timezone.now()
        obj.last_error = ""
        obj.save()

    @classmethod
    def mark_failed(cls, error_msg):
        obj = cls.get_instance()
        obj.status = "FAILED"
        obj.last_error = str(error_msg)
        obj.save(update_fields=["status", "last_error", "updated_at"])

    def __str__(self):
        return f"KB Status: {self.status}"
