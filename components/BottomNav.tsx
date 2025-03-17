import * as React from 'react'
import { MapPin, Camera, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BottomNavProps extends React.HTMLAttributes<HTMLDivElement> {}

export function BottomNav({ className, ...props }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "w-[calc(100%-2rem)] max-w-md mx-auto",
        "flex items-center justify-around",
        "h-16 px-4",
        "bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl",
        "rounded-2xl border border-zinc-200 dark:border-zinc-800",
        "shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        className
      )}
      {...props}
    >
      <NavButton href="/map" icon={MapPin} label="Map" isActive={pathname === '/map'} />
      <div className="relative">
        <NavButton 
          href="/camera" 
          icon={Camera} 
          label="Camera" 
          isActive={pathname === '/camera'}
          className="relative z-10 -mt-8 transform transition-transform hover:scale-110 active:scale-95"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/80 to-primary blur-lg opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-primary to-primary-foreground" />
        </NavButton>
      </div>
      <NavButton href="/profile" icon={User} label="Profile" isActive={pathname === '/profile'} />
    </div>
  )
}

interface NavButtonProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive?: boolean
  className?: string
  children?: React.ReactNode
}

function NavButton({ href, icon: Icon, label, isActive, className, children }: NavButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col items-center justify-center p-2",
        "transition-all duration-300 ease-in-out",
        isActive && "text-primary",
        !isActive && "text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary",
        className
      )}
    >
      {children}
      <div className="relative z-10 flex flex-col items-center">
        <Icon className={cn(
          "h-6 w-6 transition-all",
          isActive ? "scale-100" : "scale-90",
          "group-hover:scale-100"
        )} />
        <span className={cn(
          "mt-1 text-xs font-medium",
          "transition-all",
          isActive ? "opacity-100" : "opacity-70",
          "group-hover:opacity-100"
        )}>
          {label}
        </span>
      </div>
      {isActive && (
        <div className="absolute -inset-1 -z-10 rounded-xl bg-primary/10 dark:bg-primary/20 blur-sm" />
      )}
    </Link>
  )
} 