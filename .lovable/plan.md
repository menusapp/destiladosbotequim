

## Fix: Category Image Upload — Wrong Bucket Name

### Root Cause
In `CategoriesTab.tsx` (lines 68 and 74), the upload code references bucket `"products"`, but the actual storage bucket is named `"product-images"`. This causes a 400 error because the `"products"` bucket does not exist.

### Changes

**File: `src/components/admin/CategoriesTab.tsx`**

1. Line 68: Change `.from("products")` → `.from("product-images")`
2. Line 74: Change `.from("products")` → `.from("product-images")`
3. Add detailed console logging for debugging: log bucket, path, content-type, file name, and full error response on failure, plus confirmation when URL is saved.

No other files need changes. No database migration needed. The `image_url` column on `categories` already exists. The category save logic already persists `image_url` correctly.

### Safety
- Only the upload bucket reference changes — no product image logic is touched.
- No changes to category CRUD, Totem display, or delivery menu.

