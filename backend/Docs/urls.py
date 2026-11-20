from django.urls import path
from . import views

urlpatterns = [
    path("documents/", views.list_documents, name="docs-list"),
    path("documents/upload/", views.upload_document, name="docs-upload"),
    path("documents/<int:document_id>/", views.delete_document, name="docs-delete"),
    path("documents/<int:document_id>/view/", views.view_document_pdf, name="docs-view-pdf"),
    path("generate-embeddings/", views.generate_embeddings_api, name="docs-generate-embeddings"),
    path("status/", views.knowledge_base_status, name="docs-status"),
    path("categories/", views.list_categories, name="categories-list"),
    path("categories/add/", views.add_category, name="categories-add"),
    path("categories/<int:category_id>/", views.update_category, name="categories-update"),
    path("categories/<int:category_id>/delete/", views.delete_category, name="categories-delete"),
]
