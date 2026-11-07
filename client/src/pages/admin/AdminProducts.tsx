import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, Trash2, Pencil, ImagePlus, X, Star } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { AdminLayout, AdminPageHeader, AdminDenied } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, FieldError, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatNaira, koboToNaira, nairaToKobo, slugify, discountPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type VariantDraft = { kind: "Size" | "Colour"; value: string; priceDelta: number; stock: number };

type Draft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  subcategory: string;
  categoryId: string;
  price: string;
  discountPrice: string;
  stock: string;
  isFeatured: boolean;
  status: "active" | "draft";
  images: string[];
  variants: VariantDraft[];
};

const EMPTY: Draft = {
  name: "",
  slug: "",
  description: "",
  subcategory: "",
  categoryId: "",
  price: "",
  discountPrice: "",
  stock: "0",
  isFeatured: false,
  status: "active",
  images: [],
  variants: [],
};

export default function AdminProducts() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();
  const search = useSearch();
  const [, navigate] = useLocation();

  const [q, setQ] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = user?.role === "admin";
  const cats = trpc.admin.categories.useQuery(undefined, { enabled: isAdmin });
  const list = trpc.admin.products.useQuery(
    { q: q || undefined, categorySlug: categorySlug || undefined, page, pageSize: 20 },
    { enabled: isAdmin },
  );

  const createM = trpc.admin.createProduct.useMutation();
  const updateM = trpc.admin.updateProduct.useMutation();
  const deleteM = trpc.admin.deleteProduct.useMutation();

  // Deep link: /admin/products?edit=<id>
  const editId = new URLSearchParams(search).get("edit");
  const editTarget = trpc.admin.product.useQuery(
    { id: editId ?? "" },
    { enabled: isAdmin && Boolean(editId) },
  );

  useEffect(() => {
    if (!editTarget.data) return;
    const p = editTarget.data;
    setEditing({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      subcategory: p.subcategory ?? "",
      categoryId: p.categoryId ?? "",
      price: String(koboToNaira(p.price)),
      discountPrice: p.discountPrice ? String(koboToNaira(p.discountPrice)) : "",
      stock: String(p.stock),
      isFeatured: p.isFeatured,
      status: p.status === "draft" ? "draft" : "active",
      images: p.images.map((i) => i.url),
      variants: p.variants.map((v) => ({
        kind: v.kind === "Size" ? "Size" : "Colour",
        value: v.value,
        priceDelta: v.priceDelta,
        stock: v.stock,
      })),
    });
  }, [editTarget.data]);

  function openNew() {
    setErrors({});
    setEditing({ ...EMPTY });
    navigate("/admin/products");
  }

  function openEdit(id: string) {
    setErrors({});
    navigate(`/admin/products?edit=${id}`);
  }

  function close() {
    setEditing(null);
    setErrors({});
    navigate("/admin/products");
  }

  function validate(d: Draft): Record<string, string> {
    const e: Record<string, string> = {};
    if (d.name.trim().length < 2) e.name = "Enter a product name.";
    if (!/^[a-z0-9-]+$/.test(d.slug)) e.slug = "Use lowercase letters, numbers and hyphens only.";
    if (!d.description.trim()) e.description = "A description is required.";
    const price = nairaToKobo(d.price);
    if (price <= 0) e.price = "Enter a price above ₦0.";
    if (d.discountPrice) {
      const dp = nairaToKobo(d.discountPrice);
      if (dp <= price) e.discountPrice = "The original price must be higher than the selling price.";
    }
    if (Number(d.stock) < 0 || Number.isNaN(Number(d.stock))) e.stock = "Stock cannot be negative.";
    if (d.images.length === 0) e.images = "Add at least one image.";
    return e;
  }

  async function save() {
    if (!editing) return;
    const e = validate(editing);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      slug: editing.slug.trim(),
      description: editing.description.trim(),
      subcategory: editing.subcategory.trim() || null,
      categoryId: editing.categoryId || null,
      price: nairaToKobo(editing.price),
      discountPrice: editing.discountPrice ? nairaToKobo(editing.discountPrice) : null,
      stock: Number(editing.stock),
      isFeatured: editing.isFeatured,
      status: editing.status,
      images: editing.images,
      variants: editing.variants.filter((v) => v.value.trim()),
    };
    try {
      if (editing.id) {
        await updateM.mutateAsync({ id: editing.id, ...payload });
        toast.success("Product updated.");
      } else {
        await createM.mutateAsync(payload);
        toast.success("Product created.");
      }
      await utils.admin.products.invalidate();
      await utils.catalog.home.invalidate();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the product.");
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    try {
      await deleteM.mutateAsync({ id });
      toast.success("Product deleted.");
      await utils.admin.products.invalidate();
      await utils.catalog.home.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the product.");
    }
  }

  if (authLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-8 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </AdminLayout>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Products"
        description="Create, edit and retire catalogue items."
        action={
          <Button onClick={openNew}>
            <Plus className="size-4" /> New product
          </Button>
        }
      />

      {editing && (
        <ProductEditor
          draft={editing}
          setDraft={setEditing}
          errors={errors}
          categories={cats.data ?? []}
          onCancel={close}
          onSave={save}
          saving={createM.isPending || updateM.isPending}
        />
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search products…"
            className="pl-9"
            aria-label="Search products"
          />
        </div>
        <Select
          value={categorySlug}
          onChange={(e) => {
            setCategorySlug(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
          className="w-auto"
        >
          <option value="">All categories</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name} ({c.productCount})
            </option>
          ))}
        </Select>
      </div>

      {list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={q || categorySlug ? "No products match those filters" : "No products yet"}
          description={
            q || categorySlug
              ? "Try a different search term or clear the category filter."
              : "Add your first product and it will appear on the storefront immediately."
          }
          action={<Button onClick={openNew}>Add a product</Button>}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Category</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Stock</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data?.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="size-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium">{p.name}</p>
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {p.isFeatured && <Star className="size-3 fill-amber-400 text-amber-400" />}
                            {p.soldCount} sold
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground sm:table-cell">
                      {p.categoryName ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <p className="font-semibold">{formatNaira(p.price)}</p>
                      {p.discountPrice && (
                        <p className="text-[11px] text-muted-foreground line-through">
                          {formatNaira(p.discountPrice)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          p.stock === 0
                            ? "bg-rose-100 text-rose-700"
                            : p.stock <= 5
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700",
                        )}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <Badge tone={p.status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p.id)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(p.id, p.name)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {list.data && list.data.total > list.data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {list.data.page} · {list.data.total} products
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * list.data.pageSize >= list.data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// ── editor ───────────────────────────────────────────────────────────────────
function ProductEditor({
  draft,
  setDraft,
  errors,
  categories,
  onCancel,
  onSave,
  saving,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  errors: Record<string, string>;
  categories: { id: string; name: string }[];
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploadUrlM = trpc.files.uploadUrl.useMutation();
  const commitM = trpc.files.commit.useMutation();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  const discount = useMemo(() => {
    const p = nairaToKobo(draft.price);
    const d = draft.discountPrice ? nairaToKobo(draft.discountPrice) : null;
    return discountPercent(p, d);
  }, [draft.price, draft.discountPrice]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, 8 - draft.images.length)) {
        if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) {
          toast.error(`${file.name}: only PNG, JPEG, WebP, GIF or AVIF images are accepted.`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 8 MB.`);
          continue;
        }
        const { key, uploadUrl, publicPath } = await uploadUrlM.mutateAsync({
          name: file.name,
          contentType: file.type,
        });
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed for ${file.name}.`);
        await commitM.mutateAsync({ key, name: file.name });
        added.push(publicPath);
      }
      if (added.length) {
        setDraft({ ...draft, images: [...draft.images, ...added] });
        toast.success(`${added.length} image${added.length === 1 ? "" : "s"} uploaded.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addVariant() {
    setDraft({ ...draft, variants: [...draft.variants, { kind: "Size", value: "", priceDelta: 0, stock: 0 }] });
  }

  function updateVariant(i: number, patch: Partial<VariantDraft>) {
    const next = draft.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    setDraft({ ...draft, variants: next });
  }

  function removeVariant(i: number) {
    setDraft({ ...draft, variants: draft.variants.filter((_, idx) => idx !== i) });
  }

  return (
    <section className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold">{draft.id ? "Edit product" : "New product"}</h2>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-muted" aria-label="Close editor">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Name</Label>
          <Input
            id="p-name"
            value={draft.name}
            onChange={(e) => {
              const name = e.target.value;
              setDraft({
                ...draft,
                name,
                slug: draft.id ? draft.slug : slugify(name),
              });
            }}
            placeholder="Wireless Noise-Cancelling Earbuds"
          />
          <FieldError>{errors.name}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-slug">URL slug</Label>
          <Input
            id="p-slug"
            value={draft.slug}
            onChange={(e) => set("slug", slugify(e.target.value))}
            placeholder="wireless-earbuds"
          />
          <FieldError>{errors.slug}</FieldError>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="p-desc">Description</Label>
          <Textarea
            id="p-desc"
            rows={4}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What the product is, what's in the box, and why it's worth buying."
          />
          <FieldError>{errors.description}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-subcat">Subcategory</Label>
          <Input
            id="p-subcat"
            value={draft.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
            placeholder="e.g. Audio"
            maxLength={80}
          />
          <p className="text-[11px] text-muted-foreground">
            Shown on the product page and used by the catalogue filters.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-cat">Category</Label>
          <Select id="p-cat" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-status">Status</Label>
          <Select
            id="p-status"
            value={draft.status}
            onChange={(e) => set("status", e.target.value as "active" | "draft")}
          >
            <option value="active">Active — visible in the store</option>
            <option value="draft">Draft — hidden from customers</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-price">Selling price (₦)</Label>
          <Input
            id="p-price"
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="24500"
          />
          <FieldError>{errors.price}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-discount">
            Original price (₦) <span className="font-normal text-muted-foreground">— optional</span>
          </Label>
          <Input
            id="p-discount"
            inputMode="decimal"
            value={draft.discountPrice}
            onChange={(e) => set("discountPrice", e.target.value)}
            placeholder="32000"
          />
          {discount > 0 && (
            <p className="text-[11px] font-semibold text-emerald-600">Shows as {discount}% off</p>
          )}
          <FieldError>{errors.discountPrice}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-stock">Stock on hand</Label>
          <Input
            id="p-stock"
            inputMode="numeric"
            value={draft.stock}
            onChange={(e) => set("stock", e.target.value)}
          />
          <FieldError>{errors.stock}</FieldError>
        </div>

        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(e) => set("isFeatured", e.target.checked)}
            className="size-4 rounded border-input accent-[var(--primary)]"
          />
          Feature on the homepage
        </label>
      </div>

      {/* Images */}
      <div className="mt-5">
        <Label>Images</Label>
        <p className="mb-2 text-[11px] text-muted-foreground">
          The first image is the card thumbnail. Up to 8 images, 8 MB each.
        </p>
        <div className="flex flex-wrap gap-2">
          {draft.images.map((url, i) => (
            <div key={url} className="group relative size-20 overflow-hidden rounded-lg border bg-muted">
              <img src={url} alt="" className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] font-bold text-white">
                  MAIN
                </span>
              )}
              <button
                type="button"
                onClick={() => set("images", draft.images.filter((u) => u !== url))}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {draft.images.length < 8 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <ImagePlus className="size-5" />
              <span className="text-[10px] font-medium">{uploading ? "Uploading…" : "Add"}</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <FieldError>{errors.images}</FieldError>
      </div>

      {/* Variants */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div>
            <Label>Variants</Label>
            <p className="text-[11px] text-muted-foreground">
              Optional. Each variant carries its own stock; the product stock covers the base item.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addVariant}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        {draft.variants.length > 0 && (
          <div className="mt-2 space-y-2">
            {draft.variants.map((v, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border bg-slate-50/60 p-2">
                <div className="w-24">
                  <Label className="text-[10px]">Kind</Label>
                  <Select
                    value={v.kind}
                    onChange={(e) => updateVariant(i, { kind: e.target.value as "Size" | "Colour" })}
                  >
                    <option value="Size">Size</option>
                    <option value="Colour">Colour</option>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Label className="text-[10px]">Value</Label>
                  <Input
                    value={v.value}
                    onChange={(e) => updateVariant(i, { value: e.target.value })}
                    placeholder={v.kind === "Size" ? "XL" : "Indigo"}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-[10px]">Stock</Label>
                  <Input
                    inputMode="numeric"
                    value={String(v.stock)}
                    onChange={(e) => updateVariant(i, { stock: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-28">
                  <Label className="text-[10px]">Price ± (₦)</Label>
                  <Input
                    inputMode="numeric"
                    value={String(v.priceDelta / 100)}
                    onChange={(e) => updateVariant(i, { priceDelta: nairaToKobo(e.target.value) })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="mb-1 rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove variant"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving || uploading}>
          {saving ? "Saving…" : draft.id ? "Save changes" : "Create product"}
        </Button>
      </div>
    </section>
  );
}
