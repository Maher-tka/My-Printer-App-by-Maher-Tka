import * as React from 'react'
import { cn } from '@/lib/utils'

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
)
Avatar.displayName = 'Avatar'

const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground',
        className
      )}
      {...props}
    />
  )
)
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarFallback }
