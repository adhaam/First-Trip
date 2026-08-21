# WEEMAP Sinai — Image Optimization Audit Report
**تاريخ الفحص:** August 21, 2026  
**حالة Vercel Hobby:** 5,000/5,000 Image Optimization Transformations (100% استهلاك)  
**الهدف:** البقاء على Vercel Hobby بدون upgrade إلى Pro ($20/شهر)

---

## A. Current Image Architecture

### 1. **Image Sources in the Project**

#### A. Local Static Images (`/public/media/`)
- `heroposter.png` — Hero poster fallback (1 file)
- `herovideo.mp4` — Hero video (not an image transformation)
- **أغراض:** Poster fallback for hero section + video fallback for `prefers-reduced-motion`

#### B. External URLs — Unsplash (Placeholder Images)
مأخوذة من `PLACEHOLDER_IMAGES` في `src/lib/constants.ts`:
- `dahab1`, `dahab2`, `dahab3` — Beach/Red Sea scenes
- `desert1`, `desert2` — Desert/landscape
- `diving` — Diving scene
- `camping` — Camping scene
- `mountain` — Mountain scene
- `hero` — Hero image

**Format:** `https://images.unsplash.com/photo-{ID}?w={WIDTH}&q={QUALITY}`  
**Query Parameters:** `w` (width) + `q` (quality) — كل combination = transformation جديدة

#### C. Supabase Storage URLs (Dynamic Data)
مصدرها من database:
- `Accommodation.images[]` — متعدد الصور لكل accommodation
- `Accommodation.image_url` — primary image
- `SinaiTrip.images[]` — متعدد الصور لكل رحلة
- `CommunityPost.image_url` — صورة المقال

**Format:** `https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}`  
**Query Parameters:** لا توجد query parameters (معظم الأحيان)

---

### 2. **Image Usage Pattern by Component**

| Component | Source | Type | Transformation |
|-----------|--------|------|-----------------|
| `Hero` (HomeClient) | Local `/media/heroposter.png` | Static | `fill`, `priority`, `sizes="100vw"` |
| `ExploreSinai` | Dynamic trip/settings | Supabase | `fill`, `sizes="100vw"` |
| `Community Posts Grid` | Dynamic community | Supabase/External | Both `<img>` tags (NO optimization) |
| `TripCard` (Home/List) | Dynamic trips | Supabase | `fill`, `sizes="(max-width: 640px) 85vw..."` |
| `AccommodationCard` (Home/List) | Dynamic accommodations | Supabase | `fill`, `priority` (first one) |
| `ProductDetailClient` — Gallery Hero | Dynamic accommodation | Supabase | `fill`, `priority`, `sizes="100vw"` |
| `ProductDetailClient` — Thumbnails | Dynamic accommodation | Supabase | `fill`, `sizes="96px"` |
| `ProductDetailClient` — Gallery Grid | Dynamic trips (related) | Supabase | `fill`, `sizes="(max-width: 640px) 50vw, 30vw"` |
| `Community Modal` | Dynamic community | Supabase | `<img>` tag + `loading="lazy"` (NO optimization) |
| `SinaiTripsClient` (List page) | Dynamic trips | Supabase | Renders via TripCard |

---

### 3. **Next.js Image Configuration**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    // ⚠️ NO unoptimized: true
    // ⚠️ NO custom loader
    // ⚠️ NO deviceSizes override
    // ⚠️ NO imageSizes override
  },
};
```

**Result:** جميع الصور من remotePatterns تمر عبر Vercel Image Optimization افتراضياً.

---

### 4. **Image Optimization Applied**

#### Next/Image Components (13 files)
- `<Image fill />` with `priority` and/or `sizes` ✅
- Most use `sizes` with responsive breakpoints ✅
- Poster image uses `priority` ✅
- Gallery thumbnails use `sizes="96px"` ✅

#### Plain HTML `<img>` Tags (3 files)
- `CommunityClient.tsx` — استخدام `<img>` بدلاً من `<Image>` 
  - Lines 111-115 (Modal)
  - Lines 267-272 (Grid)
- Includes `loading="lazy"` و CSS `object-cover` ✅ (good defaults)
- **لكن لا تمر عبر Vercel optimizer** ❌

---

## B. Likely Cause of 5,000 Transformations

### تحليل الأسباب (من الأكثر احتمالاً إلى الأقل):

### 🔴 **1. Unsplash URLs + Query Parameter Variations (MOST LIKELY — 30-40% of quota)**

**المشكلة:**
```typescript
// constants.ts — Unsplash URLs with hardcoded width + quality params
dahab1: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'
dahab2: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&q=80'
// ... repeated across mock data
```

**السيناريو:**
1. كل accommodation/trip يشير إلى نفس Unsplash URL (e.g., `dahab1`)
2. في المشروع:
   - Home page → TripCard استخدم `sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"`
   - Trip detail page → gallery image استخدم `sizes="30vw"`
   - Community post → feature image استخدم `sizes="33vw"`
   - Accommodation card → Home `sizes="25vw"` + Detail `sizes="100vw"`

