import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg relative pr-8",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "!opacity-100 !flex !items-center !justify-center !size-5 !rounded-full !bg-background/90 !text-foreground !border !border-border hover:!bg-muted hover:!text-foreground !left-auto !right-2.5 !top-2.5 !transform-none shadow-xs transition-colors cursor-pointer",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
