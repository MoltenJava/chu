import * as React from 'react'
import { Heart, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FoodCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl: string
  name: string
  restaurant: string
  price: string
  rating?: number
  onLike?: () => void
  onShare?: () => void
}

export function FoodCard({ 
  imageUrl, 
  name, 
  restaurant, 
  price,
  rating,
  className, 
  onLike,
  onShare,
  ...props 
}: FoodCardProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isLiked, setIsLiked] = React.useState(false)

  const handleLike = () => {
    setIsLiked(!isLiked)
    onLike?.()
  }

  return (
    <div
      className={cn(
        "group relative w-full max-w-md overflow-hidden",
        "rounded-3xl bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        "transition-all duration-300",
        "hover:shadow-[0_16px_48px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]",
        "hover:-translate-y-1",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={imageUrl}
          alt={name}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            "transition-transform duration-500",
            isHovered && "scale-110"
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        
        <div className="absolute right-4 top-4 flex gap-2">
          <button
            onClick={handleLike}
            className={cn(
              "rounded-full p-3",
              "backdrop-blur-md transition-all duration-300",
              "hover:scale-110 active:scale-95",
              isLiked 
                ? "bg-primary text-white" 
                : "bg-white/20 text-white hover:bg-white/30"
            )}
          >
            <Heart className={cn(
              "h-5 w-5 transition-transform",
              isLiked && "fill-current scale-110"
            )} />
          </button>
          <button
            onClick={onShare}
            className={cn(
              "rounded-full p-3",
              "bg-white/20 text-white",
              "backdrop-blur-md transition-all duration-300",
              "hover:bg-white/30 hover:scale-110 active:scale-95"
            )}
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
          <div className="flex items-end justify-between text-white">
            <div>
              <h3 className="text-xl font-bold leading-tight">{name}</h3>
              <p className="text-sm opacity-90">{restaurant}</p>
            </div>
            <p className="text-lg font-bold">{price}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold leading-tight text-zinc-900 dark:text-white">{name}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{restaurant}</p>
          </div>
          <p className="text-lg font-bold text-primary">{price}</p>
        </div>
        {rating && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-all",
                  i < rating 
                    ? "bg-primary" 
                    : "bg-zinc-200 dark:bg-zinc-800"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 