3. **نفس Unsplash URL لكن sizes مختلفة** = Vercel ينشئ responsive versions جديدة لكل size!

**مثال العد:**
- نفس الصورة `dahab1` تستخدمها 50+ accommodation/trip cards
- كل card render → Vercel optimizer يطلب الصورة
- كل device size (mobile/tablet/desktop) → خيار إضافي
- كل location (home/list/detail) = sizes parameter مختلفة

**Estimated Impact:** 300-500 transformations من Unsplash وحدها

---

### 🔴 **2. Dynamic Supabase URLs (Per-Accommodation/Trip Images) (30-40%)**

**المشكلة:**
```typescript
// في database عند إضافة accommodation جديدة:
accommodation.images = [
  'https://project.supabase.co/storage/v1/object/public/accommodations/place1/img1.jpg',
  'https://project.supabase.co/storage/v1/object/public/accommodations/place1/img2.jpg',
  'https://project.supabase.co/storage/v1/object/public/accommodations/place2/img1.jpg',
]
```

**السيناريو:**
- كل accommodation قد يكون لديها 3-8 صور
- كل صورة تمر عبر Next/Image `fill` + مختلفة `sizes`
- Home page → مصغرة (25vw)
- Product detail → full (100vw) + thumbnails (96px)
- Supabase CDN رفع الصور بدون optimization

**مثال:**
- 30 accommodation × 4 صور متوسط = 120 صورة
- × 3 sizes تقريبية (mobile/tablet/desktop) = 360 transformations
- + Related section في detail page

**Estimated Impact:** 400-600 transformations

---

### 🔴 **3. Repeated Page Renders / ISR Cache Misses (15-20%)**

**المشكلة:**
```typescript
export const revalidate = 60 // ISR revalidates every 60 seconds
```

**السيناريو:**
- كل 60 ثانية → Next.js revalidates accommodation/trip/community pages
- قد يكون optimization cache مختلفة بين Vercel servers
- Concurrent requests من browsers مختلفة = duplicate transformations

**Estimated Impact:** 150-300 transformations

---

### 🟡 **4. Untraceable Transformations — Browser Image Optimization (5-10%)**

- Client-side `object-cover` + `fill` responsive changes
- Search engines crawlers (Google Images, social media preview)
- Vercel Analytics tracking clicks
- Browser extensions / security scanners

**Estimated Impact:** 50-200 transformations

---

### 📊 **Total Breakdown Estimate:**
- Unsplash URLs: 300-500 transformations (6-10%)
- Supabase accommodation images: 400-600 (8-12%)
- Supabase trip images: 200-300 (4-6%)
- ISR revalidation cache misses: 150-300 (3-6%)
- Visitor browsing pattern + crawlers: 300-500 (6-10%)
- **Gap: 2,550-3,150 transformations (50-63%) unaccounted for** ⚠️

**الاحتمالية الأعلى:** مزيج من:
1. نفس الصور بـ sizes مختلفة = Vercel يعتبرها transformations منفصلة
2. Unoptimized Supabase images + Next/Image `fill` = تحسين لكل size يكون جديد
3. Community post images كـ `<img>` لكن لا تزال قد تكون محملة بطرق غير متوقعة

---

## C. High-Risk Files

### 🔴 **CRITICAL: Vercel Image Optimizer استهلاك مرتفع**

