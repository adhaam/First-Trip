import { SafeImage as Image } from '@/components/SafeImage'

/** The trip detail page's "closer look" grid — every image after the hero cover. */
export function TripDetailGallery({ images, name }: { images: string[]; name: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((src, index) => (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl" key={src}>
          <Image
            src={src}
            alt={`${name} ${index + 2}`}
            fill
            sizes="(max-width: 640px) 50vw, 30vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}
