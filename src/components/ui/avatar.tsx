"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackClassName?: string;
}

const UserAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  UserAvatarProps
>(({ src, name = "User", size = "md", className, fallbackClassName }, ref) => {
  const initials = React.useMemo(() => {
    if (!name) return "BL";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "BL";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const sizeClasses = {
    xs: "size-5 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-xs",
    lg: "size-12 text-sm",
    xl: "size-16 text-base",
  }[size];

  return (
    <Avatar ref={ref} className={cn(sizeClasses, "border border-border/60 shrink-0 select-none", className)}>
      {src ? (
        <AvatarImage
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className="size-full object-cover"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 text-white font-bold select-none",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
});
UserAvatar.displayName = "UserAvatar";

export { Avatar, AvatarImage, AvatarFallback, UserAvatar };