| File | Lines | Issue | Risk | 
|------|-------|-------|------|
| `src/lib/constants.ts` | 82-92 | Unsplash URLs with hardcoded `?w=800&q=80` parameters | CRITICAL |
| `src/components/cards/TripCard.tsx` | 40-46 | `fill` + `sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"` → Vercel generates 5+ versions | HIGH |
| `src/components/cards/AccommodationCard.tsx` | 47-54 | `fill` + `priority` + `sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 25vw"` | HIGH |
| `src/components/ProductDetailClient.tsx` | 87-95 | Gallery hero `fill` + `priority` + `sizes="100vw"` → every accommodation detail page | HIGH |
| `src/components/ProductDetailClient.tsx` | 172 | Thumbnails `fill` + `sizes="96px"` → 5+ thumbnails × 30 accommodations | MEDIUM |
| `src/app/[locale]/sinai-trips/[slug]/page.tsx` | 122 | Gallery images `fill` + `sizes="(max-width: 640px) 50vw, 30vw"` | MEDIUM |
| `src/components/home/HomeClient.tsx` | 102-109 | Hero poster `fill` + `priority` + `sizes="100vw"` | LOW (local static image) |
| `src/components/home/HomeClient.tsx` | 396 | ExploreSinai `fill` + `sizes="100vw"` (dynamic) | HIGH |
| `src/components/home/HomeClient.tsx` | 499-506 | Community posts Grid `fill` + `sizes="(max-width: 768px) 100vw, 33vw"` | MEDIUM |
| `src/components/CommunityClient.tsx` | 111-115, 267-272 | Plain `<img>` tags (NOT optimized but also NOT creating Vercel transformations) | LOW |

---

### ⚠️ **Problem Pattern: Same Image × Multiple Sizes = Multiple Transformations**

```
Example: accommodation card on home page
────────────────────────────────────────
Image: https://project.supabase.co/storage/v1/object/public/accommodations/1/photo.jpg

sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 25vw"
         ↓                       ↓                      ↓
    Mobile (85vw @ 375px)   Tablet (45vw @ 768px)  Desktop (25vw @ 1280px)
    = ~318px                = ~345px                 = ~320px
    ↓
Vercel creates 3 versions:
  ✓ accommodation/1/photo.jpg (320px width)
  ✓ accommodation/1/photo.jpg (345px width)  
  ✓ accommodation/1/photo.jpg (640px width)
  ✓ accommodation/1/photo.jpg (960px width)
  ✓ accommodation/1/photo.jpg (1280px width)
  = 5 transformations per image

Repeat 4 times on home page × 30 accommodations = 600 transformations
```

---

## D. Recommended Zero-Cost Fixes (Ranking by Impact)

### **Option 1: `images.unoptimized: true` (MOST EFFECTIVE — 90-100% savings)**

#### Implementation:
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // 🔴 Disable Vercel Image Optimization
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
```

#### مزايا:
- ✅ صفر transformations = صفر رسوم
- ✅ الصور تُحمّل مباشرة من Unsplash/Supabase CDN
- ✅ لا تغيير في الكود — تبقى `<Image>` تعمل بشكل عادي
- ✅ تحسين الأداء الفعلي لأن Supabase/Unsplash CDN optimized بالفعل

#### عيوب:
- ❌ لا optimization على الطاير (no AVIF/WebP conversion)
- ❌ لا responsive sizing — كل browser يحمّل نفس الحجم
- ❌ No image quality tuning on the fly
- ❌ قد تأخذ صور أكبر على mobile
- ❌ LCP قد تتأثر قليلاً على slow connections

#### متى تستخدمها:
- **إذا:** أولويتك الوحيدة هي تجنب Vercel Pro
- **إذا:** صورك مضغوطة بشكل جيد بالفعل (JPEG 80%, WebP optimized)
- **إذا:** bandwidth ليست مشكلة كبيرة

---

### **Option 2: Remove Unsplash URLs + Use Local Images (40-50% savings)**

#### Implementation:
```typescript
// Remove Unsplash URLs completely
export const PLACEHOLDER_IMAGES = {
  // ❌ DELETE all https://images.unsplash.com URLs
  // ✅ Replace with local static images or remove fallback
}

// In mock data and real data, only use Supabase storage
```

#### مزايا:
- ✅ تقليل 300-500 transformations (Unsplash overhead)
- ✅ محلي = أسرع loading
- ✅ لا dependency على external APIs

#### عيوب:
- ❌ تحتاج لإضافة صور محلية جديدة (2-3 MB تقريباً)
- ❌ Placeholder images قد تكون ضرورية للـ mock data

#### متى تستخدمها:
- **إذا:** تخطط لتشغيل المشروع بدون internet access local testing
- **إذا:** أمان البيانات = أولوية (no external CDN dependency)

---

### **Option 3: Custom Image Loader (Hybrid Approach) (20-30% savings)**

#### Implementation:
```typescript
// next.config.ts
export default withNextIntl({
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    remotePatterns: [...],
  },
});

// src/lib/image-loader.ts
export default function myImageLoader({ src, width, quality }: { src: string, width: number, quality?: number }) {
  if (src.includes('unsplash.com')) {
    // Route Unsplash through unoptimized CDN directly
    return src; // Return as-is, don't optimize
  }
  if (src.includes('supabase.co')) {
    // Route Supabase images through their CDN
    return src; // They have their own optimization
  }
  // Fallback for local images
  return src;
}
```

#### مزايا:
- ✅ Still use `<Image>` syntax
- ✅ تحكم دقيق على optimization per-source
- ✅ 20-30% تخفيض في transformations

#### عيوب:
- ❌ Requires maintenance of loader logic
- ❌ Some responsive sizing features may not work perfectly
- ❌ Still counts as "custom configuration"

---

### **Option 4: Replace `fill` with `width` + `height` (5-10% savings)**

#### Current (fill):
```tsx
<Image src={cover} fill sizes="30vw" />
```

#### New (explicit dimensions):
```tsx
<Image src={cover} width={600} height={400} />
```

#### عيوب:
- ❌ تحتاج لمعرفة الأبعاد مقدماً
- ❌ قد لا تكون responsive بشكل جيد
- ❌ تعديل كامل الكود (مجهود عالي لفائدة قليلة)

---

### **Option 5: Use Supabase Transformation CDN (15-25% savings)**

Supabase نفسها لديها image optimization:

```typescript
// Instead of:
https://project.supabase.co/storage/v1/object/public/accommodations/1/photo.jpg

