# Logo Assets Required

Place these files in the `/public` directory for full branding integration.

## Required Files

### 1. Favicons
- `favicon.ico` - Multi-resolution ICO (16x16, 32x32)
- `favicon-16x16.png` - 16×16 PNG
- `favicon-32x32.png` - 32×32 PNG

### 2. Apple Touch Icon
- `apple-touch-icon.png` - 180×180 PNG with 10% padding

### 3. PWA Icons
- `icon-192.png` - 192×192 PNG with 10% padding
- `icon-512.png` - 512×512 PNG with 10% padding

### 4. Social Media / Open Graph
- `og-image.png` - 1200×630 PNG for social sharing

## Design Guidelines

### For Icon-Only Files (Favicons, App Icons):
- Use the **"N" logo only** (without text)
- Apply gradient: Blue (#60A5FA) to Purple (#7C3AED)
- Include the small star accent in top-right
- Add 10-15% padding for app icons
- White or transparent background

### For Open Graph Image:
- Include full logo with "notissima" text
- Add tagline: "Professional Meeting Documentation"
- Use clean white background
- Center the content

## Quick Generation Tools

### Online Tools:
- **Favicon Generator**: https://realfavicongenerator.net/
- **PWA Icon Generator**: https://www.pwabuilder.com/imageGenerator
- **OG Image Generator**: https://ogimage.gallery/

### From Command Line (ImageMagick):
```bash
# Convert your source logo to different sizes
convert logo.png -resize 16x16 favicon-16x16.png
convert logo.png -resize 32x32 favicon-32x32.png
convert logo.png -resize 180x180 apple-touch-icon.png
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 512x512 icon-512.png

# Create ICO from PNGs
convert favicon-16x16.png favicon-32x32.png favicon.ico
```

## Current Status

✅ Logo component created (`/components/ui/logo.tsx`)  
✅ Sidebar updated to use new logo  
✅ Topbar updated to use new logo  
✅ Metadata updated in `layout.tsx`  
✅ PWA manifest updated  

⏳ **Waiting for**: PNG/ICO files to be placed in `/public`

## Source Image

The original logo is available at:
`/Users/nanavareerak/.cursor/projects/Users-nanavareerak-social-project/assets/image-7553f642-abb7-4296-8220-4d69f062d456.png`

Extract and process this image to create all required assets.