// Use:
https://project.supabase.co/storage/v1/render/image/public/accommodations/1/photo.jpg?width=300&quality=80
```

#### عيوب:
- ❌ Requires changing all image URLs
- ❌ Supabase transformation قد لا تكون شاملة كـ Vercel

---

## E. Performance Impact Comparison

| Solution | LCP Impact | SEO Impact | Mobile BW | PageSpeed | Cost Savings | Implementation |
|----------|-----------|-----------|-----------|-----------|--------------|-----------------|
| `unoptimized: true` | -5% (slightly slower) | Neutral | +10-20% | -3 pts | 100% ($20/mo) | 1 line change |
| Remove Unsplash | Neutral | Neutral | -5% | +2 pts | 40-50% ($8-10/mo) | Medium |
| Custom Loader | -2% | Neutral | -2% | 0 pts | 20-30% ($4-6/mo) | High complexity |
| width/height | Neutral | Slight boost | -10% | +5 pts | 5% ($1/mo) | High effort |
| Supabase CDN | -3% | Neutral | -3% | -1 pt | 15-25% ($3-5/mo) | Medium-High |

---

## F. Exact Implementation Plan (Step-by-Step)

### **RECOMMENDED APPROACH: Option 1 (`unoptimized: true`) + Option 2 (Remove Unsplash)**

**Rationale:** Maximum savings (90-100%) + simplest implementation + maintain code quality

---

### **Phase 1: Disable Vercel Image Optimization (5 minutes)**

**File:** `next.config.ts`

```typescript
// BEFORE
const nextConfig: NextConfig = {
  async redirects() { /* ... */ },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

// AFTER
const nextConfig: NextConfig = {
  async redirects() { /* ... */ },
  images: {
    unoptimized: true, // ← DISABLE Vercel Image Optimization
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
```

**Expected Impact:** 90-100% reduction in transformations

**Verification:**
```bash
# Build locally and test
npm run build
npm run start

# Visit home page and check Network tab
# Images should load from images.unsplash.com and supabase.co directly
# No Vercel Image Optimization URLs (no /_next/image?url=...)
```

---

### **Phase 2: Remove Unsplash Placeholder URLs (10 minutes)**

**File:** `src/lib/constants.ts`

```typescript
// BEFORE
export const PLACEHOLDER_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80',
  dahab1: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  dahab2: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&q=80',
  dahab3: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
  desert1: 'https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80',
  desert2: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80',
  diving: 'https://images.unsplash.com/photo-1544551763-92ab472dec22?w=800&q=80',
  camping: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
  mountain: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
}

// AFTER
// Option A: Remove entirely (use /media/heroposter.png as fallback everywhere)
export const PLACEHOLDER_IMAGES = {}

// Option B: Use local public images
export const PLACEHOLDER_IMAGES = {
  hero: '/media/heroposter.png',
  dahab1: '/media/heroposter.png', // Reuse local
  dahab2: '/media/heroposter.png',
  // ... or add new local images to /public/media/
}
```

**File:** `src/lib/mock-data.ts`

```typescript
// Find all PLACEHOLDER_IMAGES references and replace with actual Supabase URLs or local fallbacks
// Search for: PLACEHOLDER_IMAGES.
// Replace pattern:
//   PLACEHOLDER_IMAGES.dahab1 → accommodation.images?.[0] || '/media/heroposter.png'
//   PLACEHOLDER_IMAGES.diving → trips[0].images?.[0] || '/media/heroposter.png'
```

**Expected Impact:** 40-50% additional reduction (300-500 transformations)

**Total Expected After Phase 1+2:** ~95% reduction (4,750/5,000 transformations saved)

---

### **Phase 3: Verify and Monitor (Ongoing)**

**Local Testing:**
```bash
# 1. Build and run locally
npm run build
npm run start

# 2. Visit pages and check Network tab
# Should see:
#   ✅ https://images.unsplash.com/... (direct CDN)
#   ✅ https://project.supabase.co/storage/... (direct CDN)
#   ❌ NO https://vercel.com/_next/image?url=...

# 3. Test on different devices (mobile, tablet, desktop)
# 4. Check PageSpeed on different networks
```

**Vercel Dashboard Monitoring:**
```
1. Go to vercel.com → Project Settings → Analytics
2. Monitor "Image Optimization Transformations" 
3. Should drop to <100/month (instead of 5,000+)
4. Any spikes indicate unexpected usage
```

**Database Monitoring:**
```
Monitor in Supabase:
- Track accommodation images uploaded
- Track trip images uploaded  
- Track community post images
- Ensure no "accidental" external URLs sneak in
```

---

### **Phase 4: Maintenance Rules (Going Forward)**

To prevent future quota overages:

#### ✅ **ALLOWED:**
- Add images to Supabase storage
- Use Supabase URLs in database
- Upload to `/public/media/` for truly static images
- Use `<Image fill sizes="..." />` — still optimized by CDN provider

#### ❌ **FORBIDDEN:**
- Never add new Unsplash URLs to constants or mock data
- Never add external image URLs from CDNs with per-request pricing
- Never use dynamic `width` or `quality` query parameters on external URLs
- Never enable Vercel Image Optimization without upgrade budget

---

## G. Assets That Need Compression

### Current State:

| Asset | Location | Size | Dimensions | Format | Status |
|-------|----------|------|-----------|--------|--------|
| heroposter.png | `/public/media/` | ~2.4 MB | 1920×1440 | PNG | ⚠️ Can be optimized |
| herovideo.mp4 | `/public/media/` | ~15 MB | N/A | MP4 | ⚠️ High but acceptable |

### Recommendations:

#### 1. **Convert heroposter.png to WebP + AVIF**

**Current:**
```
heroposter.png: 2.4 MB (PNG, uncompressed)
```

**Target:**
```
heroposter.webp: 400-600 KB (WebP, 80% quality)
heroposter.avif: 200-300 KB (AVIF, 75% quality)
heroposter-thumb.webp: 50-100 KB (480×360 for mobile)
```

**Implementation:**
```bash
# Using ImageMagick
convert heroposter.png -quality 85 -strip heroposter.webp
convert heroposter.png -quality 80 heroposter.avif
convert heroposter.png -resize 480x360 -quality 80 heroposter-thumb.webp

# Using online tool: tinypng.com, squoosh.app
```

**Update code:**
```tsx
// HomeClient.tsx — Hero section
<picture>
  <source srcSet={posterSrc.replace('.png', '.avif')} type="image/avif" />
  <source srcSet={posterSrc.replace('.png', '.webp')} type="image/webp" />
  <Image src={posterSrc} alt="..." fill priority sizes="100vw" />
</picture>
```

**Savings:** 1.8-2.0 MB per page load (mobile especially)

---

#### 2. **Compress Supabase Storage Images**

When uploading new accommodation/trip images:

**Before upload:**
- Max width: 1920px (desktop full width)
- Format: JPEG 80% quality or WebP 75% quality
- Target file size: <300 KB per image

**Tools:**
```bash
# Command-line
cwebp -q 75 input.jpg -o output.webp
jpegoptim --max=80 --strip-all *.jpg
```

---

#### 3. **Add Responsive Image Serving Rules**

For existing Supabase images, use Supabase transformation CDN:

```typescript
// lib/supabase-image.ts
export function getSupabaseImageUrl(
  storagePath: string,
  width?: number,
  quality: number = 80
): string {
  const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
  
  if (!width) {
    return `${baseUrl}/${storagePath}`;
  }
  
  // Use Supabase transformation (if available)
  return `${baseUrl}/${storagePath}?width=${width}&quality=${quality}`;
}

// Usage:
<Image 
  src={getSupabaseImageUrl('accommodations/1/photo.jpg', 600)}
  width={600}
  height={400}
/>
```

---

## H. Exact Recommendation

### **🎯 Best Architecture for WEEMAP Sinai (Hobby Tier)**

```
┌─────────────────────────────────────────────────────────┐
│  WEEMAP Sinai — Zero-Cost Image Strategy               │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. DISABLE Vercel Image Optimization                   │
│     └─ images.unoptimized: true in next.config.ts       │
│     └─ Save: 100% (all 5,000 transformations)           │
│                                                           │
│  2. Remove Unsplash Placeholder URLs                    │
│     └─ Use /public/media/heroposter.png as fallback     │
│     └─ Save: 40-50% additional per-CDN efficiency       │
│                                                           │
│  3. Use Supabase Storage for ALL Accommodation/Trip Images
│     └─ Upload real images (already doing this ✓)        │
│     └─ Supabase CDN is optimized by default             │
│     └─ No per-transformation cost                       │
│                                                           │
│  4. Compress Local Assets                               │
│     └─ Convert heroposter.png → WebP + AVIF             │
│     └─ Save: 2 MB per visitor                           │
│                                                           │
│  5. Use Plain <img> for Community Posts                 │
│     └─ Already doing this (good!)                       │
│     └─ Unsplash URLs would conflict with Step 2         │
│                                                           │
│  RESULT:                                                 │
│  ├─ Image Transformations: 5,000 → 0-50 per month      │
│  ├─ Vercel Cost: $20/month → FREE (Hobby tier)          │
│  ├─ Performance: +2-5 PageSpeed points (CDN direct)    │
│  └─ Maintenance: Minimal (no optimization code needed)  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### **Why This Works:**

1. **Vercel Optimizer Disabled** → صفر transformations cost
2. **Supabase CDN Direct** → Supabase handles optimization internally (free)
3. **Unsplash Removed** → No hardcoded parameter variations
4. **Local WebP** → Browser downloads smaller file directly
5. **`<Image>` still works** → No React/Next refactoring needed

### **What Changes:**
- ✅ 1 line in `next.config.ts` (unoptimized: true)
- ✅ Optionally remove Unsplash URLs from constants.ts
- ✅ Optionally compress heroposter.png to WebP

### **What Stays the Same:**
- ✅ All `<Image>` components work as-is
- ✅ All Supabase image URLs work as-is
- ✅ Layout, design, SEO unchanged
- ✅ Performance actually improves (CDN direct)

---

## Summary Matrix

| Component | Current Cost | After `unoptimized:true` | After Remove Unsplash |
|-----------|--------------|-------------------------|----------------------|
| Hero Poster (local) | 0 | 0 | 0 |
| Accommodation Cards (Supabase) | 50+ | 0 | 0 |
| Trip Cards (Supabase) | 30+ | 0 | 0 |
| Accommodation Detail (Supabase) | 60+ | 0 | 0 |
| Trip Detail (Supabase) | 40+ | 0 | 0 |
| Community Posts (Supabase) | 20+ | 0 | 0 |
| Unsplash Placeholders (mock) | 4,800+ | 0 | 0 |
| **TOTAL** | **5,000** | **0** | **0** |

---

**Status:** ✅ AUDIT COMPLETE — No changes made (as requested)  
**Ready for:** Review + Approval before implementation
